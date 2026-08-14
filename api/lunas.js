import sharp from 'sharp'
import { createCanvas } from '@napi-rs/canvas'

// ==========================================
// CONFIG VERCEL
// ==========================================

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

// ==========================================
// KONFIGURASI
// ==========================================

const CREATOR = 'Ndra09'
const WATERMARK = 'By Ndra Store'
const STAMP_COLOR = '#d62828'
const SUBTEXT_COLOR = '#000000'

// ==========================================
// HELPER: BASE64
// ==========================================

function base64ToBuffer(base64) {
  try {
    let clean = String(base64).trim()

    // Hilangkan prefix:
    // data:image/jpeg;base64,...
    // data:image/png;base64,...
    clean = clean.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/i,
      ''
    )

    // Hilangkan whitespace
    clean = clean.replace(/\s/g, '')

    if (!clean) {
      throw new Error('Base64 kosong')
    }

    const buffer = Buffer.from(clean, 'base64')

    if (!buffer.length) {
      throw new Error('Buffer kosong')
    }

    return buffer
  } catch (err) {
    throw new Error('Format Base64 tidak valid')
  }
}

// ==========================================
// HELPER: DOWNLOAD GAMBAR DARI URL
// ==========================================

async function downloadImage(url) {
  const parsed = new URL(url)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL harus menggunakan HTTP atau HTTPS')
  }

  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, 15000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'NDRA-OFFICIAL-API/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType =
      response.headers.get('content-type') || ''

    if (!contentType.toLowerCase().includes('image')) {
      throw new Error('URL bukan file gambar')
    }

    const arrayBuffer = await response.arrayBuffer()

    const buffer = Buffer.from(arrayBuffer)

    if (!buffer.length) {
      throw new Error('Gambar kosong')
    }

    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

// ==========================================
// CATBOX UPLOADER
// ==========================================

async function uploadCatbox(imageBuffer) {
  const formData = new FormData()

  formData.append('reqtype', 'fileupload')

  const blob = new Blob(
    [imageBuffer],
    {
      type: 'image/jpeg'
    }
  )

  formData.append(
    'fileToUpload',
    blob,
    'lunas.jpg'
  )

  const response = await fetch(
    'https://catbox.moe/user/api.php',
    {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData
    }
  )

  if (!response.ok) {
    throw new Error(
      `Catbox HTTP ${response.status}`
    )
  }

  const result = (
    await response.text()
  ).trim()

  if (!result.startsWith('http')) {
    throw new Error(
      `Catbox: ${result}`
    )
  }

  return result
}

// ==========================================
// BUAT GAMBAR STAMP MENGGUNAKAN CANVAS
// ==========================================

function createStampImage(
  text,
  minDimension
) {

  // ----------------------------------------
  // UKURAN STAMP
  // ----------------------------------------

  const stampWidth = Math.round(
    minDimension * 0.72
  )

  const stampHeight = Math.round(
    minDimension * 0.30
  )

  // ----------------------------------------
  // CANVAS
  // ----------------------------------------

  const canvas = createCanvas(
    stampWidth,
    stampHeight
  )

  const ctx = canvas.getContext('2d')

  // Supaya background transparan
  ctx.clearRect(
    0,
    0,
    stampWidth,
    stampHeight
  )

  // ----------------------------------------
  // BORDER
  // ----------------------------------------

  const outerPadding =
    Math.max(
      8,
      Math.round(stampWidth * 0.025)
    )

  const innerPadding =
    Math.max(
      18,
      Math.round(stampWidth * 0.055)
    )

  const outerRadius =
    Math.round(stampHeight * 0.14)

  const innerRadius =
    Math.round(stampHeight * 0.09)

  const outerLine =
    Math.max(
      5,
      Math.round(stampWidth * 0.022)
    )

  const innerLine =
    Math.max(
      3,
      Math.round(stampWidth * 0.010)
    )

  // ----------------------------------------
  // FUNGSI ROUNDED RECT
  // ----------------------------------------

  function roundedRect(
    x,
    y,
    width,
    height,
    radius
  ) {
    ctx.beginPath()

    ctx.moveTo(
      x + radius,
      y
    )

    ctx.lineTo(
      x + width - radius,
      y
    )

    ctx.quadraticCurveTo(
      x + width,
      y,
      x + width,
      y + radius
    )

    ctx.lineTo(
      x + width,
      y + height - radius
    )

    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    )

    ctx.lineTo(
      x + radius,
      y + height
    )

    ctx.quadraticCurveTo(
      x,
      y + height,
      x,
      y + height - radius
    )

    ctx.lineTo(
      x,
      y + radius
    )

    ctx.quadraticCurveTo(
      x,
      y,
      x + radius,
      y
    )

    ctx.closePath()
  }

  // ----------------------------------------
  // BACKGROUND TRANSPARAN
  // ----------------------------------------

  ctx.globalAlpha = 1

  // ----------------------------------------
  // BORDER LUAR
  // ----------------------------------------

  ctx.lineWidth = outerLine

  ctx.strokeStyle = STAMP_COLOR

  roundedRect(
    outerLine / 2,
    outerLine / 2,
    stampWidth - outerLine,
    stampHeight - outerLine,
    outerRadius
  )

  ctx.stroke()

  // ----------------------------------------
  // BORDER DALAM
  // ----------------------------------------

  const innerX =
    outerLine + innerPadding

  const innerY =
    outerLine + innerPadding * 0.65

  const innerWidth =
    stampWidth -
    (outerLine + innerPadding) * 2

  const innerHeight =
    stampHeight -
    (outerLine + innerPadding * 0.65) * 2

  ctx.lineWidth = innerLine

  ctx.strokeStyle = STAMP_COLOR

  roundedRect(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    innerRadius
  )

  ctx.stroke()

  // ----------------------------------------
  // HITUNG FONT
  // ----------------------------------------

  const availableWidth =
    stampWidth * 0.72

  let fontSize =
    Math.round(
      stampHeight * 0.46
    )

  // Cari ukuran font supaya teks
  // tidak keluar dari kotak

  while (fontSize > 16) {

    ctx.font =
      `900 ${fontSize}px Arial`

    const metrics =
      ctx.measureText(text)

    if (
      metrics.width <=
      availableWidth
    ) {
      break
    }

    fontSize--
  }

  // ----------------------------------------
  // TEKS LUNAS
  // ----------------------------------------

  ctx.font =
    `900 ${fontSize}px Arial`

  ctx.fillStyle =
    STAMP_COLOR

  ctx.textAlign =
    'center'

  ctx.textBaseline =
    'middle'

  // Sedikit naik agar terlihat
  // seimbang di dalam cap

  const textY =
    stampHeight * 0.48

  ctx.fillText(
    text,
    stampWidth / 2,
    textY
  )

  // ----------------------------------------
  // BY NDRA STORE
  // ----------------------------------------

  const smallFont =
    Math.max(
      12,
      Math.round(
        stampHeight * 0.075
      )
    )

  ctx.font =
    `700 ${smallFont}px Arial`

  ctx.fillStyle =
    SUBTEXT_COLOR

  ctx.textAlign =
    'center'

  ctx.textBaseline =
    'middle'

  ctx.fillText(
    WATERMARK,
    stampWidth / 2,
    stampHeight * 0.84
  )

  // ----------------------------------------
  // HASIL PNG TRANSPARAN
  // ----------------------------------------

  return canvas.toBuffer(
    'image/png'
  )
}

// ==========================================
// HANDLER API
// ==========================================

export default async function handler(
  req,
  res
) {

  // ========================================
  // CORS
  // ========================================

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  )

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  )

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  )

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ========================================
  // METHOD
  // ========================================

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: CREATOR,
      error: 'Gunakan method POST'
    })
  }

  try {

    // ======================================
    // REQUEST BODY
    // ======================================

    const body =
      req.body || {}

    const base64 =
      body.base64

    const imageUrl =
      body.url

    const inputText =
      body.text ?? 'LUNAS'

    // ======================================
    // VALIDASI INPUT
    // ======================================

    if (!base64 && !imageUrl) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error:
          "Parameter 'base64' atau 'url' wajib diisi"
      })
    }

    // ======================================
    // TEXT
    // ======================================

    const stampText =
      String(inputText)
        .trim()
        .toUpperCase() ||
      'LUNAS'

    // ======================================
    // AMBIL GAMBAR
    // ======================================

    let imageBuffer

    if (base64) {

      try {

        imageBuffer =
          base64ToBuffer(base64)

      } catch (error) {

        return res.status(400).json({
          status: false,
          creator: CREATOR,
          error:
            'Base64 gambar tidak valid'
        })

      }

    } else {

      try {

        imageBuffer =
          await downloadImage(
            imageUrl
          )

      } catch (error) {

        return res.status(400).json({
          status: false,
          creator: CREATOR,
          error:
            `Gagal mengambil gambar dari URL: ${error.message}`
        })

      }

    }

    // ======================================
    // NORMALISASI ORIENTASI
    // ======================================

    let normalizedBuffer

    try {

      normalizedBuffer =
        await sharp(imageBuffer)
          .rotate()
          .toBuffer()

    } catch (error) {

      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error:
          'File gambar rusak atau format tidak didukung'
      })

    }

    // ======================================
    // METADATA
    // ======================================

    const metadata =
      await sharp(
        normalizedBuffer
      ).metadata()

    const width =
      metadata.width || 800

    const height =
      metadata.height || 600

    const minDimension =
      Math.min(
        width,
        height
      )

    // ======================================
    // BUAT STAMP
    // ======================================

    const stampBuffer =
      createStampImage(
        stampText,
        minDimension
      )

    // ======================================
    // ROTATE STAMP
    // ======================================

    const rotatedStamp =
      await sharp(stampBuffer)
        .rotate(
          -12,
          {
            background: {
              r: 0,
              g: 0,
              b: 0,
              alpha: 0
            }
          }
        )
        .png()
        .toBuffer()

    // ======================================
    // COMPOSITE
    // ======================================

    const processedImageBuffer =
      await sharp(normalizedBuffer)
        .composite([
          {
            input: rotatedStamp,
            gravity: 'center'
          }
        ])
        .jpeg({
          quality: 92,
          mozjpeg: true
        })
        .toBuffer()

    // ======================================
    // UPLOAD CATBOX
    // ======================================

    let uploadedUrl

    try {

      uploadedUrl =
        await uploadCatbox(
          processedImageBuffer
        )

    } catch (error) {

      console.error(
        '[CATBOX ERROR]',
        error
      )

      return res.status(500).json({
        status: false,
        creator: CREATOR,
        error:
          `Gagal upload ke Catbox: ${error.message}`
      })

    }

    // ======================================
    // RESPONSE
    // ======================================

    return res.status(200).json({

      status: true,

      creator: CREATOR,

      message:
        'Gambar berhasil diberi stempel',

      result: {

        text: stampText,

        watermark:
          WATERMARK,

        url_gambar:
          uploadedUrl

      }

    })

  } catch (error) {

    console.error(
      '[LUNAS API ERROR]',
      error
    )

    return res.status(500).json({

      status: false,

      creator: CREATOR,

      error:
        error.message ||
        'Terjadi kesalahan internal server'

    })

  }

}
