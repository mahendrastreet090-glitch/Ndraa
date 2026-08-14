import sharp from 'sharp'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

// ============================================
// KONFIGURASI
// ============================================

const CREATOR = 'Ndra09'
const TERMAI_URL = 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk'

// ============================================
// ESCAPE XML
// ============================================

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ============================================
// UPLOAD KE C.TERMAI.CC
// ============================================

async function uploadTermai(buffer) {
  const formData = new FormData()

  const blob = new Blob(
    [buffer],
    {
      type: 'image/jpeg'
    }
  )

  formData.append(
    'file',
    blob,
    'ndra-stempel.jpg'
  )

  const response = await fetch(
    TERMAI_URL,
    {
      method: 'POST',

      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
      },

      body: formData
    }
  )

  if (!response.ok) {
    throw new Error(
      `Termai HTTP ${response.status}`
    )
  }

  const result = await response.json()

  console.log(
    '[TERMAI RESPONSE]',
    result
  )

  const fileUrl =
    result?.path ||
    result?.url ||
    result?.data?.url ||
    result?.data?.path

  if (!fileUrl) {
    throw new Error(
      'Termai tidak mengembalikan URL gambar'
    )
  }

  // Kalau Termai mengembalikan URL lengkap
  if (
    fileUrl.startsWith('http://') ||
    fileUrl.startsWith('https://')
  ) {
    return fileUrl
  }

  // Kalau hanya path
  return `https://c.termai.cc/${String(fileUrl).replace(/^\/+/, '')}`
}

// ============================================
// DOWNLOAD GAMBAR DARI URL
// ============================================

async function downloadImage(url) {
  let parsedUrl

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error(
      'URL gambar tidak valid'
    )
  }

  if (
    parsedUrl.protocol !== 'http:' &&
    parsedUrl.protocol !== 'https:'
  ) {
    throw new Error(
      'URL hanya boleh menggunakan HTTP/HTTPS'
    )
  }

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    )

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          headers: {
            'User-Agent':
              'Mozilla/5.0'
          }
        }
      )

    if (!response.ok) {
      throw new Error(
        `Gagal mengambil gambar (${response.status})`
      )
    }

    const contentType =
      response.headers.get(
        'content-type'
      ) || ''

    if (
      !contentType
        .toLowerCase()
        .startsWith('image/')
    ) {
      throw new Error(
        'URL tersebut bukan file gambar'
      )
    }

    const arrayBuffer =
      await response.arrayBuffer()

    const buffer =
      Buffer.from(arrayBuffer)

    if (!buffer.length) {
      throw new Error(
        'Gambar kosong'
      )
    }

    return buffer

  } finally {
    clearTimeout(timeout)
  }
}

// ============================================
// BASE64 → BUFFER
// ============================================

function decodeBase64(base64) {
  if (
    typeof base64 !== 'string' ||
    !base64.trim()
  ) {
    throw new Error(
      'Base64 gambar kosong'
    )
  }

  let clean =
    base64.trim()

  // Hapus prefix:
  // data:image/jpeg;base64,
  // data:image/png;base64,
  // dll
  clean =
    clean.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/i,
      ''
    )

  // Hapus spasi / newline
  clean =
    clean.replace(/\s/g, '')

  if (!clean) {
    throw new Error(
      'Base64 gambar kosong'
    )
  }

  const buffer =
    Buffer.from(
      clean,
      'base64'
    )

  if (!buffer.length) {
    throw new Error(
      'Base64 tidak valid'
    )
  }

  return buffer
}

// ============================================
// BUAT SVG STEMPEL
// ============================================

function createStampSvg({
  stampWidth,
  stampHeight,
  text
}) {

  const safeText =
    escapeXml(text)

  // ==========================================
  // STROKE
  // ==========================================

  const outerStroke =
    Math.max(
      7,
      Math.round(
        stampWidth * 0.035
      )
    )

  const innerStroke =
    Math.max(
      3,
      Math.round(
        stampWidth * 0.012
      )
    )

  const radius =
    Math.round(
      stampHeight * 0.18
    )

  const innerGap =
    Math.round(
      stampWidth * 0.045
    )

  // ==========================================
  // FONT
  // ==========================================

  let fontSize =
    Math.round(
      stampHeight * 0.50
    )

  // Estimasi lebar teks
  const estimatedWidth =
    safeText.length *
    fontSize *
    0.62

  const maxTextWidth =
    stampWidth * 0.78

  if (
    estimatedWidth >
    maxTextWidth
  ) {
    fontSize =
      Math.floor(
        maxTextWidth /
        Math.max(
          1,
          safeText.length * 0.62
        )
      )
  }

  fontSize =
    Math.max(
      18,
      fontSize
    )

  // ==========================================
  // BY NDRA STORE
  // ==========================================

  const byFontSize =
    Math.max(
      12,
      Math.round(
        stampWidth * 0.045
      )
    )

  const byY =
    stampHeight +
    Math.round(
      stampHeight * 0.18
    )

  const svgHeight =
    byY +
    Math.round(
      byFontSize * 1.5
    )

  // ==========================================
  // SVG
  // ==========================================

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${stampWidth}"
  height="${svgHeight}"
  viewBox="0 0 ${stampWidth} ${svgHeight}"
>

  <!-- =====================================
       STEMPEL LUAR
  ====================================== -->

  <rect
    x="${outerStroke / 2}"
    y="${outerStroke / 2}"
    width="${stampWidth - outerStroke}"
    height="${stampHeight - outerStroke}"
    rx="${radius}"
    ry="${radius}"
    fill="rgba(255,255,255,0.03)"
    stroke="#d62828"
    stroke-width="${outerStroke}"
  />

  <!-- =====================================
       STEMPEL DALAM
  ====================================== -->

  <rect
    x="${outerStroke + innerGap}"
    y="${outerStroke + innerGap}"
    width="${
      stampWidth -
      ((outerStroke + innerGap) * 2)
    }"
    height="${
      stampHeight -
      ((outerStroke + innerGap) * 2)
    }"
    rx="${Math.max(4, radius - 5)}"
    ry="${Math.max(4, radius - 5)}"
    fill="none"
    stroke="#d62828"
    stroke-width="${innerStroke}"
  />

  <!-- =====================================
       TEKS STEMPEL
       
       PENTING:
       JANGAN gunakan textLength="0"
  ====================================== -->

  <text
    x="${stampWidth / 2}"
    y="${stampHeight / 2}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}px"
    font-weight="900"
    fill="#d62828"
    text-anchor="middle"
    dominant-baseline="middle"
  >${safeText}</text>

  <!-- =====================================
       BY NDRA STORE
  ====================================== -->

  <text
    x="${stampWidth / 2}"
    y="${byY}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${byFontSize}px"
    font-weight="600"
    fill="#000000"
    text-anchor="middle"
    dominant-baseline="middle"
  >By Ndra Store</text>

</svg>
`
}

// ============================================
// HANDLER
// ============================================

export default async function handler(
  req,
  res
) {

  // ==========================================
  // CORS
  // ==========================================

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

  // ==========================================
  // OPTIONS
  // ==========================================

  if (req.method === 'OPTIONS') {
    return res
      .status(200)
      .end()
  }

  // ==========================================
  // METHOD
  // ==========================================

  if (req.method !== 'POST') {

    return res
      .status(405)
      .json({
        status: false,
        creator: CREATOR,
        error:
          'Gunakan method POST'
      })
  }

  try {

    // ========================================
    // INPUT
    // ========================================

    const body =
      req.body || {}

    const base64 =
      body.base64

    const url =
      body.url

    let text =
      body.text || 'LUNAS'

    // ========================================
    // VALIDASI INPUT
    // ========================================

    if (!base64 && !url) {

      return res
        .status(400)
        .json({
          status: false,
          creator: CREATOR,
          error:
            "Parameter 'base64' atau 'url' wajib diisi"
        })
    }

    // ========================================
    // TEKS STEMPEL
    // ========================================

    text =
      String(text)
        .trim()
        .substring(0, 50)

    if (!text) {
      text = 'LUNAS'
    }

    const stampText =
      text.toUpperCase()

    // ========================================
    // AMBIL GAMBAR
    // ========================================

    let imageBuffer

    if (base64) {

      imageBuffer =
        decodeBase64(base64)

    } else {

      imageBuffer =
        await downloadImage(url)

    }

    // ========================================
    // NORMALISASI GAMBAR
    //
    // rotate() otomatis memperbaiki EXIF
    // orientation foto HP.
    // ========================================

    const normalizedImage =
      await sharp(imageBuffer)
        .rotate()
        .toBuffer()

    // ========================================
    // METADATA
    // ========================================

    const metadata =
      await sharp(
        normalizedImage
      ).metadata()

    if (
      !metadata.width ||
      !metadata.height
    ) {

      return res
        .status(400)
        .json({
          status: false,
          creator: CREATOR,
          error:
            'Gambar tidak valid'
        })
    }

    const width =
      metadata.width

    const height =
      metadata.height

    // ========================================
    // UKURAN STEMPEL
    // ========================================

    const minDimension =
      Math.min(
        width,
        height
      )

    const stampWidth =
      Math.round(
        minDimension * 0.72
      )

    const stampHeight =
      Math.round(
        stampWidth * 0.36
      )

    // ========================================
    // BUAT SVG STEMPEL
    // ========================================

    const stampSvg =
      createStampSvg({
        stampWidth,
        stampHeight,
        text: stampText
      })

    // ========================================
    // RENDER SVG → PNG
    // ========================================

    const stampBuffer =
      await sharp(
        Buffer.from(stampSvg)
      )
      .png()
      .toBuffer()

    // ========================================
    // ROTASI STEMPEL
    // ========================================

    const rotatedStamp =
      await sharp(
        stampBuffer
      )
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

    // ========================================
    // COMPOSITE
    // ========================================

    const processedImage =
      await sharp(
        normalizedImage
      )
      .composite([
        {
          input:
            rotatedStamp,

          gravity:
            'center'
        }
      ])
      .jpeg({
        quality: 92,
        chromaSubsampling:
          '4:4:4'
      })
      .toBuffer()

    // ========================================
    // UPLOAD C.TERMAI.CC
    // ========================================

    const imageUrl =
      await uploadTermai(
        processedImage
      )

    // ========================================
    // RESPONSE
    // ========================================

    return res
      .status(200)
      .json({

        status: true,

        creator: CREATOR,

        result: {

          text:
            stampText,

          url_gambar:
            imageUrl,

          original_size: {
            width:
              width,
            height:
              height
          },

          stamp: {
            width:
              stampWidth,
            height:
              stampHeight,
            rotation:
              -12
          }

        }

      })

  } catch (error) {

    console.error(
      '[LUNAS API ERROR]',
      error
    )

    return res
      .status(500)
      .json({

        status: false,

        creator:
          CREATOR,

        error:
          error?.message ||
          'Terjadi kesalahan internal pada server'

      })
  }
}