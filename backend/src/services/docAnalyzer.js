const fs = require('fs')
const pdfParse = require('pdf-parse')
const Fuse = require('fuse.js')
const { ocrExtract } = require('./ocr')

const OCR_THRESHOLD = 50

const extractText = async (filePath) => {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return data.text || ''
}

const countOccurrences = (text, name) => {
  // Para nombres cortos (< 5 chars) exige word boundary para evitar falsos positivos
  if (name.length < 5) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    return (text.match(re) || []).length
  }
  let count = 0
  let idx = 0
  const lower = text.toLowerCase()
  const lname = name.toLowerCase()
  while ((idx = lower.indexOf(lname, idx)) !== -1) { count++; idx += lname.length }
  return count
}

const exactMatch = (text, providers) => {
  let best = null
  let bestScore = 0

  for (const p of providers) {
    const count = countOccurrences(text, p.name)
    if (count === 0) continue

    // Ambulancias reciben un peso menor para perder en empate contra hospitales/aseguradoras
    const score = p.type === 'Ambulance' ? count * 0.6 : count

    if (score > bestScore) {
      bestScore = score
      best = {
        provider_id: p.id,
        name: p.name,
        confidence: 1.0,
        method: 'exact',
        occurrences: count,
      }
    }
  }

  return best
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

  // Acumular el mejor score por provider (no retornar al primer match)
  const scores = new Map() // provider_id → { item, bestScore, hits }

  for (const chunk of chunks) {
    const results = fuse.search(chunk)
    if (!results.length) continue
    const r = results[0]
    const id = r.item.id
    const prev = scores.get(id)
    if (!prev || r.score < prev.bestScore) {
      scores.set(id, { item: r.item, bestScore: r.score, hits: (prev?.hits || 0) + 1 })
    } else if (prev) {
      prev.hits++
    }
  }

  if (scores.size === 0) return null

  // Elegir el provider con más hits; en empate, el de menor score (mejor match)
  let best = null
  for (const entry of scores.values()) {
    if (
      !best ||
      entry.hits > best.hits ||
      (entry.hits === best.hits && entry.bestScore < best.bestScore)
    ) {
      best = entry
    }
  }

  const confidence = +(1 - best.bestScore).toFixed(2)
  if (confidence < 0.4) return null

  return {
    provider_id: best.item.id,
    name: best.item.name,
    confidence,
    method: 'fuzzy'
  }
}

// Normaliza una fecha detectada a formato yyyy-mm-dd para el input type="date"
const normalizeDate = (m, d, y) => {
  const month = m.padStart(2, '0')
  const day   = d.padStart(2, '0')
  const year  = y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y
  return `${year}-${month}-${day}`
}

const DATE_RE_SRC = '(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})'
const parseDateMatch = (m, offset = 1) =>
  normalizeDate(m[offset], m[offset + 1], m[offset + 2])

const isRecentYear = (yyyy) => {
  const y = parseInt(yyyy)
  return y >= 2000 && y <= 2099
}

const extractDates = (text) => {
  let m
  const result = {}

  // --- DOS (cascada, para en el primer match) ---

  // Prioridad 1: rango explícito "DOS: 01/25/2023 - 01/26/2023"
  m = new RegExp(`DOS[\\s:]+${DATE_RE_SRC}\\s*[-–to]+\\s*${DATE_RE_SRC}`, 'gi').exec(text)
  if (m) {
    result.dosStart = parseDateMatch(m, 1)
    result.dosEnd   = parseDateMatch(m, 4)
  }

  // Prioridad 2: DOS single "DOS: 04/18/2026"
  if (!result.dosStart) {
    m = new RegExp(`DOS[\\s:]+${DATE_RE_SRC}`, 'gi').exec(text)
    if (m) result.dosStart = parseDateMatch(m, 1)
  }

  // Prioridad 3: "Date of Service" con o sin separador (formato tabla)
  if (!result.dosStart) {
    m = new RegExp(`Date\\s+of\\s+Service[:\\s]*${DATE_RE_SRC}(?:[^\\d]*${DATE_RE_SRC})?`, 'gi').exec(text)
    if (m) {
      result.dosStart = parseDateMatch(m, 1)
      if (m[4]) result.dosEnd = parseDateMatch(m, 4)
    }
  }

  // Prioridad 4: "Service Date" label
  if (!result.dosStart) {
    m = new RegExp(`Service\\s+Date[:\\s]*${DATE_RE_SRC}`, 'gi').exec(text)
    if (m) result.dosStart = parseDateMatch(m, 1)
  }

  // Fallback: todas las fechas recientes del documento
  if (!result.dosStart) {
    const allDates = []
    const allRe = new RegExp(DATE_RE_SRC, 'g')
    while ((m = allRe.exec(text)) !== null) {
      const month  = parseInt(m[1])
      const day    = parseInt(m[2])
      const yearRaw = m[3].length === 2 ? (parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`) : m[3]
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && isRecentYear(yearRaw)) {
        allDates.push(normalizeDate(m[1], m[2], m[3]))
      }
    }
    const sorted = [...new Set(allDates)].sort()
    if (sorted.length > 0) result.dosStart = sorted[0]
    if (sorted.length > 1) result.dosEnd   = sorted[sorted.length - 1]
  }

  // --- updateDate: siempre independiente del DOS ---
  m = new RegExp(
    `(?:statement\\s+date|printed\\s+date|updated?\\s+as\\s+of|as\\s+of\\s+date)[:\\s]*${DATE_RE_SRC}`,
    'gi'
  ).exec(text)
  if (m) result.updateDate = parseDateMatch(m, 1)

  return result
}

const prepareTextForClaude = (text) => {
  return text
    .slice(0, 3000)
    .replace(/^\s*[\d\s.\-|,$]{15,}\s*$/gm, '') // líneas que son tablas de números
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{4,}/g, '   ')
    .trim()
}

const analyzeDocument = async (filePath, providers) => {
  try {
    let text = await extractText(filePath)
    let usedOcr = false

    if (text.trim().length < OCR_THRESHOLD) {
      try {
        text = await ocrExtract(filePath)
        usedOcr = true
      } catch (ocrErr) {
        console.error('OCR fallback falló:', ocrErr.message)
      }
    }

    if (!text || text.trim().length === 0)
      return { suggestion: null, reason: 'No se pudo extraer texto del documento', extractedText: '' }

    const dates = extractDates(text)
    const flags = detectFlags(text)

    const exact = exactMatch(text, providers)
    if (exact) return { suggestion: exact, dates, flags, usedOcr, extractedText: text }

    const fuzzy = fuzzyMatch(text, providers)
    if (fuzzy) return { suggestion: fuzzy, dates, flags, usedOcr, extractedText: text }

    return { suggestion: null, dates, flags, usedOcr, reason: 'No se encontró coincidencia', extractedText: text }

  } catch (err) {
    console.error('Error en Doc Analyzer:', err.message)
    return { suggestion: null, reason: 'Error al procesar el documento', extractedText: '' }
  }
}

const AMBULANCE_PATTERNS = [
  /\bambulance\b/i,
  /\bEMS\b/,                          // uppercase solo — evita "systems"
  /\bEMT\b/,
  /\bparamedic/i,
  /\bemergency\s+medical\s+(service|transport)/i,
  /\bair\s+(transport|ambulance)/i,
  /\bground\s+transport/i,
  /\bmedical\s+transport/i,
]

const REFERRAL_PATTERNS = [
  /\bfollow[\s-]?up\s+provider/i,           // "Follow-Up Providers" section
  /\bfollow[\s-]?up\s+with\s+(dr\.|doctor|physician|specialist)/i,
  /\breferred?\s+to\s+(dr\.|doctor|specialist|another)/i,
  /\boutpatient\s+referral/i,
  /\bconsult(?:ation)?\s+with\b/i,
  /\bsee\s+(dr\.|doctor|specialist)\b/i,
  /\bscheduled?\s+(?:for\s+)?(?:follow[\s-]?up|appointment)\s+with/i,
]

const extractAmbulanceCompany = (text) => {
  const STOP = /(?=\s*(?:ambulance\b|to the|arrived|transported|,|\.|$))/i
  const NAME = '([A-Z][A-Za-z\\s&\\-\\.]{2,50}?)'
  const patterns = [
    // "transported by American Medical Response" (para antes de "ambulance")
    new RegExp(`transported\\s+(?:by|via)\\s+${NAME}(?=\\s+(?:ambulance|ems|fire|rescue|paramedic)|\\s*[,\\.\\n])`, 'i'),
    // "Ambulance Service: Broward County Fire Rescue"
    new RegExp(`ambulance\\s+(?:service\\s*)?[:\\-]\\s*${NAME}(?=[,\\.\\n]|$)`, 'i'),
    // "EMS: Sunstar Paramedics"
    new RegExp(`\\bEMS\\s*[:\\-]\\s*${NAME}(?=[,\\.\\n]|$)`),
    // "[Company] ambulance" — non-greedy expande hasta "ambulance", captura Fire Rescue si está en el nombre
    new RegExp(`${NAME}\\s+ambulance`, 'i'),
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const name = m[1].trim().replace(/\s{2,}/g, ' ')
      if (name.length > 2 && name.length < 60) return name
    }
  }
  return null
}

const detectFlags = (text) => {
  const hasAmbulance = AMBULANCE_PATTERNS.some(p => p.test(text))
  const ambulanceCompany = hasAmbulance ? extractAmbulanceCompany(text) : null

  const hasReferral = REFERRAL_PATTERNS.some(p => p.test(text))

  // Extraer nombres de proveedores referidos del bloque "Follow-Up Providers"
  const referrals = []
  const followUpBlock = text.match(/follow[\s-]?up\s+provider[s]?\s*\n([\s\S]{0,600}?)(?:\n\n|\f|billing|coding|document)/i)
  if (followUpBlock) {
    const SPECIALTY_LIST = 'internal medicine|cardiology|orthopedics|neurology|radiology|general surgery|psychiatry|pediatrics|dermatology|oncology|urology|nephrology|pulmonology|gastroenterology|physical therapy|chiropractic|pain management|ophthalmology|endocrinology'
    const TRAILING_SPECIALTY = new RegExp(`\\s*(${SPECIALTY_LIST})\\s*$`, 'gi')
    const HEADER_RE = /^(provider|specialty|contact|phone|name|providerspecialtycontact)$/i
    const PHONE_RE  = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}.*/g

    const lines = followUpBlock[1].split('\n').map(l => l.trim()).filter(l => l.length > 3)
    for (const line of lines) {
      if (HEADER_RE.test(line.replace(/\s/g, ''))) continue
      if (/^(dr\.|[A-Z][a-z]+\s+[A-Z]|[A-Z][a-z]+\s+(group|center|clinic|hospital|medical))/i.test(line)) {
        const name = line
          .replace(PHONE_RE, '')
          .replace(TRAILING_SPECIALTY, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
        if (name.length > 3) referrals.push(name)
      }
    }
  }

  return { hasAmbulance, ambulanceCompany, hasReferral, referrals }
}

module.exports = { analyzeDocument, extractDates, detectFlags, prepareTextForClaude }