const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { chatWithDocument } = require('../services/claudeChat')

const router = express.Router()

router.use(authMiddleware)

router.post('/', async (req, res) => {
  const { sessionId, messages } = req.body

  if (!sessionId || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'sessionId y messages son requeridos' })

  if (!process.env.GEMINI_API_KEY)
    return res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor' })

  try {
    const reply = await chatWithDocument(sessionId, messages)
    res.json({ reply })
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED')
      return res.status(404).json({ error: 'Sesión expirada. Vuelve a cargar el documento para reiniciar el chat.' })
    console.error('Chat error:', err?.message, err?.status, JSON.stringify(err?.errorDetails ?? ''))
    res.status(500).json({ error: 'Error al procesar la pregunta' })
  }
})

module.exports = router
