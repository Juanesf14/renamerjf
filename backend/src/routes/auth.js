const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const db = require('../db/schema')

const router = express.Router()

// Registro
router.post('/register', (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' })

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists)
    return res.status(400).json({ error: 'El email ya está registrado' })

  const password_hash = bcrypt.hashSync(password, 10)
  const id = uuidv4()

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, 'user')
  `).run(id, name, email, password_hash)

  const token = jwt.sign({ id, name, email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '8h' })

  res.status(201).json({ token, user: { id, name, email, role: 'user' } })
})

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user)
    return res.status(401).json({ error: 'Credenciales inválidas' })

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid)
    return res.status(401).json({ error: 'Credenciales inválidas' })

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

module.exports = router