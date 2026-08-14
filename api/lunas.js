import sharp from 'sharp';

// Helper fungsi untuk sanitasi/escape karakter khusus pada teks SVG
function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

// === UPLOADER UTAMA: Termai (c.termai.cc) ===
async function uploadTermai(imageBuffer) {
  const formData = new FormData();
  formData.append('file', new File([imageBuffer], 'stamped_image.jpg', { type: 'image/jpeg' }));

  const res = await fetch('https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: formData
  });

  if (!res.ok) throw new Error(`Termai HTTP Status: ${res.status}`);
  const json = await res.json();

  const fileUrl = json?.path || json?.url || json?.data?.url;
  if (!fileUrl) throw new Error('Response Termai tidak mengembalikan URL/path');

  return fileUrl;
}

// === UPLOADER CADANGAN 1: Catbox ===
async function uploadCatbox(imageBuffer) {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', new File([imageBuffer], 'stamped_image.jpg', { type: 'image/jpeg' }));

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: formData
  });

  if (!res.ok) throw new Error(`Catbox HTTP Status: ${res.status}`);
  const text = (await res.text()).trim();

  if (!text.startsWith('http')) {
    throw new Error(`Catbox Error Response: ${text}`);
  }
  return text;
}

// === UPLOADER CADANGAN 2: TmpFiles ===
async function uploadTmpFiles(imageBuffer) {
  const formData = new FormData();
  formData.append('file', new File([imageBuffer], 'stamped_image.jpg', { type: 'image/jpeg' }));

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: formData
  });

  if (!res.ok) throw new Error(`TmpFiles HTTP Status: ${res.status}`);
  const json = await res.json();

  if (json?.status === 'success' && json?.data?.url) {
    return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
  throw new Error('Gagal upload ke TmpFiles');
}

export default async function handler(req, res) {
  // 1. Validasi HTTP Method
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: "Ndra09",
      error: "Gunakan method POST"
    });
  }

  try {
    const { base64, url, text = "LUNAS" } = req.body || {};

    // 2. Validasi Kehadiran Input
    if (!base64 && !url) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "Parameter 'base64' atau 'url' wajib diisi"
      });
    }

    let imageBuffer;

    // 3. Proses Input Gambar (Base64 atau URL)
    if (base64) {
      try {
        const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z+-]+;base64,/, '');
        imageBuffer = Buffer.from(cleanBase64, 'base64');
      } catch (err) {
        return res.status(400).json({
          status: false,
          creator: "Ndra09",
          error: "Format Base64 tidak valid"
        });
      }
    } else if (url) {
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Protokol tidak valid');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Gagal mengunduh gambar');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('image')) {
          return res.status(400).json({
            status: false,
            creator: "Ndra09",
            error: "URL tidak merujuk ke gambar yang valid"
          });
        }

        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } catch (err) {
        return res.status(400).json({
          status: false,
          creator: "Ndra09",
          error: "Gagal mengambil gambar dari URL"
        });
      }
    }

    // 4. Deteksi & Validasi Metadata Gambar dengan Sharp
    let metadata;
    try {
      metadata = await sharp(imageBuffer).metadata();
    } catch (err) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "File gambar rusak atau tidak didukung"
      });
    }

    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 600;

    const stampText = String(text).trim() || "LUNAS";
    const safeText = escapeXml(stampText);

    // Ukuran Stempel Responsif
    const minDim = Math.min(imgWidth, imgHeight);
    const boxWidth = Math.round(minDim * 0.65);
    const boxHeight = Math.round(boxWidth * 0.38);
    const fontSize = Math.round(boxHeight * 0.42);
    const strokeWidth = Math.max(3, Math.round(minDim * 0.012));
    const borderRadius = Math.round(minDim * 0.02);

    // Overlay SVG
    const svgOverlay = `
      <svg width="${boxWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .stamp-box {
            fill: rgba(220, 38, 38, 0.08);
            stroke: #dc2626;
            stroke-width: ${strokeWidth}px;
            rx: ${borderRadius}px;
            ry: ${borderRadius}px;
          }
          .stamp-inner-border {
            fill: none;
            stroke: #dc2626;
            stroke-width: ${Math.max(1, Math.round(strokeWidth / 2))}px;
            stroke-dasharray: 6,4;
          }
          .stamp-text {
            font-family: Arial, sans-serif, Impact;
            font-weight: 900;
            font-size: ${fontSize}px;
            fill: #dc2626;
            text-anchor: middle;
            dominant-baseline: central;
            letter-spacing: 2px;
          }
        </style>
        <rect x="${strokeWidth}" y="${strokeWidth}" width="${boxWidth - strokeWidth * 2}" height="${boxHeight - strokeWidth * 2}" class="stamp-box" />
        <rect x="${strokeWidth * 2.5}" y="${strokeWidth * 2.5}" width="${boxWidth - strokeWidth * 5}" height="${boxHeight - strokeWidth * 5}" class="stamp-inner-border" rx="${Math.max(2, borderRadius - 2)}" />
        <text x="50%" y="50%" class="stamp-text">${safeText}</text>
      </svg>
    `;

    const rotatedStamp = await sharp(Buffer.from(svgOverlay))
      .rotate(-12, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const processedImageBuffer = await sharp(imageBuffer)
      .composite([{ input: rotatedStamp, gravity: 'center' }])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 5. Upload Gambar (Utama: Termai -> Cadangan 1: Catbox -> Cadangan 2: TmpFiles)
    let imageUrl;
    try {
      imageUrl = await uploadTermai(processedImageBuffer);
    } catch (termaiErr) {
      console.warn("Upload Termai gagal, mencoba Catbox:", termaiErr.message);
      try {
        imageUrl = await uploadCatbox(processedImageBuffer);
      } catch (catboxErr) {
        console.warn("Upload Catbox gagal, mencoba TmpFiles:", catboxErr.message);
        try {
          imageUrl = await uploadTmpFiles(processedImageBuffer);
        } catch (fallbackErr) {
          return res.status(500).json({
            status: false,
            creator: "Ndra09",
            error: "Gagal mengunggah gambar ke server penyimpanan"
          });
        }
      }
    }

    // 6. Response Sukses
    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: stampText,
        url_gambar: imageUrl
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      creator: "Ndra09",
      error: "Terjadi kesalahan internal pada server"
    });
  }
}
