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
const SIZE = 512
const DELAY = 260
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

function wrapWords(words, maxChars = 16) {
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

function makeSvg(lines, visibleCount, currentWordIndex, totalWords) {
  const fontSize = lines.length <= 2 ? 76 : lines.length <= 3 ? 68 : lines.length <= 5 ? 58 : 48
  const lineHeight = Math.round(fontSize * 1.08)
  const totalHeight = lines.length * lineHeight
  const startY = Math.round((SIZE - totalHeight) / 2 + fontSize * 0.82)

  const fontFace = fs.existsSync(FONT_PATH)
    ? `<style>@font-face{font-family:NdraAptos;src:url('file://${FONT_PATH}')} text{font-family:NdraAptos,Arial,sans-serif;font-weight:900;}</style>`
    : `<style>text{font-family:Arial,sans-serif;font-weight:900;}</style>`

  let wordCounter = 0
  const nodes = []

  for (const [lineIndex, line] of lines.entries()) {
    const y = startY + lineIndex * lineHeight
    const words = line.split(' ')
    const gap = ' '

    const tspans = words.map(word => {
      const index = wordCounter++
      const visible = index < visibleCount
      const current = index === currentWordIndex
      let fill = '#111111'
      let opacity = '1'

      if (!visible) {
        fill = '#111111'
        opacity = '0'
      } else if (current) {
        fill = '#111111'
        opacity = '1'
      }

      return `<tspan fill="${fill}" opacity="${opacity}">${escapeXml(word)}</tspan>`
    }).join(gap)

    nodes.push(`<text x="256" y="${y}" text-anchor="middle" font-size="${fontSize}" letter-spacing="-1.2">${tspans}</text>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${fontFace}
  <rect width="512" height="512" fill="#ffffff"/>
  ${nodes.join('')}
</svg>`
}

async function createFrame(words, visibleCount, currentWordIndex) {
  const visibleWords = words.slice(0, visibleCount)
  const lines = wrapWords(visibleWords)
  const svg = makeSvg(lines, visibleCount, currentWordIndex, words.length)

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

async function createAnimatedWebp(text) {
  const words = splitWords(text)

  if (!words.length) throw new Error("Parameter 'text' wajib diisi")
  if (String(text).length > MAX_CHARS) throw new Error(`Maksimal ${MAX_CHARS} karakter`)
  if (words.length > MAX_WORDS) throw new Error(`Maksimal ${MAX_WORDS} kata`)

  const frames = []

  for (let i = 1; i <= words.length; i++) {
    frames.push(await createFrame(words, i, i - 1))
  }

  const finalFrame = await createFrame(words, words.length, -1)
  frames.push(finalFrame, finalFrame, finalFrame)

  const encoder = new GIFEncoder(SIZE, SIZE, 'neuquant', true)
  encoder.setDelay(DELAY)
  encoder.setRepeat(0)
  encoder.setQuality(10)
  encoder.start()

  for (const frame of frames) {
    const raw = await sharp(frame)
      .ensureAlpha()
      .raw()
      .toBuffer()
    encoder.addFrame(raw)
  }

  encoder.finish()
  const gifBuffer = encoder.out.getData()

  return sharp(gifBuffer, { animated: true })
    .webp({ quality: 90, effort: 4, loop: 0, delay: DELAY })
    .toBuffer()
}

function getText(req) {
  if (req.method === 'GET') {
    return req.query?.text || ''
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)?.text || ''
    } catch {
      return ''
    }
  }

  return req.body?.text || ''
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()

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

    return res.status(500).json({
      status: false,
      creator: CREATOR,
      error: error?.message || 'Terjadi kesalahan internal pada server'
    })
  }
}
