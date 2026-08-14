import sharp from 'sharp';

/*
 * NDRA09 - LUNAS STAMP API
 *
 * Input:
 * POST /api/lunas
 *
 * JSON:
 * {
 *   "base64": "data:image/jpeg;base64,...",
 *   "text": "LUNAS"
 * }
 *
 * atau:
 *
 * {
 *   "url": "https://example.com/gambar.jpg",
 *   "text": "LUNAS"
 * }
 *
 * Output:
 * {
 *   "status": true,
 *   "creator": "Ndra09",
 *   "result": {
 *      "text": "LUNAS",
 *      "url_gambar": "https://..."
 *   }
 * }
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};


// ============================================================
// XML ESCAPE
// ============================================================

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


// ============================================================
// BITMAP FONT
//
// KITA SENGAJA TIDAK MENGGUNAKAN <text> SVG.
//
// Setiap huruf dibuat menggunakan kotak-kotak SVG.
// Jadi tidak membutuhkan:
// - Arial
// - Roboto
// - DejaVu
// - font CDN
// - @font-face
//
// Ini membuat tulisan jauh lebih aman dirender Sharp/Vercel.
// ============================================================

const FONT = {

  A: [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],

  B: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10001',
    '10001',
    '11110'
  ],

  C: [
    '01111',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '01111'
  ],

  D: [
    '11110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '11110'
  ],

  E: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111'
  ],

  F: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000'
  ],

  G: [
    '01111',
    '10000',
    '10000',
    '10111',
    '10001',
    '10001',
    '01111'
  ],

  H: [
    '10001',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],

  I: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111'
  ],

  J: [
    '00111',
    '00010',
    '00010',
    '00010',
    '10010',
    '10010',
    '01100'
  ],

  K: [
    '10001',
    '10010',
    '10100',
    '11000',
    '10100',
    '10010',
    '10001'
  ],

  L: [
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '11111'
  ],

  M: [
    '10001',
    '11011',
    '10101',
    '10101',
    '10001',
    '10001',
    '10001'
  ],

  N: [
    '10001',
    '11001',
    '11001',
    '10101',
    '10011',
    '10011',
    '10001'
  ],

  O: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],

  P: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10000',
    '10000',
    '10000'
  ],

  Q: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10101',
    '10010',
    '01101'
  ],

  R: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10100',
    '10010',
    '10001'
  ],

  S: [
    '01111',
    '10000',
    '10000',
    '01110',
    '00001',
    '00001',
    '11110'
  ],

  T: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100'
  ],

  U: [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],

  V: [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01010',
    '00100'
  ],

  W: [
    '10001',
    '10001',
    '10001',
    '10101',
    '10101',
    '11011',
    '10001'
  ],

  X: [
    '10001',
    '10001',
    '01010',
    '00100',
    '01010',
    '10001',
    '10001'
  ],

  Y: [
    '10001',
    '10001',
    '01010',
    '00100',
    '00100',
    '00100',
    '00100'
  ],

  Z: [
    '11111',
    '00001',
    '00010',
    '00100',
    '01000',
    '10000',
    '11111'
  ],

  '0': [
    '01110',
    '10001',
    '10011',
    '10101',
    '11001',
    '10001',
    '01110'
  ],

  '1': [
    '00100',
    '01100',
    '00100',
    '00100',
    '00100',
    '00100',
    '01110'
  ],

  '2': [
    '01110',
    '10001',
    '00001',
    '00010',
    '00100',
    '01000',
    '11111'
  ],

  '3': [
    '11110',
    '00001',
    '00001',
    '01110',
    '00001',
    '00001',
    '11110'
  ],

  '4': [
    '00010',
    '00110',
    '01010',
    '10010',
    '11111',
    '00010',
    '00010'
  ],

  '5': [
    '11111',
    '10000',
    '10000',
    '11110',
    '00001',
    '00001',
    '11110'
  ],

  '6': [
    '01110',
    '10000',
    '10000',
    '11110',
    '10001',
    '10001',
    '01110'
  ],

  '7': [
    '11111',
    '00001',
    '00010',
    '00100',
    '01000',
    '01000',
    '01000'
  ],

  '8': [
    '01110',
    '10001',
    '10001',
    '01110',
    '10001',
    '10001',
    '01110'
  ],

  '9': [
    '01110',
    '10001',
    '10001',
    '01111',
    '00001',
    '00001',
    '01110'
  ],

  '-': [
    '00000',
    '00000',
    '00000',
    '11111',
    '00000',
    '00000',
    '00000'
  ],

  '.': [
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00110',
    '00110'
  ],

  ':': [
    '00000',
    '00110',
    '00110',
    '00000',
    '00110',
    '00110',
    '00000'
  ],

  '/': [
    '00001',
    '00010',
    '00010',
    '00100',
    '01000',
    '01000',
    '10000'
  ],

  ' ': [
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000'
  ]
};


// ============================================================
// MEMBUAT TEKS MENJADI SVG SHAPE
// ============================================================

function createBitmapText(text, options = {}) {

  const {
    color = '#d32f2f',
    pixelSize = 10,
    letterGap = 2,
    charGap = 5
  } = options;

  const normalized = String(text)
    .toUpperCase()
    .replace(/[^\x00-\x7F]/g, '');

  let x = 0;

  const rects = [];

  for (const char of normalized) {

    const glyph = FONT[char] || FONT[' '];

    const glyphWidth = glyph[0].length * pixelSize;

    for (let row = 0; row < glyph.length; row++) {

      for (let col = 0; col < glyph[row].length; col++) {

        if (glyph[row][col] === '1') {

          const px = x + col * pixelSize;

          const py = row * pixelSize;

          rects.push(`
            <rect
              x="${px}"
              y="${py}"
              width="${Math.max(1, pixelSize - letterGap)}"
              height="${Math.max(1, pixelSize - letterGap)}"
              rx="${Math.max(1, pixelSize * 0.12)}"
              fill="${color}"
            />
          `);
        }
      }
    }

    x += glyphWidth + charGap;
  }

  return {
    svg: rects.join(''),
    width: Math.max(1, x - charGap),
    height: 7 * pixelSize
  };
}


// ============================================================
// BUAT STAMP
// ============================================================

async function createStamp(text, imgWidth, imgHeight) {

  const minDim = Math.min(imgWidth, imgHeight);

  /*
   * Ukuran cap.
   */
  const boxWidth = Math.round(minDim * 0.78);
  const boxHeight = Math.round(boxWidth * 0.38);

  /*
   * Cari pixel size supaya teks masuk.
   *
   * Bitmap font dasar:
   * 5 kolom x 7 baris.
   */
  const normalizedText = String(text)
    .toUpperCase()
    .replace(/[^\x00-\x7F]/g, '');

  const charCount = Math.max(1, normalizedText.length);

  const availableWidth = boxWidth * 0.78;

  /*
   * Setiap karakter kira-kira 5 pixel + gap.
   */
  let pixelSize = Math.floor(
    availableWidth / (charCount * 6.2)
  );

  /*
   * Sesuaikan dengan tinggi cap.
   */
  const heightBased = Math.floor(boxHeight / 9);

  pixelSize = Math.min(pixelSize, heightBased);

  /*
   * Jangan terlalu kecil.
   */
  pixelSize = Math.max(3, pixelSize);

  /*
   * Buat bitmap text.
   */
  let bitmap = createBitmapText(normalizedText, {
    color: '#d32f2f',
    pixelSize,
    letterGap: Math.max(1, Math.floor(pixelSize * 0.12)),
    charGap: Math.max(2, Math.floor(pixelSize * 0.65))
  });

  /*
   * Kalau masih terlalu lebar,
   * perkecil sampai muat.
   */
  while (
    bitmap.width > availableWidth &&
    pixelSize > 2
  ) {

    pixelSize--;

    bitmap = createBitmapText(normalizedText, {
      color: '#d32f2f',
      pixelSize,
      letterGap: Math.max(1, Math.floor(pixelSize * 0.12)),
      charGap: Math.max(2, Math.floor(pixelSize * 0.65))
    });
  }

  /*
   * Posisi text di tengah.
   */
  const textX = Math.round(
    (boxWidth - bitmap.width) / 2
  );

  const textY = Math.round(
    (boxHeight - bitmap.height) / 2
  );

  const outerStroke = Math.max(
    5,
    Math.round(boxWidth * 0.032)
  );

  const innerStroke = Math.max(
    2,
    Math.round(boxWidth * 0.014)
  );

  const borderRadius = Math.round(
    boxWidth * 0.055
  );

  const innerInset = Math.round(
    boxWidth * 0.04
  );

  /*
   * SVG CAP.
   *
   * PERHATIKAN:
   * Tidak ada <text>.
   *
   * Tulisan dibuat dari <rect>.
   */
  const svg = `
    <svg
      width="${boxWidth}"
      height="${boxHeight}"
      viewBox="0 0 ${boxWidth} ${boxHeight}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <!-- Background transparan -->

      <!-- BORDER LUAR -->
      <rect
        x="${outerStroke / 2}"
        y="${outerStroke / 2}"
        width="${boxWidth - outerStroke}"
        height="${boxHeight - outerStroke}"
        rx="${borderRadius}"
        ry="${borderRadius}"
        fill="rgba(211,47,47,0.08)"
        stroke="#d32f2f"
        stroke-width="${outerStroke}"
      />

      <!-- BORDER DALAM -->
      <rect
        x="${outerStroke + innerInset}"
        y="${outerStroke + innerInset}"
        width="${boxWidth - ((outerStroke + innerInset) * 2)}"
        height="${boxHeight - ((outerStroke + innerInset) * 2)}"
        rx="${Math.max(2, borderRadius - 3)}"
        ry="${Math.max(2, borderRadius - 3)}"
        fill="none"
        stroke="#d32f2f"
        stroke-width="${innerStroke}"
      />

      <!-- TEKS -->
      <g transform="translate(${textX}, ${textY})">
        ${bitmap.svg}
      </g>

    </svg>
  `;

  console.log(
    '[LUNAS] Text:',
    normalizedText,
    '| pixel:',
    pixelSize,
    '| text size:',
    bitmap.width,
    'x',
    bitmap.height
  );

  /*
   * Render SVG menjadi PNG.
   *
   * Karena hanya menggunakan rect,
   * tidak ada masalah font.
   */
  const stampBuffer = await sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();

  /*
   * Rotate cap.
   */
  const rotatedStamp = await sharp(stampBuffer)
    .rotate(-12, {
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .png()
    .toBuffer();

  return rotatedStamp;
}


// ============================================================
// WATERMARK
// ============================================================

function createWatermarkSvg(width, height) {

  const minDim = Math.min(width, height);

  const fontSize = Math.max(
    14,
    Math.round(minDim * 0.035)
  );

  const margin = Math.round(
    minDim * 0.03
  );

  /*
   * Watermark masih menggunakan SVG text.
   *
   * Jika environment tidak punya font,
   * watermark tidak terlalu penting.
   *
   * Tetapi STAMP TEXT di atas tidak bergantung font.
   */
  return `
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <text
        x="${width - margin}"
        y="${height - margin}"
        font-family="sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#ffffff"
        stroke="#000000"
        stroke-width="1.8"
        text-anchor="end"
      >By Ndra Store</text>

    </svg>
  `;
}


// ============================================================
// UPLOAD CATBOX
// ============================================================

async function uploadCatbox(imageBuffer) {

  const formData = new FormData();

  formData.append(
    'reqtype',
    'fileupload'
  );

  const blob = new Blob(
    [imageBuffer],
    {
      type: 'image/jpeg'
    }
  );

  formData.append(
    'fileToUpload',
    blob,
    'stamped_image.jpg'
  );

  const response = await fetch(
    'https://catbox.moe/user/api.php',
    {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(
      `Catbox HTTP ${response.status}`
    );
  }

  const result = (
    await response.text()
  ).trim();

  if (!result.startsWith('http')) {
    throw new Error(
      `Catbox response: ${result}`
    );
  }

  return result;
}


// ============================================================
// UPLOAD TERMAI
// ============================================================

async function uploadTermai(imageBuffer) {

  const formData = new FormData();

  const blob = new Blob(
    [imageBuffer],
    {
      type: 'image/jpeg'
    }
  );

  formData.append(
    'file',
    blob,
    'stamped_image.jpg'
  );

  const response = await fetch(
    'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk',
    {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(
      `Termai HTTP ${response.status}`
    );
  }

  const json = await response.json();

  const url =
    json?.path ||
    json?.url ||
    json?.data?.url;

  if (!url) {
    throw new Error(
      'URL gambar dari Termai tidak ditemukan'
    );
  }

  return url;
}


// ============================================================
// UPLOAD TMPFILES
// ============================================================

async function uploadTmpFiles(imageBuffer) {

  const formData = new FormData();

  const blob = new Blob(
    [imageBuffer],
    {
      type: 'image/jpeg'
    }
  );

  formData.append(
    'file',
    blob,
    'stamped_image.jpg'
  );

  const response = await fetch(
    'https://tmpfiles.org/api/v1/upload',
    {
      method: 'POST',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(
      `TmpFiles HTTP ${response.status}`
    );
  }

  const json = await response.json();

  if (
    json?.status === 'success' &&
    json?.data?.url
  ) {

    return json.data.url.replace(
      'tmpfiles.org/',
      'tmpfiles.org/dl/'
    );
  }

  throw new Error(
    'TmpFiles tidak mengembalikan URL'
  );
}


// ============================================================
// DOWNLOAD IMAGE DARI URL
// ============================================================

async function downloadImage(url) {

  const parsed = new URL(url);

  if (
    !['http:', 'https:']
      .includes(parsed.protocol)
  ) {
    throw new Error(
      'URL harus menggunakan HTTP atau HTTPS'
    );
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {

    const response = await fetch(
      url,
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const contentType =
      response.headers.get(
        'content-type'
      ) || '';

    if (
      !contentType
        .toLowerCase()
        .startsWith('image/')
    ) {
      throw new Error(
        'URL bukan file gambar'
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    return Buffer.from(arrayBuffer);

  } finally {

    clearTimeout(timeout);

  }
}


// ============================================================
// HANDLER
// ============================================================

export default async function handler(req, res) {

  /*
   * CORS
   */
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );


  /*
   * OPTIONS
   */
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }


  /*
   * METHOD
   */
  if (req.method !== 'POST') {

    return res.status(405).json({
      status: false,
      creator: 'Ndra09',
      error: 'Gunakan method POST'
    });

  }


  try {

    const body =
      req.body || {};

    const base64 =
      body.base64;

    const url =
      body.url;

    const text =
      body.text || 'LUNAS';


    /*
     * VALIDASI
     */
    if (!base64 && !url) {

      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error:
          "Parameter 'base64' atau 'url' wajib diisi"
      });

    }


    /*
     * BATASI TEKS
     *
     * Supaya tidak membuat stamp
     * terlalu besar.
     */
    const stampText =
      String(text)
        .trim()
        .slice(0, 40)
        .toUpperCase() || 'LUNAS';


    /*
     * AMBIL GAMBAR
     */
    let imageBuffer;


    if (base64) {

      try {

        let cleanBase64 =
          String(base64).trim();

        /*
         * Support:
         *
         * data:image/jpeg;base64,...
         *
         * maupun:
         *
         * /9j/4AAQ...
         */
        cleanBase64 =
          cleanBase64.replace(
            /^data:image\/[^;]+;base64,/i,
            ''
          );

        imageBuffer =
          Buffer.from(
            cleanBase64,
            'base64'
          );

        if (
          !imageBuffer ||
          imageBuffer.length === 0
        ) {
          throw new Error(
            'Buffer kosong'
          );
        }

      } catch {

        return res.status(400).json({
          status: false,
          creator: 'Ndra09',
          error:
            'Format Base64 tidak valid'
        });

      }

    } else {

      try {

        imageBuffer =
          await downloadImage(url);

      } catch (error) {

        console.error(
          '[LUNAS] Download URL:',
          error.message
        );

        return res.status(400).json({
          status: false,
          creator: 'Ndra09',
          error:
            'Gagal mengambil gambar dari URL'
        });

      }

    }


    /*
     * METADATA
     */
    let metadata;

    try {

      metadata =
        await sharp(imageBuffer)
          .metadata();

    } catch {

      return res.status(400).json({
        status: false,
        creator: 'Ndra09',
        error:
          'File gambar rusak atau format tidak didukung'
      });

    }


    const imgWidth =
      metadata.width || 800;

    const imgHeight =
      metadata.height || 600;


    console.log(
      '[LUNAS] Input:',
      `${imgWidth}x${imgHeight}`
    );

    console.log(
      '[LUNAS] Text:',
      stampText
    );


    /*
     * BUAT STAMP
     */
    let stampBuffer;

    try {

      stampBuffer =
        await createStamp(
          stampText,
          imgWidth,
          imgHeight
        );

    } catch (error) {

      console.error(
        '[LUNAS] Stamp error:',
        error
      );

      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          'Gagal membuat stempel'
      });

    }


    /*
     * WATERMARK
     */
    const watermarkSvg =
      createWatermarkSvg(
        imgWidth,
        imgHeight
      );


    /*
     * COMPOSITE
     *
     * INI BAGIAN PENTING:
     *
     * imageBuffer
     *      ↓
     * stampBuffer
     *      ↓
     * watermark
     *      ↓
     * JPEG
     */
    let processedImageBuffer;

    try {

      processedImageBuffer =
        await sharp(imageBuffer)
          .rotate()
          .composite([

            {
              input: stampBuffer,
              gravity: 'center'
            },

            {
              input:
                Buffer.from(
                  watermarkSvg
                ),
              top: 0,
              left: 0
            }

          ])
          .jpeg({
            quality: 92,
            mozjpeg: true
          })
          .toBuffer();

    } catch (error) {

      console.error(
        '[LUNAS] Composite error:',
        error
      );

      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          'Gagal menggabungkan stempel dengan gambar'
      });

    }


    /*
     * VALIDASI HASIL
     *
     * Jangan upload gambar original.
     */
    try {

      const outputMetadata =
        await sharp(
          processedImageBuffer
        ).metadata();

      console.log(
        '[LUNAS] Output:',
        `${outputMetadata.width}x${outputMetadata.height}`,
        '| Size:',
        processedImageBuffer.length,
        'bytes'
      );

    } catch (error) {

      console.error(
        '[LUNAS] Output validation:',
        error
      );

      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          'Hasil gambar tidak valid'
      });

    }


    /*
     * UPLOAD
     *
     * Prioritas:
     * Catbox
     * ↓
     * Termai
     * ↓
     * TmpFiles
     */
    let imageUrl = null;

    let uploadErrors = [];


    /*
     * CATBOX
     */
    try {

      console.log(
        '[LUNAS] Upload Catbox...'
      );

      imageUrl =
        await uploadCatbox(
          processedImageBuffer
        );

      console.log(
        '[LUNAS] Catbox OK:',
        imageUrl
      );

    } catch (error) {

      console.error(
        '[LUNAS] Catbox gagal:',
        error.message
      );

      uploadErrors.push(
        `Catbox: ${error.message}`
      );

    }


    /*
     * TERMAI
     */
    if (!imageUrl) {

      try {

        console.log(
          '[LUNAS] Upload Termai...'
        );

        imageUrl =
          await uploadTermai(
            processedImageBuffer
          );

        console.log(
          '[LUNAS] Termai OK:',
          imageUrl
        );

      } catch (error) {

        console.error(
          '[LUNAS] Termai gagal:',
          error.message
        );

        uploadErrors.push(
          `Termai: ${error.message}`
        );

      }

    }


    /*
     * TMPFILES
     */
    if (!imageUrl) {

      try {

        console.log(
          '[LUNAS] Upload TmpFiles...'
        );

        imageUrl =
          await uploadTmpFiles(
            processedImageBuffer
          );

        console.log(
          '[LUNAS] TmpFiles OK:',
          imageUrl
        );

      } catch (error) {

        console.error(
          '[LUNAS] TmpFiles gagal:',
          error.message
        );

        uploadErrors.push(
          `TmpFiles: ${error.message}`
        );

      }

    }


    /*
     * SEMUA UPLOADER GAGAL
     */
    if (!imageUrl) {

      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          'Gagal mengunggah gambar hasil',
        detail:
          uploadErrors
      });

    }


    /*
     * RESPONSE
     */
    return res.status(200).json({

      status: true,

      creator: 'Ndra09',

      result: {

        text: stampText,

        url_gambar:
          imageUrl

      }

    });


  } catch (error) {

    console.error(
      '[LUNAS] INTERNAL ERROR:',
      error
    );

    return res.status(500).json({

      status: false,

      creator: 'Ndra09',

      error:
        'Terjadi kesalahan internal pada server'

    });

  }

}