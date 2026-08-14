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

    // 1. Upload Gambar Asli ke tmpfiles Dulu
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

    const rawUrl = uploadData.data.url
    const directOriginalUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')

    // 2. Tempelkan Stempel LUNAS via QuickChart Image Overlay Engine (Ringan & Gratis)
    const stampedImageUrl = `https://quickchart.io/watermark?imageUrl=${encodeURIComponent(directOriginalUrl)}&text=${encodeURIComponent(text)}&color=dc2626&opacity=0.85&fontSize=60`

    // 3. Download Hasil Gambar Berstempel & Upload Ulang ke tmpfiles
    const stampedFetch = await fetch(stampedImageUrl)
    const stampedArrayBuffer = await stampedFetch.arrayBuffer()

    const formDataFinal = new FormData()
    const finalBlob = new Blob([stampedArrayBuffer], { type: 'image/jpeg' })
    formDataFinal.append('file', finalBlob, 'stamped.jpg')

    const finalUploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formDataFinal
    })

    const finalUploadData = await finalUploadRes.json()
    const finalRawUrl = finalUploadData.data.url
    const finalDirectUrl = finalRawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')

    // Output Respon JSON
    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: text,
        url_gambar: finalDirectUrl
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
