const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  const header = req.headers['authorization']
  if (!header) return res.status(401).json({ error: 'Token requerido' })

  const token = header.split(' ')[1]
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acceso restringido a administradores' })
  next()
}

module.exports = { authMiddleware, adminMiddleware }