import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import GIFEncoder from 'gif-encoder-2'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
}

const CREATOR = 'Ndra09'
const FONT_PATH = path.join(process.cwd(), 'assets', 'Aptos.ttf')

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function splitWords(text) {
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

function wrapWords(words, maxChars) {
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= maxChars || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)
  return lines
}

function buildSvg(lines, width, height, currentWordIndex, totalWords) {
  const safeLines = lines.map(line => escapeXml(line))
  const fontSize = safeLines.length <= 2 ? 92 : safeLines.length <= 4 ? 78 : 64
  const lineHeight = Math.round(fontSize * 1.02)
  const totalHeight = safeLines.length * lineHeight
  const startY = Math.round((height - totalHeight) / 2 + fontSize * 0.82)
  const fontFace = fs.existsSync(FONT_PATH)
    ? `<style>@font-face{font-family:'NdraAptos';src:url('file://${FONT_PATH}')} text{font-family:'NdraAptos','Arial Black',Arial,sans-serif;font-weight:900;}</style>`
    : `<style>text{font-family:'Arial Black',Arial,sans-serif;font-weight:900;}</style>`

  let wordCounter = 0
  const textNodes = safeLines.map((line, lineIndex) => {
    const words = line.split(' ')
    const lineWidthEstimate = Math.max(1, line.length) * fontSize * 0.52
    const x = Math.round(width / 2)
    const y = startY + lineIndex * lineHeight

    const parts = words.map(word => {
      const originalIndex = wordCounter++
      const isCurrent = originalIndex === currentWordIndex && currentWordIndex < totalWords
      const fill = isCurrent ? '#111111' : originalIndex < currentWordIndex ? '#111111' : '#b8b8b8'
      const opacity = originalIndex > currentWordIndex ? '0.18' : '1'
      return `<tspan fill="${fill}" opacity="${opacity}">${word}</tspan>`
    })

    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" letter-spacing="-1.5">${parts.join(' ')}</text>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${fontFace}
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${textNodes}
</svg>`
}

function makeFrameText(words, visibleCount) {
  const visibleWords = words.slice(0, visibleCount)
  const maxChars = 18
  return wrapWords(visibleWords, maxChars)
}

async function createFrame(words, visibleCount, currentWordIndex) {
  const lines = makeFrameText(words, visibleCount)
  const longest = Math.max(...lines.map(line => line.length), 1)
  const width = Math.max(512, Math.min(1024, 180 + longest * 42))
  const height = Math.max(512, Math.min(1024, 260 + lines.length * 105))

  const svg = buildSvg(
    lines,
    width,
    height,
    currentWordIndex,
    words.length
  )

  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createAnimatedWebp(text) {
  const words = splitWords(text)
  if (!words.length) throw new Error('Parameter text wajib diisi')
  if (words.length > 40) throw new Error('Maksimal 40 kata')

  const frameBuffers = []
  for (let i = 1; i <= words.length; i++) {
    frameBuffers.push(await createFrame(words, i, i - 1))
  }

  const lastFrame = await createFrame(words, words.length, -1)
  frameBuffers.push(lastFrame, lastFrame)

  const firstMeta = await sharp(frameBuffers[0]).metadata()
  const width = firstMeta.width || 512
  const height = firstMeta.height || 512

  const encoder = new GIFEncoder(width, height)
  encoder.setDelay(180)
  encoder.setRepeat(0)
  encoder.setQuality(10)
  encoder.start()

  for (const frame of frameBuffers) {
    const raw = await sharp(frame)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    encoder.addFrame(raw.data)
  }

  encoder.finish()
  const gifBuffer = encoder.out.getData()

  return sharp(gifBuffer, { animated: true })
    .webp({ quality: 88, effort: 4, loop: 0, delay: 180 })
    .toBuffer()
}

function getText(req) {
  if (req.method === 'GET') {
    return req.query?.text || ''
  }
  return req.body?.text || ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({
      status: false,
      creator: CREATOR,
      error: 'Gunakan method GET atau POST'
    })
  }

  try {
    const text = String(getText(req) || '').trim()

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error: "Parameter 'text' wajib diisi"
      })
    }

    const image = await createAnimatedWebp(text)

    res.setHeader('Content-Type', 'image/webp')
    res.setHeader('Content-Disposition', 'inline; filename="bratelegan.webp"')
    return res.status(200).send(image)
  } catch (error) {
    console.error('[BRAT ELEGAN API ERROR]', error)
    return res.status(500).json({
      status: false,
      creator: CREATOR,
      error: error?.message || 'Terjadi kesalahan internal pada server'
    })
  }
}
