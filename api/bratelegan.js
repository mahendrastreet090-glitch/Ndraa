const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text, maxChars = 16) {
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

function createSvg(text) {
  const lines = wrapText(text, 17)

  const width = 512
  const height = 512

  let fontSize = 62

  if (text.length > 35) fontSize = 52
  if (text.length > 55) fontSize = 44
  if (text.length > 75) fontSize = 37
  if (text.length > 100) fontSize = 32

  const lineHeight = fontSize * 1.12
  const totalHeight = lines.length * lineHeight
  const startY = (height - totalHeight) / 2 + fontSize

  const textSvg = lines
    .map((line, index) => {
      const y = startY + index * lineHeight

      return `
        <text
          x="256"
          y="${y}"
          text-anchor="middle"
          font-family="DejaVu Sans, sans-serif"
          font-size="${fontSize}px"
          font-weight="700"
          fill="#000000"
        >${escapeXml(line)}</text>
      `
    })
    .join('')

  return `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="512"
        height="512"
        fill="#ffffff"
      />

      ${textSvg}
    </svg>
  `
}

async function renderFrame(text) {
  const svg = createSvg(text)

  return await sharp(Buffer.from(svg))
    .png()
    .raw()
    .toBuffer({ resolveWithObject: true })
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
    const currentText = words.slice(0, i).join(' ')
    const frame = await renderFrame(currentText)

    frames.push(frame)
  }

  const encoder = new GIFEncoder(512, 512, 'neuquant', true)

  encoder.setDelay(550)
  encoder.setRepeat(0)
  encoder.setQuality(10)

  encoder.start()

  for (const frame of frames) {
    encoder.addFrame(frame.data)
  }

  encoder.setDelay(1800)

  const lastFrame = frames[frames.length - 1]
  encoder.addFrame(lastFrame.data)

  encoder.finish()

  return encoder.out.getData()
}

function getText(req) {
  if (req.method === 'GET') {
    return (
      req.query?.text ||
      ''
    )
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
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        status: false,
        creator: 'Ndra09',
        error: 'Gunakan method GET atau POST'
      })
    }

    const text = String(getText(req)).trim()

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'Parameter text wajib diisi',
        example: '/api/bratelegan?text=halo dunia'
      })
    }

    if (text.length > 300) {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'Text maksimal 300 karakter'
      })
    }

    const result = await createGif(text)

    res.setHeader('Content-Type', 'image/gif')
    res.setHeader(
      'Content-Disposition',
      'inline; filename="bratelegan.gif"'
    )
    res.setHeader('Cache-Control', 'no-store')

    return res.status(200).send(result)

  } catch (error) {
    console.error('BRAT ELEGAN ERROR:', error)

    return res.status(500).json({
      status: false,
      creator: 'Ndra09',
      error: error.message || 'Gagal membuat Brat Elegan'
    })
  }
}
