export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: "Ndra09",
      error: "Gunakan method POST"
    })
  }

  try {
    const { base64, text = "LUNAS" } = req.body

    if (!base64) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "Parameter 'base64' tidak boleh kosong!"
      })
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '').trim()
    const imgBuffer = Buffer.from(cleanBase64, 'base64')

    // 1. Upload Buffer Gambar ke tmpfiles.org
    const formData = new FormData()
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' })
    formData.append('file', blob, 'image.jpg')

    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    })

    const uploadData = await uploadRes.json()

    if (!uploadData || !uploadData.data || !uploadData.data.url) {
      throw new Error("Gagal mengunggah gambar ke tmpfiles")
    }

    // Ubah URL ke link direct download
    const rawUrl = uploadData.data.url
    const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')

    // 2. Buat Stempel SVG Transparan
    const svgStamp = `
      <svg width="500" height="250" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-15 250 125)">
          <rect x="20" y="20" width="460" height="210" rx="20" fill="none" stroke="#DC2626" stroke-width="12" stroke-opacity="0.85"/>
          <text x="50%" y="55%" font-family="sans-serif" font-weight="900" font-size="64" fill="#DC2626" fill-opacity="0.85" text-anchor="middle" dominant-baseline="central">${text}</text>
        </g>
      </svg>
    `
    const base64Svg = Buffer.from(svgStamp).toString('base64')

    // 3. Output Respon JSON
    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: text,
        url_gambar: directUrl,
        stempel_svg: `data:image/svg+xml;base64,${base64Svg}`
      }
    })

  } catch (err) {
    return res.status(500).json({
      status: false,
      creator: "Ndra09",
      error: err.message || "Gagal memproses di server Vercel"
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
