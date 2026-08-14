import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: pkg.author,
      error: "Method not allowed. Use POST instead."
    })
  }

  try {
    const { base64, text = "LUNAS" } = req.body

    if (!base64) {
      return res.status(400).json({
        status: false,
        creator: pkg.author,
        error: "Missing 'base64' parameter in request body."
      })
    }

    const imgBuffer = Buffer.from(base64, 'base64')
    const img = await loadImage(imgBuffer)

    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(img, 0, 0)

    const fontSize = Math.floor(img.width * 0.12)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.save()
    ctx.translate(img.width / 2, img.height / 2)
    ctx.rotate((-20 * Math.PI) / 180)

    const textWidth = ctx.measureText(text).width
    const padX = fontSize * 0.4
    const padY = fontSize * 0.2

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)'
    ctx.lineWidth = Math.max(4, fontSize * 0.08)
    ctx.strokeRect(-textWidth / 2 - padX, -fontSize / 2 - padY, textWidth + padX * 2, fontSize + padY * 2)

    ctx.fillText(text, 0, 0)
    ctx.restore()

    const resultBuffer = await canvas.toBuffer('image/jpeg')
    const resultBase64 = resultBuffer.toString('base64')

    return res.status(200).json({
      status: true,
      creator: pkg.author,
      result: {
        text: text,
        base64: resultBase64
      }
    })

  } catch (err) {
    return res.status(500).json({
      status: false,
      creator: pkg.author,
      error: err.message || "Failed to process image."
    })
  }
}
