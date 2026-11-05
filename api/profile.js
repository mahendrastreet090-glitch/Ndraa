
const ALLOWED_HOSTS = [
  'pps.whatsapp.net',
  'pps-fallback.whatsapp.net'
]

const MAX_SIZE = 5 * 1024 * 1024
const TIMEOUT = 12000

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(405).json({
      status: false,
      creator: 'Ndra09',
      error: 'Method tidak diizinkan'
    })
  }

  const sendError = (status, error) => {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(status).json({
      status: false,
      creator: 'Ndra09',
      error
    })
  }

  const imageUrl = req.query.url

  if (!imageUrl || typeof imageUrl !== 'string') {
    return sendError(400, 'Parameter url wajib diisi')
  }

  let parsedUrl

  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    return sendError(400, 'URL gambar tidak valid')
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    !ALLOWED_HOSTS.includes(parsedUrl.hostname)
  ) {
    return sendError(403, 'Domain gambar tidak diizinkan')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, TIMEOUT)

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://web.whatsapp.com/'
      },
      signal: controller.signal,
      redirect: 'follow'
    })

    if (!response.ok) {
      return sendError(
        502,
        `Gagal mengambil gambar dari WhatsApp. HTTP ${response.status}`
      )
    }

    let finalUrl

    try {
      finalUrl = new URL(response.url)
    } catch {
      return sendError(502, 'Alamat gambar dari WhatsApp tidak valid')
    }

    if (
      finalUrl.protocol !== 'https:' ||
      !ALLOWED_HOSTS.includes(finalUrl.hostname)
    ) {
      return sendError(403, 'Redirect gambar tidak diizinkan')
    }

    const contentType = (
      response.headers.get('content-type') || ''
    ).split(';')[0].trim().toLowerCase()

    if (!contentType.startsWith('image/')) {
      return sendError(415, 'URL tidak mengembalikan file gambar')
    }

    const contentLength = Number(
      response.headers.get('content-length') || 0
    )

    if (contentLength > MAX_SIZE) {
      return sendError(413, 'Ukuran gambar melebihi batas 5 MB')
    }

    if (!response.body) {
      return sendError(502, 'Data gambar tidak ditemukan')
    }

    const reader = response.body.getReader()
    const chunks = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      totalSize += value.length

      if (totalSize > MAX_SIZE) {
        await reader.cancel()
        return sendError(413, 'Ukuran gambar melebihi batas 5 MB')
      }

      chunks.push(Buffer.from(value))
    }

    if (!totalSize) {
      return sendError(502, 'Gambar kosong')
    }

    const imageBuffer = Buffer.concat(chunks, totalSize)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', imageBuffer.length)
    res.setHeader('X-Content-Type-Options', 'nosniff')

    res.setHeader(
      'Cache-Control',
      'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'
    )

    res.setHeader(
      'Vercel-CDN-Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=604800'
    )

    return res.status(200).send(imageBuffer)

  } catch (error) {
    const isTimeout = error.name === 'AbortError'

    return sendError(
      isTimeout ? 504 : 502,
      isTimeout
        ? 'Waktu pengambilan gambar habis'
        : 'Gagal mengambil foto profil'
    )

  } finally {
    clearTimeout(timeout)
  }
}
