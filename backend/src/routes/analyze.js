const express = require('express')
const path = require('path')
const { authMiddleware } = require('../middleware/auth')
const { analyzeDocument } = require('../services/docAnalyzer')
const db = require('../db/schema')

const router = express.Router()

router.use(authMiddleware)

router.post('/', async (req, res) => {
  const { filePath } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath requerido' })

  if (!path.isAbsolute(filePath))
    return res.status(400).json({ error: 'Ruta de archivo inválida' })

  const providers = db.prepare('SELECT id, name FROM providers').all()
  if (providers.length === 0)
    return res.json({ suggestion: null, reason: 'No hay providers registrados' })

  const result = await analyzeDocument(filePath, providers)
  res.json(result)
})

module.exports = router