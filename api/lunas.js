import PImage from 'pure-image'
import { Readable } from 'stream'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: "Ndra09",
      error: "Method not allowed. Use POST instead."
    })
  }

  try {
    const { base64, text = "LUNAS" } = req.body

    if (!base64) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "Missing 'base64' parameter in request body."
      })
    }

    // Decode Base64 ke Buffer
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
    const imgBuffer = Buffer.from(cleanBase64, 'base64')

    // Decode Image via Stream
    const stream = Readable.from(imgBuffer)
    let img;
    try {
      img = await PImage.decodeJPEGFromStream(stream)
    } catch {
      const streamPng = Readable.from(imgBuffer)
      img = await PImage.decodePNGFromStream(streamPng)
    }

    const width = img.width
    const height = img.height

    // Buat Canvas Baru
    const canvas = PImage.make(width, height)
    const ctx = canvas.getContext('2d')

    // Draw Gambar Asli
    ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height)

    // Pengaturan Stempel Merah
    const fontSize = Math.floor(width * 0.12)
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)'
    ctx.lineWidth = Math.max(4, Math.floor(fontSize * 0.08))

    // Buat Stempel di Tengah
    const padX = fontSize * 0.5
    const padY = fontSize * 0.25
    const rectWidth = (text.length * (fontSize * 0.6)) + (padX * 2)
    const rectHeight = fontSize + (padY * 2)

    const centerX = width / 2
    const centerY = height / 2

    // Gambarkan Kotak Stempel
    ctx.strokeRect(centerX - (rectWidth / 2), centerY - (rectHeight / 2), rectWidth, rectHeight)

    // Render ke PNG Buffer
    const outChunks = []
    const outStream = new (await import('stream')).Writable({
      write(chunk, encoding, callback) {
        outChunks.push(chunk)
        callback()
      }
    })

    await PImage.encodePNGToStream(canvas, outStream)
    const resultBuffer = Buffer.concat(outChunks)
    const resultBase64 = resultBuffer.toString('base64')

    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: text,
        base64: resultBase64
      }
    })

  } catch (err) {
    return res.status(500).json({
      status: false,
      creator: "Ndra09",
      error: err.message || "Failed to process image."
    })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
