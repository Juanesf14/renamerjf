const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./db/schema')
const authRoutes = require('./routes/auth')
const providerRoutes = require('./routes/providers')
const historyRoutes = require('./routes/history')
const analyzeRoutes = require('./routes/analyze')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/providers', providerRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/analyze', analyzeRoutes)

app.get('/api/document-types', (req, res) => {
  const types = db.prepare('SELECT * FROM document_types').all()
  res.json(types)
})

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`)
})