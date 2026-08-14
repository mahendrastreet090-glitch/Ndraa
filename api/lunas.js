import sharp from 'sharp';

// Variable cache font di memory Vercel
let cachedFontBase64 = null;

// Fungsi untuk mengambil font tebal (Roboto 900) dari CDN & disimpan di memory
async function getFontBase64() {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const res = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-900-normal.ttf');
    if (!res.ok) throw new Error('Gagal unduh font');
    const buffer = await res.arrayBuffer();
    cachedFontBase64 = Buffer.from(buffer).toString('base64');
    return cachedFontBase64;
  } catch (err) {
    console.error("Gagal load font CDN:", err.message);
    return null;
  }
}

// Helper sanitasi karakter khusus pada teks SVG
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
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('file', blob, 'stamped_image.jpg');

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
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('fileToUpload', blob, 'stamped_image.jpg');

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
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('file', blob, 'stamped_image.jpg');

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
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      creator: "Ndra09",
      error: "Gunakan method POST"
    });
  }

  try {
    const { base64, url, text = "LUNAS" } = req.body || {};

    if (!base64 && !url) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "Parameter 'base64' atau 'url' wajib diisi"
      });
    }

    let imageBuffer;

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
        const timeoutId = setTimeout(() => controller.abort(), 12000);

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

    // Ambil metadata & Font Tebal
    const [metadata, fontBase64] = await Promise.all([
      sharp(imageBuffer).metadata().catch(() => null),
      getFontBase64()
    ]);

    if (!metadata) {
      return res.status(400).json({
        status: false,
        creator: "Ndra09",
        error: "File gambar rusak atau tidak didukung"
      });
    }

    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 600;

    const stampText = String(text).trim().toUpperCase() || "LUNAS";
    const safeText = escapeXml(stampText);

    // Dimensi Cap Jumbo (80% Sisi Terkecil Gambar)
    const minDim = Math.min(imgWidth, imgHeight);
    const boxWidth = Math.round(minDim * 0.80); 
    const boxHeight = Math.round(boxWidth * 0.38);

    // Dynamic Font Size Scaling
    const maxFontByHeight = boxHeight * 0.52;
    const maxFontByWidth = (boxWidth * 0.82) / Math.max(1, stampText.length * 0.62);
    const fontSize = Math.max(18, Math.round(Math.min(maxFontByHeight, maxFontByWidth)));

    const outerStroke = Math.max(5, Math.round(boxWidth * 0.035));
    const innerStroke = Math.max(2, Math.round(boxWidth * 0.016));
    const borderRadius = Math.round(boxWidth * 0.05);
    const innerInset = Math.round(boxWidth * 0.04);

    // Pengaturan Font SVG
    const fontDefs = fontBase64 ? `
      <defs>
        <style>
          @font-face {
            font-family: 'CustomStampFont';
            src: url('data:font/ttf;charset=utf-8;base64,${fontBase64}');
          }
        </style>
      </defs>
    ` : '';
    const fontFamily = fontBase64 ? "'CustomStampFont', sans-serif" : "sans-serif";

    // Overlay SVG Cap Merah
    const svgOverlay = `
      <svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg">
        ${fontDefs}

        <!-- Outer Box -->
        <rect 
          x="${outerStroke / 2}" 
          y="${outerStroke / 2}" 
          width="${boxWidth - outerStroke}" 
          height="${boxHeight - outerStroke}" 
          rx="${borderRadius}" 
          ry="${borderRadius}" 
          fill="rgba(211, 47, 47, 0.10)"
          stroke="#d32f2f"
          stroke-width="${outerStroke}"
        />

        <!-- Inner Box -->
        <rect 
          x="${outerStroke + innerInset}" 
          y="${outerStroke + innerInset}" 
          width="${boxWidth - (outerStroke + innerInset) * 2}" 
          height="${boxHeight - (outerStroke + innerInset) * 2}" 
          rx="${Math.max(2, borderRadius - 3)}" 
          ry="${Math.max(2, borderRadius - 3)}" 
          fill="none"
          stroke="#d32f2f"
          stroke-width="${innerStroke}"
        />

        <!-- Teks Cap -->
        <text 
          x="50%" 
          y="50%" 
          dy="0.35em"
          font-family="${fontFamily}" 
          font-weight="900" 
          font-size="${fontSize}" 
          fill="#d32f2f" 
          text-anchor="middle"
          letter-spacing="2"
        >${safeText}</text>
      </svg>
    `;

    // Watermark "By Ndra Store"
    const wmFontSize = Math.max(14, Math.round(minDim * 0.038));
    const wmMargin = Math.round(minDim * 0.03);

    const svgWatermark = `
      <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
        ${fontDefs}
        <text 
          x="${imgWidth - wmMargin}" 
          y="${imgHeight - wmMargin}" 
          font-family="${fontFamily}" 
          font-size="${wmFontSize}" 
          font-weight="bold" 
          fill="#ffffff" 
          stroke="#000000" 
          stroke-width="1.8" 
          text-anchor="end"
        >By Ndra Store</text>
      </svg>
    `;

    // Rotasi Stempel -12 Derajat
    const rotatedStamp = await sharp(Buffer.from(svgOverlay))
      .rotate(-12, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Composite Gambar
    const processedImageBuffer = await sharp(imageBuffer)
      .composite([
        { input: rotatedStamp, gravity: 'center' },
        { input: Buffer.from(svgWatermark), top: 0, left: 0 }
      ])
      .jpeg({ quality: 92 })
      .toBuffer();

    // Upload Ke Host
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

    return res.status(200).json({
      status: true,
      creator: "Ndra09",
      result: {
        text: stampText,
        url_gambar: imageUrl
      }
    });

  } catch (error) {
    console.error("Internal Server Error:", error);
    return res.status(500).json({
      status: false,
      creator: "Ndra09",
      error: "Terjadi kesalahan internal pada server"
    });
  }
}
