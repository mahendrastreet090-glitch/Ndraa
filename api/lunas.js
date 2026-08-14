import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

// ============================================
// KONFIGURASI VERCEL
// ============================================

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

// API UPLOAD TERMAI
const TERMAI_UPLOAD_URL =
  'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk'

// ============================================
// LOKASI GAMBAR STEMPEL
// ============================================

// File:
// assets/lunas.png

const STAMP_PATH = path.join(
  process.cwd(),
  'assets',
  'lunas.png'
)

// ============================================
// CEK FILE STEMPEL
// ============================================

function getStampPath() {

  if (!fs.existsSync(STAMP_PATH)) {

    throw new Error(
      'File assets/lunas.png tidak ditemukan'
    )

  }

  return STAMP_PATH
}

// ============================================
// UPLOAD KE TERMAI
// ============================================

async function uploadTermai(imageBuffer) {

  const formData = new FormData()

  const blob = new Blob(
    [imageBuffer],
    {
      type: 'image/jpeg'
    }
  )

  formData.append(
    'file',
    blob,
    'ndra-lunas.jpg'
  )

  const response = await fetch(
    TERMAI_UPLOAD_URL,
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

  const result =
    await response.json()

  const imageUrl =
    result?.path ||
    result?.url ||
    result?.data?.url

  if (!imageUrl) {

    console.error(
      'Response Termai:',
      result
    )

    throw new Error(
      'Termai tidak mengembalikan URL gambar'
    )

  }

  return imageUrl
}

// ============================================
// DOWNLOAD GAMBAR DARI URL
// ============================================

async function downloadImage(url) {

  let parsedUrl

  try {

    parsedUrl =
      new URL(url)

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
      'URL hanya boleh HTTP atau HTTPS'
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
        `Gagal mengambil gambar HTTP ${response.status}`
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

    return Buffer.from(
      arrayBuffer
    )

  } finally {

    clearTimeout(timeout)

  }
}

// ============================================
// DECODE BASE64
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

  // data:image/jpeg;base64,...
  clean =
    clean.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/i,
      ''
    )

  // Hapus whitespace
  clean =
    clean.replace(
      /\s/g,
      ''
    )

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
// BUAT STEMPEL DARI ASSET
// ============================================

async function createStamp(
  imageWidth,
  imageHeight
) {

  const stampPath =
    getStampPath()

  // ==========================================
  // Baca asset lunas.png
  // ==========================================

  const stamp =
    sharp(stampPath)

  const stampMetadata =
    await stamp.metadata()

  if (
    !stampMetadata.width ||
    !stampMetadata.height
  ) {

    throw new Error(
      'assets/lunas.png tidak valid'
    )

  }

  // ==========================================
  // UKURAN STEMPEL
  // ==========================================

  const minDimension =
    Math.min(
      imageWidth,
      imageHeight
    )

  /*
   * 72% dari sisi terkecil gambar.
   *
   * Contoh:
   *
   * Foto 1080 x 1920
   * sisi terkecil = 1080
   * cap = sekitar 778px
   */

  const targetWidth =
    Math.round(
      minDimension * 0.72
    )

  // ==========================================
  // RESIZE STEMPEL
  // ==========================================

  const resizedStamp =
    await stamp
      .resize({
        width:
          targetWidth,

        fit:
          'inside',

        withoutEnlargement:
          false
      })
      .png()
      .toBuffer()

  // ==========================================
  // ROTASI STEMPEL
  // ==========================================

  const rotatedStamp =
    await sharp(
      resizedStamp
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

  return rotatedStamp
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

  if (
    req.method === 'OPTIONS'
  ) {

    return res
      .status(200)
      .end()

  }

  // ==========================================
  // METHOD
  // ==========================================

  if (
    req.method !== 'POST'
  ) {

    return res.status(405).json({

      status:
        false,

      creator:
        CREATOR,

      error:
        'Gunakan method POST'

    })

  }

  try {

    // ========================================
    // BODY
    // ========================================

    const body =
      req.body || {}

    const base64 =
      body.base64

    const url =
      body.url

    const text =
      body.text || 'LUNAS'

    // ========================================
    // VALIDASI INPUT
    // ========================================

    if (
      !base64 &&
      !url
    ) {

      return res.status(400).json({

        status:
          false,

        creator:
          CREATOR,

        error:
          "Parameter 'base64' atau 'url' wajib diisi"

      })

    }

    // ========================================
    // TEXT
    // ========================================

    const stampText =
      String(text)
        .trim()
        .substring(0, 50)
        .toUpperCase() || 'LUNAS'

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
    // NORMALISASI FOTO
    // ========================================

    const normalizedImage =
      await sharp(
        imageBuffer
      )
        .rotate()
        .toBuffer()

    // ========================================
    // METADATA
    // ========================================

    const metadata =
      await sharp(
        normalizedImage
      )
        .metadata()

    if (
      !metadata.width ||
      !metadata.height
    ) {

      return res.status(400).json({

        status:
          false,

        creator:
          CREATOR,

        error:
          'Gambar tidak valid'

      })

    }

    const width =
      metadata.width

    const height =
      metadata.height

    // ========================================
    // BUAT STEMPEL
    // ========================================

    const stampBuffer =
      await createStamp(
        width,
        height
      )

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
              stampBuffer,

            gravity:
              'center'
          }

        ])
        .jpeg({
          quality:
            94,

          chromaSubsampling:
            '4:4:4'
        })
        .toBuffer()

    // ========================================
    // UPLOAD TERMAI
    // ========================================

    const imageUrl =
      await uploadTermai(
        processedImage
      )

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({

      status:
        true,

      creator:
        CREATOR,

      result: {

        text:
          stampText,

        url_gambar:
          imageUrl,

        message:
          'Gambar berhasil diberi stempel',

        ukuran: {

          width:
            width,

          height:
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

      status:
        false,

      creator:
        CREATOR,

      error:
        error?.message ||
        'Terjadi kesalahan internal pada server'

    })

  }

}