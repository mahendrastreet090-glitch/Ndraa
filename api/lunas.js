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
// UPLOAD CATBOX
// ============================================

async function uploadCatbox(buffer) {
  const formData = new FormData()

  formData.append('reqtype', 'fileupload')

  const blob = new Blob(
    [buffer],
    { type: 'image/jpeg' }
  )

  formData.append(
    'fileToUpload',
    blob,
    'ndra-stempel.jpg'
  )

  const response = await fetch(
    'https://catbox.moe/user/api.php',
    {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
      }
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

// ============================================
// AMBIL GAMBAR DARI URL
// ============================================

async function downloadImage(url) {
  let parsed

  try {
    parsed = new URL(url)
  } catch {
    throw new Error('URL gambar tidak valid')
  }

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    throw new Error(
      'URL hanya boleh menggunakan HTTP/HTTPS'
    )
  }

  const controller =
    new AbortController()

  const timeout = setTimeout(
    () => controller.abort(),
    15000
  )

  try {
    const response = await fetch(
      url,
      {
        signal: controller.signal,
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
      !contentType.toLowerCase().startsWith('image/')
    ) {
      throw new Error(
        'URL tersebut bukan file gambar'
      )
    }

    const arrayBuffer =
      await response.arrayBuffer()

    return Buffer.from(arrayBuffer)

  } finally {
    clearTimeout(timeout)
  }
}

// ============================================
// AMBIL BUFFER DARI BASE64
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

  let clean = base64.trim()

  // Hapus data:image/jpeg;base64,...
  clean = clean.replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/i,
    ''
  )

  // Hilangkan whitespace
  clean = clean.replace(/\s/g, '')

  if (!clean) {
    throw new Error(
      'Base64 gambar kosong'
    )
  }

  const buffer =
    Buffer.from(clean, 'base64')

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
  width,
  height,
  text
}) {

  const safeText =
    escapeXml(text)

  // Ukuran cap
  const stampWidth =
    Math.round(width * 0.72)

  const stampHeight =
    Math.round(stampWidth * 0.36)

  // Posisi cap
  const centerX =
    Math.round(width / 2)

  const centerY =
    Math.round(height / 2)

  // Border
  const outerStroke =
    Math.max(
      8,
      Math.round(stampWidth * 0.035)
    )

  const innerStroke =
    Math.max(
      3,
      Math.round(stampWidth * 0.012)
    )

  const radius =
    Math.round(stampHeight * 0.18)

  const innerGap =
    Math.round(stampWidth * 0.045)

  // Font utama
  let fontSize =
    Math.round(
      stampHeight * 0.48
    )

  // Batasi agar teks panjang tidak keluar
  const estimatedWidth =
    safeText.length *
    fontSize *
    0.65

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
          safeText.length * 0.65
        )
      )
  }

  fontSize =
    Math.max(
      20,
      fontSize
    )

  // By Ndra Store
  const byFontSize =
    Math.max(
      14,
      Math.round(
        stampWidth * 0.055
      )
    )

  const byY =
    stampHeight +
    Math.round(
      stampHeight * 0.23
    )

  const svgWidth =
    stampWidth

  const svgHeight =
    byY +
    Math.round(
      byFontSize * 1.4
    )

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${svgWidth}"
  height="${svgHeight}"
  viewBox="0 0 ${svgWidth} ${svgHeight}"
>

  <!--
    STEMPEL UTAMA
  -->

  <rect
    x="${outerStroke / 2}"
    y="${outerStroke / 2}"
    width="${stampWidth - outerStroke}"
    height="${stampHeight - outerStroke}"
    rx="${radius}"
    ry="${radius}"
    fill="rgba(255,255,255,0.04)"
    stroke="#d62828"
    stroke-width="${outerStroke}"
  />

  <!-- Border Dalam -->

  <rect
    x="${outerStroke + innerGap}"
    y="${outerStroke + innerGap}"
    width="${stampWidth - ((outerStroke + innerGap) * 2)}"
    height="${stampHeight - ((outerStroke + innerGap) * 2)}"
    rx="${Math.max(5, radius - 5)}"
    ry="${Math.max(5, radius - 5)}"
    fill="none"
    stroke="#d62828"
    stroke-width="${innerStroke}"
  />

  <!--
    TEKS LUNAS

    Sengaja menggunakan font generik
    agar tidak bergantung CDN/font eksternal.
  -->

  <text
    x="${stampWidth / 2}"
    y="${stampHeight / 2}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}px"
    font-weight="bold"
    fill="#d62828"
    text-anchor="middle"
    dominant-baseline="middle"
    textLength="0"
  >${safeText}</text>


  <!--
    BY NDRA STORE
  -->

  <text
    x="${stampWidth / 2}"
    y="${byY}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${byFontSize}px"
    font-weight="bold"
    fill="#000000"
    text-anchor="middle"
    dominant-baseline="middle"
  >By Ndra Store</text>

</svg>
`
}

// ============================================
// BUAT WATERMARK TAMBAHAN
// ============================================

function createWatermarkSvg({
  width,
  height
}) {

  const fontSize =
    Math.max(
      12,
      Math.round(
        Math.min(width, height) *
        0.025
      )
    )

  const margin =
    Math.round(
      Math.min(width, height) *
      0.025
    )

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
>
  <text
    x="${width - margin}"
    y="${height - margin}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}px"
    font-weight="bold"
    fill="#ffffff"
    stroke="#000000"
    stroke-width="1.5"
    text-anchor="end"
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

  // OPTIONS
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
    // INPUT
    // ======================================

    const body =
      req.body || {}

    const base64 =
      body.base64

    const url =
      body.url

    const text =
      body.text

    // ======================================
    // VALIDASI
    // ======================================

    if (!base64 && !url) {

      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error:
          "Parameter 'base64' atau 'url' wajib diisi"
      })

    }

    // ======================================
    // TEKS
    // ======================================

    let stampText =
      String(
        text || 'LUNAS'
      ).trim()

    if (!stampText) {
      stampText = 'LUNAS'
    }

    stampText =
      stampText
        .substring(0, 50)
        .toUpperCase()

    // ======================================
    // AMBIL GAMBAR
    // ======================================

    let imageBuffer

    if (base64) {

      imageBuffer =
        decodeBase64(base64)

    } else {

      imageBuffer =
        await downloadImage(url)

    }

    // ======================================
    // VALIDASI GAMBAR DENGAN SHARP
    // ======================================

    const metadata =
      await sharp(imageBuffer)
        .metadata()

    if (
      !metadata.width ||
      !metadata.height
    ) {

      return res.status(400).json({
        status: false,
        creator: CREATOR,
        error:
          'Gambar tidak valid'
      })

    }

    const originalWidth =
      metadata.width

    const originalHeight =
      metadata.height

    // ======================================
    // NORMALISASI GAMBAR
    // ======================================

    const normalizedImage =
      await sharp(imageBuffer)
        .rotate()
        .toBuffer()

    const normalizedMetadata =
      await sharp(normalizedImage)
        .metadata()

    const width =
      normalizedMetadata.width

    const height =
      normalizedMetadata.height

    // ======================================
    // BUAT STEMPEL
    // ======================================

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

    // ======================================
    // SVG
    // ======================================

    const stampSvg =
      createStampSvg({
        width,
        height,
        text: stampText
      })

    // ======================================
    // RENDER SVG
    // ======================================

    const stampBuffer =
      await sharp(
        Buffer.from(
          stampSvg
        )
      )
      .png()
      .toBuffer()

    // ======================================
    // ROTASI STEMPEL
    // ======================================

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

    // ======================================
    // WATERMARK BAWAH KANAN
    // ======================================

    const watermarkSvg =
      createWatermarkSvg({
        width,
        height
      })

    const watermarkBuffer =
      Buffer.from(
        watermarkSvg
      )

    // ======================================
    // COMPOSITE
    // ======================================

    const processedImage =
      await sharp(
        normalizedImage
      )
      .composite([

        // STEMPEL DI TENGAH
        {
          input: rotatedStamp,
          gravity: 'center'
        },

        // WATERMARK
        {
          input: watermarkBuffer,
          top: 0,
          left: 0
        }

      ])
      .jpeg({
        quality: 92,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer()

    // ======================================
    // UPLOAD CATBOX
    // ======================================

    const imageUrl =
      await uploadCatbox(
        processedImage
      )

    // ======================================
    // RESPONSE
    // ======================================

    return res.status(200).json({

      status: true,

      creator: CREATOR,

      result: {

        text: stampText,

        url_gambar:
          imageUrl,

        original_size: {
          width:
            originalWidth,
          height:
            originalHeight
        },

        output_size: {
          width,
          height
        }

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
        error?.message ||
        'Terjadi kesalahan internal pada server'

    })

  }

}