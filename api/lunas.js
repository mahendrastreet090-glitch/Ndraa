import Jimp from 'jimp'
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

    // Decode Base64 ke Buffer
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
    const imgBuffer = Buffer.from(cleanBase64, 'base64')
    
    // Read Image dengan Jimp
    const image = await Jimp.read(imgBuffer)
    const width = image.bitmap.width
    const height = image.bitmap.height

    // Pilih ukuran Font berdasarkan lebar gambar
    let font = Jimp.FONT_SANS_64_WHITE
    if (width < 500) font = Jimp.FONT_SANS_32_WHITE
    else if (width > 1200) font = Jimp.FONT_SANS_128_WHITE

    const loadedFont = await Jimp.loadFont(font)

    // Tentukan dimensi teks
    const textWidth = Jimp.measureText(loadedFont, text)
    const textHeight = Jimp.measureTextHeight(loadedFont, text, width)

    // Buat Layer Stempel
    const padX = 30
    const padY = 15
    const stampWidth = textWidth + padX * 2
    const stampHeight = textHeight + padY * 2

    const stamp = new Jimp(stampWidth, stampHeight, 0x00000000)

    // Tulis Teks Stempel
    stamp.print(loadedFont, padX, padY, text)

    // Ubah warna teks menjadi merah (#DC2626)
    stamp.scan(0, 0, stampWidth, stampHeight, function(x, y, idx) {
      if (this.bitmap.data[idx + 3] > 0) { // Jika piksel berisi teks
        this.bitmap.data[idx] = 220;     // R
        this.bitmap.data[idx + 1] = 38;  // G
        this.bitmap.data[idx + 2] = 38;  // B
      }
    })

    // Buat Bingkai/Kotak Merah
    const border = Math.max(4, Math.floor(stampHeight * 0.08))
    stamp.scan(0, 0, stampWidth, stampHeight, function(x, y, idx) {
      const isBorder = x < border || x >= stampWidth - border || y < border || y >= stampHeight - border
      if (isBorder) {
        this.bitmap.data[idx] = 220;     // R
        this.bitmap.data[idx + 1] = 38;  // G
        this.bitmap.data[idx + 2] = 38;  // B
        this.bitmap.data[idx + 3] = 220; // Opasitas
      }
    })

    // Rotasi Stempel (-20 Derajat)
    stamp.rotate(20, false)

    // Posisi Tempel di Tengah
    const xPos = (width - stamp.bitmap.width) / 2
    const yPos = (height - stamp.bitmap.height) / 2

    image.composite(stamp, xPos, yPos)

    // Export Hasil
    const resultBuffer = await image.getBufferAsync(Jimp.MIME_JPEG)
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

// Izinkan payload berukuran hingga 10MB dari Bot WhatsApp
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
