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

    // Upload Gambar Berstempel ke tmpfiles.org
    const formData = new FormData()
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' })
    formData.append('file', blob, 'stamped_image.jpg')

    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    })

    const uploadData = await uploadRes.json()

    if (!uploadData || !uploadData.data || !uploadData.data.url) {
      throw new Error("Gagal mengunggah gambar ke tmpfiles")
    }

    const rawUrl = uploadData.data.url
    const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')

    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: text,
        url_gambar: directUrl
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
