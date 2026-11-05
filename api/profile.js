
const ALLOWED_HOSTS = [
  'pps.whatsapp.net',
  'pps-fallback.whatsapp.net'
]

const MAX_SIZE = 5 * 1024 * 1024
const TIMEOUT = 15000

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: false,
      creator: 'Ndra09',
      error: 'Method tidak diizinkan'
    })
  }

  try {
    const imageUrl = req.query.url

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'Parameter url wajib diisi',
        example: '/api/profile?url=https://pps.whatsapp.net/foto.jpg'
      })
    }

    let parsedUrl

    try {
      parsedUrl = new URL(imageUrl)
    } catch {
      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error: 'URL gambar tidak valid'
      })
    }

    if (
      parsedUrl.protocol !== 'https:' ||
      !ALLOWED_HOSTS.includes(parsedUrl.hostname)
    ) {
      return res.status(403).json({
        status: false,
        creator: 'Ndra09',
        error: 'Domain gambar tidak diizinkan'
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, TIMEOUT)

    let response

    try {
      response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': 'https://web.whatsapp.com/'
        },
        signal: controller.signal,
        redirect: 'follow'
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      return res.status(502).json({
        status: false,
        creator: 'Ndra09',
        error: `Gagal mengambil gambar dari WhatsApp. HTTP ${response.status}`
      })
    }

    const finalUrl = new URL(response.url)

    if (
      finalUrl.protocol !== 'https:' ||
      !ALLOWED_HOSTS.includes(finalUrl.hostname)
    ) {
      return res.status(403).json({
        status: false,
        creator: 'Ndra09',
        error: 'Redirect gambar tidak diizinkan'
      })
    }

    const contentType = (
      response.headers.get('content-type') || ''
    ).split(';')[0].trim().toLowerCase()

    if (!contentType.startsWith('image/')) {
      return res.status(415).json({
        status: false,
        creator: 'Ndra09',
        error: 'URL tidak mengembalikan file gambar'
      })
    }

    const contentLength = Number(
      response.headers.get('content-length') || 0
    )

    if (contentLength > MAX_SIZE) {
      return res.status(413).json({
        status: false,
        creator: 'Ndra09',
        error: 'Ukuran gambar melebihi batas 5 MB'
      })
    }

    const imageBuffer = Buffer.from(
      await response.arrayBuffer()
    )

    if (!imageBuffer.length) {
      return res.status(502).json({
        status: false,
        creator: 'Ndra09',
        error: 'Gambar kosong'
      })
    }

    if (imageBuffer.length > MAX_SIZE) {
      return res.status(413).json({
        status: false,
        creator: 'Ndra09',
        error: 'Ukuran gambar melebihi batas 5 MB'
      })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', imageBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    return res.status(200).send(imageBuffer)

  } catch (error) {
    console.error('[PROFILE API ERROR]', error)

    const isTimeout = error.name === 'AbortError'

    return res.status(isTimeout ? 504 : 500).json({
      status: false,
      creator: 'Ndra09',
      error: isTimeout
        ? 'Waktu pengambilan gambar habis'
        : error.message || 'Gagal mengambil foto profil'
    })
  }
}
