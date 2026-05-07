const fs = require('fs')
const pdfParse = require('pdf-parse')
const Fuse = require('fuse.js')

const extractText = async (filePath) => {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return data.text || ''
}

const exactMatch = (text, providers) => {
  const normalized = text.toLowerCase()
  for (const p of providers) {
    if (normalized.includes(p.name.toLowerCase())) {
      return { provider_id: p.id, name: p.name, confidence: 1.0, method: 'exact' }
    }
  }
  return null
}

const fuzzyMatch = (text, providers) => {
  const words = text.replace(/\n/g, ' ').split(/\s+/).filter(w => w.length > 3)
  const chunks = []
  for (let i = 0; i < words.length - 2; i++) {
    chunks.push(words.slice(i, i + 4).join(' '))
  }

  const fuse = new Fuse(providers, {
    keys: ['name'],
    threshold: 0.6,
    includeScore: true
  })

  let bestResult = null
  let bestScore = Infinity

  for (const chunk of chunks) {
    const results = fuse.search(chunk)
    if (results.length > 0 && results[0].score < bestScore) {
      bestScore = results[0].score
      bestResult = results[0]
    }
  }

  if (!bestResult) return null
  const confidence = +(1 - bestResult.score).toFixed(2)
  if (confidence < 0.4) return null

  return {
    provider_id: bestResult.item.id,
    name: bestResult.item.name,
    confidence,
    method: 'fuzzy'
  }
}

const analyzeDocument = async (filePath, providers) => {
  try {
    const text = await extractText(filePath)
    if (!text || text.trim().length === 0)
      return { suggestion: null, reason: 'No se pudo extraer texto del documento' }

    const exact = exactMatch(text, providers)
    if (exact) return { suggestion: exact }

    const fuzzy = fuzzyMatch(text, providers)
    if (fuzzy) return { suggestion: fuzzy }

    // Paso 3: IA (pendiente)
    // if (process.env.AI_ENABLED === 'true') {
    //   const ai = await aiMatch(text, providers)
    //   if (ai) return { suggestion: ai }
    // }

    return { suggestion: null, reason: 'No se encontró coincidencia' }

  } catch (err) {
    console.error('Error en Doc Analyzer:', err.message)
    return { suggestion: null, reason: 'Error al procesar el documento' }
  }
}

module.exports = { analyzeDocument }