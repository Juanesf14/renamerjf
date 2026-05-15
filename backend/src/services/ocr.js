const { createWorker } = require('tesseract.js')
const { createCanvas } = require('canvas')

// Renderiza la primera página del PDF a un PNG buffer
const pdfToImageBuffer = async (filePath) => {
  // pdfjs-dist v5 es ESM — usamos import() dinámico
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const loadingTask = pdfjsLib.getDocument({ url: `file://${filePath}`, verbosity: 0 })
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
  const imageBuffer = await pdfToImageBuffer(filePath)

  const worker = await createWorker('eng', 1, {
    logger: () => {},
    errorHandler: () => {},
  })

  const { data: { text } } = await worker.recognize(imageBuffer)
  await worker.terminate()

  return text || ''
}

module.exports = { ocrExtract }
