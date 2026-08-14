import sharp from 'sharp'

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
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '').trim()
    const imgBuffer = Buffer.from(cleanBase64, 'base64')

    // Dapatkan Dimensi Gambar Asli
    const metadata = await sharp(imgBuffer).metadata()
    const width = metadata.width || 800
    const height = metadata.height || 800

    // Hitung Ukuran Teks & Stempel
    const fontSize = Math.floor(width * 0.1)
    const textLength = text.length
    const stampWidth = Math.floor(fontSize * textLength * 0.75 + fontSize)
    const stampHeight = Math.floor(fontSize * 1.5)

    // Buat Stempel menggunakan SVG
    const svgStamp = `
      <svg width="${stampWidth}" height="${stampHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect 
          x="4" 
          y="4" 
          width="${stampWidth - 8}" 
          height="${stampHeight - 8}" 
          fill="none" 
          stroke="rgba(220, 38, 38, 0.9)" 
          stroke-width="${Math.max(4, Math.floor(fontSize * 0.08))}" 
          rx="8" 
        />
        <text 
          x="50%" 
          y="50%" 
          font-family="sans-serif" 
          font-weight="bold" 
          font-size="${fontSize}px" 
          fill="rgba(220, 38, 38, 0.9)" 
          text-anchor="middle" 
          dominant-baseline="central"
        >
          ${text}
        </text>
      </svg>
    `

    // Putar/Miringkan SVG Stempel sebesar -20 derajat
    const rotatedStampBuffer = await sharp(Buffer.from(svgStamp))
      .rotate(-20, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()

    // Tempelkan Stempel Miring ke Tengah Gambar Utama
    const resultBuffer = await sharp(imgBuffer)
      .composite([{
        input: rotatedStampBuffer,
        gravity: 'center'
      }])
      .jpeg({ quality: 85 })
      .toBuffer()

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
