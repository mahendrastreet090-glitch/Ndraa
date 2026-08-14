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

    // Mengambil Base64 (yang sudah ada stempelnya dari frontend/canvas)
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '').trim()
    const imgBuffer = Buffer.from(cleanBase64, 'base64')

    // Upload Gambar Berstempel ke Qu.ax
    const formData = new FormData()
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' })
    
    // PERHATIKAN: Qu.ax mewajibkan nama 'files[]' agar file terbaca sempurna
    formData.append('files[]', blob, 'stamped_image.jpg')

    const uploadRes = await fetch('https://qu.ax/upload.php', {
      method: 'POST',
      body: formData
    })

    const uploadData = await uploadRes.json()

    if (!uploadData || !uploadData.files || !uploadData.files[0] || !uploadData.files[0].url) {
      throw new Error("Gagal mengunggah gambar ke Qu.ax")
    }

    // Direct URL gambar berstempel dari Qu.ax
    const directUrl = uploadData.files[0].url

    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: text,
        url_gambar: directUrl,
        base64: `data:image/jpeg;base64,${cleanBase64}` // dikirim kembali untuk cadangan bot
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
