const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const GIFEncoder = require('gif-encoder-2')

const CREATOR = 'Ndra09'
const FONT_PATH = path.join(process.cwd(), 'assets', 'Aptos.ttf')
const SIZE = 512
const DELAY = 300
const MAX_WORDS = 40
const MAX_CHARS = 500

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
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function wrapWords(words, maxChars) {
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || next.length <= maxChars) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)
  return lines
}

function getLayout(words) {
  const longest = Math.max(...words.map(w => w.length), 1)
  let maxChars = 15
  if (longest >= 24) maxChars = 12
  else if (longest >= 18) maxChars = 13
  else if (longest >= 14) maxChars = 14

  const lines = wrapWords(words, maxChars)
  const fontSize = lines.length <= 2 ? 74 : lines.length <= 3 ? 66 : lines.length <= 4 ? 58 : 50
  const lineHeight = Math.round(fontSize * 1.08)
  const totalHeight = lines.length * lineHeight
  const startY = Math.round((SIZE - totalHeight) / 2 + fontSize * 0.82)

  return { lines, fontSize, lineHeight, startY }
}

function makeSvg(words, visibleCount, layout) {
  const { lines, fontSize, lineHeight, startY } = layout
  let wordIndex = 0
  const nodes = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const wordsInLine = lines[lineIndex].split(' ')
    const y = startY + lineIndex * lineHeight
    const parts = []

    for (const word of wordsInLine) {
      const index = wordIndex++
      const visible = index < visibleCount
      const fill = visible ? '#111111' : '#ffffff'
      parts.push(`<tspan fill="${fill}">${escapeXml(word)}</tspan>`)
      if (word !== wordsInLine[wordsInLine.length - 1]) parts.push('<tspan fill="#ffffff"> </tspan>')
    }

    nodes.push(`<text x="256" y="${y}" text-anchor="middle">${parts.join('')}</text>`)
  }

  const fontStyle = `<style>text{font-family:"DejaVu Sans",sans-serif;font-weight:700;}</style>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${fontStyle}
  <rect width="512" height="512" fill="#ffffff"/>
  ${nodes.join('')}
</svg>`
}

async function createFrame(words, visibleCount, layout) {
  const svg = makeSvg(words, visibleCount, layout)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function createAnimatedWebp(text) {
  const words = splitWords(text)

  if (!words.length) throw new Error("Parameter 'text' wajib diisi")
  if (String(text).length > MAX_CHARS) throw new Error(`Maksimal ${MAX_CHARS} karakter`)
  if (words.length > MAX_WORDS) throw new Error(`Maksimal ${MAX_WORDS} kata`)

  const layout = getLayout(words)
  const frames = []

  for (let i = 1; i <= words.length; i++) {
    frames.push(await createFrame(words, i, layout))
  }

  const finalFrame = await createFrame(words, words.length, layout)
  frames.push(finalFrame, finalFrame, finalFrame)

  const encoder = new GIFEncoder(SIZE, SIZE, 'neuquant', false)
  encoder.setDelay(DELAY)
  encoder.setRepeat(0)
  encoder.setQuality(10)
  encoder.start()

  for (const frame of frames) {
    const raw = await sharp(frame).ensureAlpha().raw().toBuffer()
    encoder.addFrame(raw)
  }

  encoder.finish()
  const gifBuffer = encoder.out.getData()

  return sharp(gifBuffer, { animated: true })
    .webp({ quality: 92, effort: 4, loop: 0, delay: DELAY })
    .toBuffer()
}

function getText(req) {
  if (req.method === 'GET') return req.query?.text || ''

  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body)
      return parsed?.text || ''
    } catch {
      return ''
    }
  }

  return req.body?.text || ''
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ status: false, creator: CREATOR, error: 'Gunakan method GET atau POST' })
  }

  try {
    const text = String(getText(req) || '').trim()
    if (!text) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error: "Parameter 'text' wajib diisi",
        example: '/api/bratelegan?text=halo%20dunia'
      })
    }

    const image = await createAnimatedWebp(text)
    res.setHeader('Content-Type', 'image/webp')
    res.setHeader('Content-Length', image.length)
    res.setHeader('Content-Disposition', 'inline; filename="bratelegan.webp"')
    return res.status(200).send(image)
  } catch (error) {
    console.error('[BRAT ELEGAN API ERROR]', error)
    return res.status(500).json({ status: false, creator: CREATOR, error: error?.message || 'Terjadi kesalahan internal pada server' })
  }
}
