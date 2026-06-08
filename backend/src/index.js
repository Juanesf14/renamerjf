const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const express = require('express')
const cors = require('cors')
const db = require('./db/schema')
const authRoutes = require('./routes/auth')
const providerRoutes = require('./routes/providers')
const historyRoutes = require('./routes/history')
const analyzeRoutes = require('./routes/analyze')
const casesRoutes = require('./routes/cases')
const chatRoutes  = require('./routes/chat')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'] }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/providers', providerRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/analyze', analyzeRoutes)
app.use('/api/cases', casesRoutes)
app.use('/api/chat',  chatRoutes)

app.get('/api/document-types', (req, res) => {
  const types = db.prepare('SELECT * FROM document_types').all()
  res.json(types)
})

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`)
})
