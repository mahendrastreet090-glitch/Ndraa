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

    // Upload Gambar ke Catbox.moe
    const formData = new FormData()
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' })
    
    formData.append('reqtype', 'fileupload')
    formData.append('fileToUpload', blob, 'stamped_image.jpg')

    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData
    })

    const directUrl = (await uploadRes.text()).trim()

    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error("Gagal mengunggah gambar ke Catbox")
    }

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
