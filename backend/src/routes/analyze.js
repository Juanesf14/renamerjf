const express = require('express')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { authMiddleware } = require('../middleware/auth')
const { analyzeDocument, prepareTextForClaude } = require('../services/docAnalyzer')
const { analyzeWithClaude } = require('../services/claudeAnalyzer')
const { storeSession } = require('../services/claudeChat')
const db = require('../db/schema')

const router = express.Router()

router.use(authMiddleware)

router.post('/', async (req, res) => {
  const { filePath } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath requerido' })

  if (!path.isAbsolute(filePath))
    return res.status(400).json({ error: 'Ruta de archivo inválida' })

  const providers = db.prepare('SELECT id, name FROM providers').all()

  // Extraer texto y crear sesión siempre, incluso sin providers (para que el chat funcione)
  const result = await analyzeDocument(filePath, providers)
  const sessionId = uuidv4()
  storeSession(sessionId, result.extractedText || '')

  if (providers.length === 0) {
    return res.json({ suggestion: null, reason: 'No hay providers registrados', sessionId })
  }

  // Escalar a Claude si regex no encontró match con alta confianza
  const lowConfidence = !result.suggestion || result.suggestion.confidence < 0.75
  if (lowConfidence && process.env.GEMINI_API_KEY && result.extractedText) {
    try {
      const cleanText = prepareTextForClaude(result.extractedText)
      const claudeResult = await analyzeWithClaude(cleanText, providers)

      if (claudeResult) {
        // Usar provider de Claude si supera el match actual
        if (claudeResult.provider_id && claudeResult.confidence > (result.suggestion?.confidence || 0)) {
          result.suggestion = {
            provider_id: claudeResult.provider_id,
            name: claudeResult.provider_name,
            confidence: claudeResult.confidence,
            method: 'claude',
          }
        }

        // Completar fechas que regex no encontró
        if (!result.dates) result.dates = {}
        if (!result.dates.dosStart && claudeResult.dosStart)    result.dates.dosStart   = claudeResult.dosStart
        if (!result.dates.dosEnd   && claudeResult.dosEnd)      result.dates.dosEnd     = claudeResult.dosEnd
        if (!result.dates.updateDate && claudeResult.updateDate) result.dates.updateDate = claudeResult.updateDate

        // Completar flags que regex no detectó
        if (!result.flags) result.flags = {}
        if (!result.flags.hasAmbulance && claudeResult.hasAmbulance) {
          result.flags.hasAmbulance    = claudeResult.hasAmbulance
          result.flags.ambulanceCompany = claudeResult.ambulanceCompany
        }
        if (!result.flags.hasReferral && claudeResult.hasReferral) {
          result.flags.hasReferral = claudeResult.hasReferral
          result.flags.referrals   = claudeResult.referrals || []
        }
      }
    } catch (err) {
      console.error('Claude escalation error:', err.message)
    }
  }

  const { extractedText: _, ...responseData } = result
  res.json({ ...responseData, sessionId })
})

module.exports = router
