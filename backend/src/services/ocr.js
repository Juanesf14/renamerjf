const { pathToFileURL } = require('url')

// Lazy loaders — evitan crash en Windows si canvas.node no es compatible
let _createCanvas = null
let _createWorker = null

function getCreateCanvas() {
  if (_createCanvas === null) {
    try {
      _createCanvas = require('canvas').createCanvas
    } catch (e) {
      console.warn('[ocr] canvas no disponible:', e.message)
      _createCanvas = false
    }
  }
  return _createCanvas || null
}

function getCreateWorker() {
  if (_createWorker === null) {
    try {
      _createWorker = require('tesseract.js').createWorker
    } catch (e) {
      console.warn('[ocr] tesseract.js no disponible:', e.message)
      _createWorker = false
    }
  }
  return _createWorker || null
}

// Renderiza la primera página del PDF a un PNG buffer
const pdfToImageBuffer = async (filePath) => {
  const createCanvas = getCreateCanvas()
  if (!createCanvas) throw new Error('canvas not available')

  // pdfjs-dist v5 es ESM — usamos import() dinámico
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const fileUrl = pathToFileURL(filePath).href
  const loadingTask = pdfjsLib.getDocument({ url: fileUrl, verbosity: 0 })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)

  const scale = 2.0
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')

  await page.render({
    canvasContext: ctx,
    viewport,
    canvasFactory: {
      create: (w, h) => {
        const c = createCanvas(w, h)
        return { canvas: c, context: c.getContext('2d') }
      },
      reset: (data, w, h) => {
        data.canvas.width  = w
        data.canvas.height = h
      },
      destroy: () => {},
    },
  }).promise

  return canvas.toBuffer('image/png')
}

const ocrExtract = async (filePath) => {
  const createWorker = getCreateWorker()
  if (!createWorker) return ''

  try {
    const imageBuffer = await pdfToImageBuffer(filePath)

    const worker = await createWorker('eng', 1, {
      logger: () => {},
      errorHandler: () => {},
    })

    const { data: { text } } = await worker.recognize(imageBuffer)
    await worker.terminate()

    return text || ''
  } catch (err) {
    console.warn('[ocr] extracción fallida:', err.message)
    return ''
  }
}

module.exports = { ocrExtract }
