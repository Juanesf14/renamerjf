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

/**
 * POST /api/analyze
 *
 * Pipeline:
 *  1. Extract text from the PDF (with OCR fallback for scanned docs).
 *  2. Run regex + fuzzy matching against the provider list.
 *  3. If confidence < 0.75, escalate to Gemini for a second opinion.
 *  4. Store extracted text in a server-side session so the chat endpoint
 *     can answer follow-up questions without re-uploading the file.
 *
 * Returns: suggestion, dates, flags, sessionId (extractedText is stripped from the response).
 */
router.post('/', async (req, res) => {
  const { filePath } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath is required' })

  // Reject relative paths — the renderer must always send an absolute OS path.
  if (!path.isAbsolute(filePath))
    return res.status(400).json({ error: 'Invalid file path' })

  const providers = db.prepare('SELECT id, name FROM providers').all()

  // Always create a chat session even when no providers exist,
  // so the user can still ask questions about the document.
  const result = await analyzeDocument(filePath, providers)
  const sessionId = uuidv4()
  storeSession(sessionId, result.extractedText || '')

  if (providers.length === 0) {
    return res.json({ suggestion: null, reason: 'No providers registered', sessionId })
  }

  // Escalate to Gemini only when regex/fuzzy confidence is below the threshold.
  const lowConfidence = !result.suggestion || result.suggestion.confidence < 0.75
  if (lowConfidence && process.env.GEMINI_API_KEY && result.extractedText) {
    try {
      const cleanText = prepareTextForClaude(result.extractedText)
      const claudeResult = await analyzeWithClaude(cleanText, providers)

      if (claudeResult) {
        // Override the regex provider match only if Gemini is more confident.
        if (claudeResult.provider_id && claudeResult.confidence > (result.suggestion?.confidence || 0)) {
          result.suggestion = {
            provider_id: claudeResult.provider_id,
            name: claudeResult.provider_name,
            confidence: claudeResult.confidence,
            method: 'claude',
          }
        }

        // Backfill dates that the regex failed to capture.
        if (!result.dates) result.dates = {}
        if (!result.dates.dosStart   && claudeResult.dosStart)   result.dates.dosStart   = claudeResult.dosStart
        if (!result.dates.dosEnd     && claudeResult.dosEnd)     result.dates.dosEnd     = claudeResult.dosEnd
        if (!result.dates.updateDate && claudeResult.updateDate) result.dates.updateDate = claudeResult.updateDate

        // Backfill flags that the regex patterns didn't catch.
        if (!result.flags) result.flags = {}
        if (!result.flags.hasAmbulance && claudeResult.hasAmbulance) {
          result.flags.hasAmbulance     = claudeResult.hasAmbulance
          result.flags.ambulanceCompany = claudeResult.ambulanceCompany
        }
        if (!result.flags.hasReferral && claudeResult.hasReferral) {
          result.flags.hasReferral = claudeResult.hasReferral
          result.flags.referrals   = claudeResult.referrals || []
        }
      }
    } catch (err) {
      console.error('Gemini escalation error:', err.message)
    }
  }

  // Strip extractedText from the response — it lives server-side in the session.
  const { extractedText: _, ...responseData } = result
  res.json({ ...responseData, sessionId })
})

module.exports = router
