const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')
const opentype = require('opentype.js')
const path = require('path')

const FONT_PATH = path.join(process.cwd(), 'assets', 'Aptos.ttf')

let font

try {
  font = opentype.loadSync(FONT_PATH)
} catch (err) {
  console.error('FONT LOAD ERROR:', err)
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text, maxChars) {
  const words = text.trim().split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    if (!line) {
      line = word
      continue
    }

    const test = line + ' ' + word

    if (test.length <= maxChars) {
      line = test
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)

  return lines.length ? lines : ['']
}

function textToPath(text, fontSize) {
  if (!font) {
    throw new Error('Aptos.ttf tidak ditemukan di assets/')
  }

  const pathObj = font.getPath(text, 0, 0, fontSize)

  return pathObj.toPathData(2)
}

function getFontSize(text) {
  if (text.length <= 15) return 78
  if (text.length <= 30) return 68
  if (text.length <= 50) return 58
  if (text.length <= 75) return 48
  if (text.length <= 100) return 40

  return 34
}

function createSvg(text) {
  const width = 512
  const height = 512

  const fontSize = getFontSize(text)

  const maxChars =
    text.length <= 25 ? 16 :
    text.length <= 50 ? 18 :
    text.length <= 80 ? 21 :
    24

  const lines = wrapText(text, maxChars)

  const lineHeight = fontSize * 1.12
  const totalHeight = lines.length * lineHeight

  let startY =
    (height - totalHeight) / 2 +
    fontSize

  const paths = []

  for (const line of lines) {
    const pathData = textToPath(line, fontSize)

    const tempPath = font.getPath(
      line,
      0,
      0,
      fontSize
    )

    const box = tempPath.getBoundingBox()

    const textWidth = box.x2 - box.x1

    const x = (width - textWidth) / 2 - box.x1

    const y = startY

    const translatedPath = font
      .getPath(line, x, y, fontSize)
      .toPathData(2)

    paths.push(`
      <path
        d="${translatedPath}"
        fill="#000000"
      />
    `)

    startY += lineHeight
  }

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="512"
      height="512"
      viewBox="0 0 512 512"
    >
      <rect
        x="0"
        y="0"
        width="512"
        height="512"
        fill="#ffffff"
      />

      ${paths.join('\n')}
    </svg>
  `
}

async function renderFrame(text) {
  const svg = createSvg(text)

  return sharp(Buffer.from(svg))
    .png()
    .raw()
    .toBuffer({
      resolveWithObject: true
    })
}

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

async function createGif(text) {
  const words = splitWords(text)

  if (!words.length) {
    throw new Error('Text tidak boleh kosong')
  }

  const frames = []

  for (let i = 1; i <= words.length; i++) {
    const currentText = words
      .slice(0, i)
      .join(' ')

    const frame = await renderFrame(currentText)

    frames.push(frame)
  }

  const encoder = new GIFEncoder(
    512,
    512,
    'neuquant',
    true
  )

  encoder.setRepeat(0)
  encoder.setQuality(10)

  encoder.start()

  for (const frame of frames) {
    encoder.setDelay(500)
    encoder.addFrame(frame.data)
  }

  const lastFrame = frames[frames.length - 1]

  encoder.setDelay(1800)
  encoder.addFrame(lastFrame.data)

  encoder.finish()

  return encoder.out.getData()
}

function getText(req) {
  if (req.method === 'GET') {
    return req.query?.text || ''
  }

  if (req.method === 'POST') {
    if (typeof req.body === 'string') {
      try {
        const body = JSON.parse(req.body)
        return body.text || ''
      } catch {
        return ''
      }
    }

    return req.body?.text || ''
  }

  return ''
}

module.exports = async (req, res) => {
  try {
    if (
      req.method !== 'GET' &&
      req.method !== 'POST'
    ) {
      return res.status(405).json({
        status: false,
        creator: 'Ndra09',
        error: 'Gunakan method GET atau POST'
      })
    }

    const text = String(
      getText(req)
    ).trim()

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'Parameter text wajib diisi',
        example:
          '/api/bratelegan?text=halo dunia'
      })
    }

    if (text.length > 300) {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'Text maksimal 300 karakter'
      })
    }

    if (!font) {
      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          'Font Aptos.ttf tidak ditemukan. Pastikan file ada di assets/Aptos.ttf'
      })
    }

    const result = await createGif(text)

    res.setHeader(
      'Content-Type',
      'image/gif'
    )

    res.setHeader(
      'Content-Disposition',
      'inline; filename="bratelegan.gif"'
    )

    res.setHeader(
      'Cache-Control',
      'no-store'
    )

    return res.status(200).send(result)

  } catch (error) {
    console.error(
      'BRAT ELEGAN ERROR:',
      error
    )

    return res.status(500).json({
      status: false,
      creator: 'Ndra09',
      error:
        error.message ||
        'Gagal membuat Brat Elegan'
    })
  }
}
