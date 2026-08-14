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
    const imgBuffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), 'base64')
    const image = await Jimp.read(imgBuffer)

    // Ukuran gambar
    const width = image.bitmap.width
    const height = image.bitmap.height

    // Pilih Font berdasarkan skala gambar
    const fontSize = Math.floor(width * 0.1)
    let font = Jimp.FONT_SANS_64_WHITE
    if (fontSize < 32) font = Jimp.FONT_SANS_32_WHITE
    else if (fontSize > 100) font = Jimp.FONT_SANS_128_WHITE

    const loadedFont = await Jimp.loadFont(font)

    // Buat layer teks/stempel baru
    const stamp = new Jimp(width, height, 0x00000000)

    // Tulis teks merah di tengah
    const textWidth = Jimp.measureText(loadedFont, text)
    const textHeight = Jimp.measureTextHeight(loadedFont, text, width)
    
    // Warnai teks jadi merah & cetak
    const redText = new Jimp(textWidth + 40, textHeight + 20, 0x00000000)
    redText.print(loadedFont, 20, 10, text)
    redText.color([{ apply: 'xor', params: ['#DC2626'] }]) // Warna merah

    // Gambar Bingkai Kotak Stempel
    const borderWidth = Math.max(4, Math.floor(fontSize * 0.08))
    redText.scan(0, 0, redText.bitmap.width, redText.bitmap.height, function(x, y, idx) {
      const isBorder = x < borderWidth || x >= redText.bitmap.width - borderWidth ||
                       y < borderWidth || y >= redText.bitmap.height - borderWidth;
      if (isBorder) {
        this.bitmap.data[idx] = 220;     // R
        this.bitmap.data[idx + 1] = 38;  // G
        this.bitmap.data[idx + 2] = 38;  // B
        this.bitmap.data[idx + 3] = 217; // Alpha (85%)
      }
    });

    // Miringkan stempel -20 derajat
    redText.rotate(20, false)

    // Tempelkan stempel ke tengah gambar utama
    const xPos = (width - redText.bitmap.width) / 2
    const yPos = (height - redText.bitmap.height) / 2
    image.composite(redText, xPos, yPos)

    // Convert hasil ke Base64
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
