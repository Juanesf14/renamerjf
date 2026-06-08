const { GoogleGenerativeAI } = require('@google/generative-ai')

const sessions = new Map()
const SESSION_TTL = 30 * 60 * 1000 // 30 minutos

const storeSession = (sessionId, text) => {
  sessions.set(sessionId, { text, expiresAt: Date.now() + SESSION_TTL })
}

const getSession = (sessionId) => {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }
  session.expiresAt = Date.now() + SESSION_TTL
  return session
}

// Limpiar sesiones expiradas cada 10 minutos
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(id)
  }
}, 10 * 60 * 1000).unref()

const chatWithDocument = async (sessionId, messages) => {
  const session = getSession(sessionId)
  if (!session) throw new Error('SESSION_EXPIRED')

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-lite-latest',
    systemInstruction: `You are a helpful assistant specializing in medical and insurance documents for a legal case management firm. You have access to the following medical document. Answer questions about it accurately and concisely. If the answer is not in the document, say so clearly. Respond in the same language the user writes in.

DOCUMENT:
${session.text}`,
  })

  // Gemini usa 'model' en vez de 'assistant', y parts[] en vez de content string
  const recent = messages.slice(-10)
  const history = recent.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMessage = recent[recent.length - 1]

  const chat = model.startChat({ history })
  const result = await chat.sendMessage(lastMessage.content)
  return result.response.text()
}

module.exports = { storeSession, chatWithDocument }
