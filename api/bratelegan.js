const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')
const opentype = require('opentype.js')
const twemoji = require('twemoji')
const emojiRegex = require('emoji-regex')
const path = require('path')
const fs = require('fs')
const https = require('https')

const FONT_PATH = path.join(
  process.cwd(),
  'assets',
  'Aptos.ttf'
)

const WIDTH = 1024
const HEIGHT = 1024

const SIDE_PADDING = 60
const WORD_GAP_RATIO = 0.18

const BOLD_OFFSET = 2.8
const BOLD_STEPS = 5

const MAX_WORDS = 30

const CACHE_DIR = '/tmp/twemoji-cache'

const TERMAI_UPLOAD_URL =
  'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk'

let font = null

try {
  font = opentype.loadSync(FONT_PATH)
} catch (err) {
  console.error(
    'FONT LOAD ERROR:',
    err.message
  )
}

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, {
      recursive: true
    })
  }
} catch (err) {
  console.error(
    'CACHE DIR ERROR:',
    err.message
  )
}


/* ============================================================
   TEXT
============================================================ */

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}


/* ============================================================
   TWEMOJI
============================================================ */

function getEmojiUrl(code) {
  return (
    'https://cdn.jsdelivr.net/gh/' +
    'twitter/twemoji@14.0.2/' +
    'assets/svg/' +
    code +
    '.svg'
  )
}


/* ============================================================
   DOWNLOAD
============================================================ */

function downloadFile(url) {
  return new Promise(
    (resolve, reject) => {

      const request = https.get(
        url,
        response => {

          if (
            response.statusCode !== 200
          ) {

            response.resume()

            return reject(
              new Error(
                `Emoji HTTP ${response.statusCode}`
              )
            )
          }

          const chunks = []

          response.on(
            'data',
            chunk => {
              chunks.push(chunk)
            }
          )

          response.on(
            'end',
            () => {

              resolve(
                Buffer.concat(
                  chunks
                )
              )

            }
          )

          response.on(
            'error',
            reject
          )
        }
      )

      request.on(
        'error',
        reject
      )

      request.setTimeout(
        10000,
        () => {

          request.destroy(
            new Error(
              'Emoji download timeout'
            )
          )

        }
      )
    }
  )
}


/* ============================================================
   EMOJI SVG -> PNG
============================================================ */

async function getEmojiPng(code) {

  const cacheFile =
    path.join(
      CACHE_DIR,
      `${code}.png`
    )

  try {

    if (
      fs.existsSync(
        cacheFile
      )
    ) {

      return fs.readFileSync(
        cacheFile
      )

    }

  } catch {}


  const svg =
    await downloadFile(
      getEmojiUrl(code)
    )


  const png =
    await sharp(
      svg,
      {
        density: 300
      }
    )
      .ensureAlpha()
      .png()
      .toBuffer()


  try {

    fs.writeFileSync(
      cacheFile,
      png
    )

  } catch {}


  return png
}


/* ============================================================
   FIND EMOJI
============================================================ */

function findEmojiParts(text) {

  const regex =
    emojiRegex()

  const parts = []

  let lastIndex = 0
  let match

  while (
    (match = regex.exec(text))
  ) {

    if (
      match.index >
      lastIndex
    ) {

      parts.push({
        type: 'text',
        value:
          text.slice(
            lastIndex,
            match.index
          )
      })

    }

    parts.push({
      type: 'emoji',

      value:
        match[0],

      code:
        twemoji.convert.toCodePoint(
          match[0]
        )
    })

    lastIndex =
      regex.lastIndex
  }


  if (
    lastIndex <
    text.length
  ) {

    parts.push({
      type: 'text',

      value:
        text.slice(
          lastIndex
        )
    })

  }


  if (!parts.length) {

    parts.push({
      type: 'text',
      value: text
    })

  }


  return parts
}


/* ============================================================
   PREPARE EMOJI
============================================================ */

async function prepareEmojiAssets(text) {

  const regex =
    emojiRegex()

  const codes =
    new Set()

  let match

  while (
    (match = regex.exec(text))
  ) {

    codes.add(
      twemoji.convert.toCodePoint(
        match[0]
      )
    )

  }


  const entries =
    await Promise.all(
      [...codes].map(
        async code => {

          try {

            const png =
              await getEmojiPng(
                code
              )

            return [
              code,

              `data:image/png;base64,${png.toString(
                'base64'
              )}`
            ]

          } catch (err) {

            console.error(
              'EMOJI LOAD ERROR:',
              code,
              err.message
            )

            return [
              code,
              ''
            ]

          }

        }
      )
    )


  return Object.fromEntries(
    entries
  )
}


/* ============================================================
   FONT
============================================================ */

function getFontAdvance(
  text,
  fontSize
) {

  if (!text) {
    return 0
  }

  return font.getAdvanceWidth(
    text,
    fontSize,
    {
      kerning: true
    }
  )
}


/* ============================================================
   PART WIDTH
============================================================ */

function getPartWidth(
  part,
  fontSize
) {

  if (
    part.type === 'emoji'
  ) {

    return fontSize * 1.00

  }


  return getFontAdvance(
    part.value,
    fontSize
  )
}


/* ============================================================
   WORDS
============================================================ */

function prepareWords(
  words
) {

  return words.map(
    word => {

      const parts =
        findEmojiParts(
          word
        )

      return {
        word,
        parts
      }

    }
  )
}


/* ============================================================
   LINES
============================================================ */

function calculateLines(
  preparedWords,
  fontSize
) {

  const maxWidth =
    WIDTH -
    SIDE_PADDING * 2

  const gap =
    fontSize *
    WORD_GAP_RATIO

  const lines = []

  let current = []
  let currentWidth = 0


  for (
    const item of preparedWords
  ) {

    let wordWidth = 0


    for (
      const part of item.parts
    ) {

      wordWidth +=
        getPartWidth(
          part,
          fontSize
        )

    }


    item.width =
      wordWidth


    const nextWidth =
      current.length
        ? currentWidth +
          gap +
          wordWidth
        : wordWidth


    if (
      current.length &&
      nextWidth > maxWidth
    ) {

      lines.push({
        words:
          current,

        width:
          currentWidth
      })


      current = [
        item
      ]


      currentWidth =
        wordWidth

    } else {

      current.push(
        item
      )

      currentWidth =
        nextWidth

    }

  }


  if (
    current.length
  ) {

    lines.push({
      words:
        current,

      width:
        currentWidth
    })

  }


  return lines
}


/* ============================================================
   BEST FONT SIZE
============================================================ */

function getBestFontSize(
  preparedWords
) {

  let size = 190

  while (
    size > 40
  ) {

    const lines =
      calculateLines(
        preparedWords,
        size
      )


    const lineHeight =
      size * 1.10


    const totalHeight =
      lines.length *
      lineHeight


    if (
      totalHeight <=
        HEIGHT - 130 &&
      lines.length <= 5
    ) {

      return size

    }


    size -= 4
  }


  return 40
}


/* ============================================================
   BOLD TEXT
============================================================ */

function createBoldTextPath(
  text,
  x,
  y,
  fontSize
) {

  const result = []


  const base =
    font.getPath(
      text,
      x,
      y,
      fontSize
    )


  result.push(
    `<path d="${base.toPathData(
      2
    )}" fill="#000000"/>`
  )


  for (
    let i = 0;
    i < BOLD_STEPS;
    i++
  ) {

    const angle =
      (
        Math.PI * 2 * i
      ) /
      BOLD_STEPS


    const dx =
      Math.cos(angle) *
      BOLD_OFFSET


    const dy =
      Math.sin(angle) *
      BOLD_OFFSET


    const bold =
      font.getPath(
        text,
        x + dx,
        y + dy,
        fontSize
      )


    result.push(
      `<path d="${bold.toPathData(
        2
      )}" fill="#000000"/>`
    )

  }


  return result.join('')
}


/* ============================================================
   LAYOUT
============================================================ */

function buildLayout(
  preparedWords,
  fontSize
) {

  const lines =
    calculateLines(
      preparedWords,
      fontSize
    )


  const lineHeight =
    fontSize * 1.10


  const totalHeight =
    lines.length *
    lineHeight


  let y =
    (
      HEIGHT -
      totalHeight
    ) / 2 +
    fontSize


  const result = []

  let globalIndex = 0


  for (
    const line of lines
  ) {

    const gap =
      fontSize *
      WORD_GAP_RATIO


    let x =
      (
        WIDTH -
        line.width
      ) / 2


    for (
      const item of line.words
    ) {

      const parts =
        item.parts


      const wordWidth =
        item.width


      const wordParts = []


      let partX = x


      let minX = Infinity
      let maxX = -Infinity

      let minY = Infinity
      let maxY = -Infinity


      for (
        const part of parts
      ) {

        const partWidth =
          getPartWidth(
            part,
            fontSize
          )


        if (
          part.type ===
          'text'
        ) {

          const textPath =
            font.getPath(
              part.value,
              partX,
              y,
              fontSize
            )


          const box =
            textPath.getBoundingBox()


          minX =
            Math.min(
              minX,
              box.x1
            )


          maxX =
            Math.max(
              maxX,
              box.x2
            )


          minY =
            Math.min(
              minY,
              box.y1
            )


          maxY =
            Math.max(
              maxY,
              box.y2
            )

        } else {

          minX =
            Math.min(
              minX,
              partX
            )


          maxX =
            Math.max(
              maxX,
              partX +
              partWidth
            )


          minY =
            Math.min(
              minY,
              y -
              fontSize * 0.86
            )


          maxY =
            Math.max(
              maxY,
              y +
              fontSize * 0.14
            )

        }


        wordParts.push({
          ...part,

          x:
            partX,

          width:
            partWidth
        })


        partX +=
          partWidth

      }


      if (
        minX === Infinity
      ) {

        minX = x

        maxX =
          x + wordWidth

        minY =
          y - fontSize

        maxY =
          y

      }


      result.push({

        index:
          globalIndex,

        word:
          item.word,

        x,

        y,

        width:
          maxX - minX,

        height:
          maxY - minY,

        centerX:
          (
            minX +
            maxX
          ) / 2,

        centerY:
          (
            minY +
            maxY
          ) / 2,

        parts:
          wordParts

      })


      x +=
        wordWidth +
        gap


      globalIndex++

    }


    y += lineHeight
  }


  return result
}


/* ============================================================
   RENDER WORD
============================================================ */

function renderWord(
  item,
  fontSize,
  assets
) {

  return item.parts
    .map(
      part => {

        /* TEXT */

        if (
          part.type ===
          'text'
        ) {

          return createBoldTextPath(
            part.value,
            part.x,
            item.y,
            fontSize
          )

        }


        /* EMOJI */

        const src =
          assets[
            part.code
          ]


        if (!src) {
          return ''
        }


        const size =
          fontSize * 1.00


        const emojiY =
          item.y -
          fontSize * 0.86


        return `
          <image
            href="${src}"
            x="${part.x}"
            y="${emojiY}"
            width="${size}"
            height="${size}"
            preserveAspectRatio="xMidYMid meet"
          />
        `

      }
    )
    .join('')
}


/* ============================================================
   SVG
============================================================ */

function createSvg(
  layout,
  fontSize,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
  assets
) {

  const elements = []


  const active =
    layout.find(
      item =>
        item.index ===
        activeIndex
    )


  for (
    const item of layout
  ) {

    if (
      item.index >=
      visibleCount
    ) {

      continue

    }


    if (
      item.index ===
      activeIndex
    ) {

      const cx =
        item.centerX


      const cy =
        item.centerY


      const transform =
        `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`


      /*
       * SHADOW
       */

      elements.push(`
        <g
          transform="${transform}"
        >

          <rect
            x="${item.x - 12}"
            y="${item.y - fontSize * 0.94}"
            width="${item.width + 24}"
            height="${fontSize * 1.18}"
            rx="${fontSize * 0.10}"
            fill="#000000"
            opacity="0.12"
            filter="url(#shadowBlur)"
            transform="translate(5 7)"
          />

        </g>
      `)


      /*
       * WORD
       */

      elements.push(`
        <g
          transform="${transform}"
        >

          ${renderWord(
            item,
            fontSize,
            assets
          )}

        </g>
      `)


      /*
       * SHINE
       */

      if (
        shineProgress < 1
      ) {

        const shineStart =
          item.x -
          item.width * 1.2


        const shineEnd =
          item.x +
          item.width * 1.8


        const shineX =
          shineStart +
          (
            shineEnd -
            shineStart
          ) *
          shineProgress


        elements.push(`
          <g
            transform="${transform}"
            clip-path="url(#activeClip)"
          >

            <rect
              x="${shineX}"
              y="${item.y - fontSize * 1.10}"
              width="${fontSize * 0.16}"
              height="${fontSize * 2.3}"
              rx="${fontSize * 0.08}"
              fill="#ffffff"
              opacity="0.90"
              transform="rotate(18 ${shineX} ${item.y})"
              filter="url(#shineBlur)"
            />

          </g>
        `)

      }


      /*
       * SPARKLE
       */

      const sparkleSize =
        Math.max(
          13,
          Math.min(
            27,
            fontSize * 0.17
          )
        )


      const sparkleX =
        item.x +
        item.width *
        (
          0.10 +
          shineProgress *
          0.78
        )


      const sparkleY =
        item.y -
        fontSize * 0.18


      let sparkleOpacity = 0


      if (
        shineProgress >= 0.08 &&
        shineProgress <= 0.85
      ) {

        if (
          shineProgress < 0.25
        ) {

          sparkleOpacity =
            (
              shineProgress -
              0.08
            ) /
            0.17

        } else if (
          shineProgress > 0.70
        ) {

          sparkleOpacity =
            (
              0.85 -
              shineProgress
            ) /
            0.15

        } else {

          sparkleOpacity = 1

        }

      }


      if (
        sparkleOpacity > 0
      ) {

        elements.push(`
          <g
            opacity="${sparkleOpacity}"
            transform="${transform}"
          >

            <path
              d="
                M ${sparkleX} ${sparkleY - sparkleSize}
                L ${sparkleX + sparkleSize * 0.23} ${sparkleY - sparkleSize * 0.23}
                L ${sparkleX + sparkleSize} ${sparkleY}
                L ${sparkleX + sparkleSize * 0.23} ${sparkleY + sparkleSize * 0.23}
                L ${sparkleX} ${sparkleY + sparkleSize}
                L ${sparkleX - sparkleSize * 0.23} ${sparkleY + sparkleSize * 0.23}
                L ${sparkleX - sparkleSize} ${sparkleY}
                L ${sparkleX - sparkleSize * 0.23} ${sparkleY - sparkleSize * 0.23}
                Z
              "
              fill="#ffffff"
              filter="url(#sparkleBlur)"
            />

            <circle
              cx="${sparkleX}"
              cy="${sparkleY}"
              r="${Math.max(
                2.5,
                sparkleSize * 0.15
              )}"
              fill="#ffffff"
            />

          </g>
        `)

      }

    } else {

      /*
       * WORD YANG SUDAH MUNCUL
       */

      elements.push(
        `<g>${renderWord(
          item,
          fontSize,
          assets
        )}</g>`
      )

    }

  }


  /*
   * ACTIVE CLIP
   */

  let activeClip


  if (active) {

    activeClip = `
      <clipPath id="activeClip">

        <rect
          x="${active.x - 40}"
          y="${active.y - fontSize * 1.20}"
          width="${active.width + 80}"
          height="${fontSize * 1.70}"
        />

      </clipPath>
    `

  } else {

    activeClip = `
      <clipPath id="activeClip">

        <rect
          x="0"
          y="0"
          width="${WIDTH}"
          height="${HEIGHT}"
        />

      </clipPath>
    `

  }


  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${WIDTH}"
      height="${HEIGHT}"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
    >

      <defs>

        <filter
          id="shadowBlur"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >

          <feGaussianBlur
            stdDeviation="5"
          />

        </filter>


        <filter
          id="shineBlur"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >

          <feGaussianBlur
            stdDeviation="2.5"
          />

        </filter>


        <filter
          id="sparkleBlur"
          x="-200%"
          y="-200%"
          width="400%"
          height="400%"
        >

          <feGaussianBlur
            stdDeviation="1.5"
          />

        </filter>


        ${activeClip}

      </defs>


      /*
       * BACKGROUND
       */

      <rect
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="#ffffff"
      />


      ${elements.join('')}

    </svg>
  `
}


/* ============================================================
   RENDER FRAME
============================================================ */

async function renderFrame(
  layout,
  fontSize,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
  assets
) {

  const svg =
    createSvg(
      layout,
      fontSize,
      visibleCount,
      activeIndex,
      scale,
      shineProgress,
      assets
    )


  return sharp(
    Buffer.from(svg)
  )
    .png()
    .raw()
    .toBuffer({
      resolveWithObject: true
    })
}


/* ============================================================
   CREATE GIF
============================================================ */

async function createGif(
  text
) {

  const words =
    splitWords(text)


  if (
    !words.length
  ) {

    throw new Error(
      'Text tidak boleh kosong'
    )

  }


  if (
    words.length >
    MAX_WORDS
  ) {

    throw new Error(
      `Maksimal ${MAX_WORDS} kata agar proses tetap cepat`
    )

  }


  const preparedWords =
    prepareWords(
      words
    )


  /*
   * FONT SIZE OTOMATIS
   */

  const fontSize =
    getBestFontSize(
      preparedWords
    )


  console.log(
    'FONT SIZE:',
    fontSize
  )


  /*
   * LAYOUT
   */

  const layout =
    buildLayout(
      preparedWords,
      fontSize
    )


  /*
   * EMOJI
   */

  const assets =
    await prepareEmojiAssets(
      text
    )


  const frames = []


  /*
   * POP ANIMATION
   *
   * kecil
   * naik
   * overshoot
   * normal
   */

  const POP_SCALES = [
    0.58,
    0.78,
    1.05,
    1.11,
    1.04,
    1.00
  ]


  /*
   * SHINE POSITION
   */

  const SHINE = [
    0.00,
    0.08,
    0.24,
    0.48,
    0.72,
    1.00
  ]


  /*
   * SETIAP KATA
   */

  for (
    let wordIndex = 0;
    wordIndex < layout.length;
    wordIndex++
  ) {

    const visibleCount =
      wordIndex + 1


    /*
     * POP FRAMES
     */

    for (
      let frameIndex = 0;
      frameIndex <
      POP_SCALES.length;
      frameIndex++
    ) {

      const frame =
        await renderFrame(
          layout,
          fontSize,
          visibleCount,
          wordIndex,
          POP_SCALES[
            frameIndex
          ],
          SHINE[
            frameIndex
          ],
          assets
        )


      frames.push({

        data:
          frame.data,

        delay:
          frameIndex < 2
            ? 35
            : 40

      })

    }


    /*
     * HOLD
     */

    const hold =
      await renderFrame(
        layout,
        fontSize,
        visibleCount,
        wordIndex,
        1,
        1,
        assets
      )


    frames.push({

      data:
        hold.data,

      delay:
        180

    })

  }


  /*
   * FINAL HOLD
   */

  const finalFrame =
    await renderFrame(
      layout,
      fontSize,
      layout.length,
      -1,
      1,
      1,
      assets
    )


  frames.push({

    data:
      finalFrame.data,

    delay:
      900

  })


  /*
   * GIF ENCODER
   */

  const encoder =
    new GIFEncoder(
      WIDTH,
      HEIGHT,
      'neuquant',
      true
    )


  encoder.setRepeat(0)

  encoder.setQuality(8)

  encoder.start()


  for (
    const frame of frames
  ) {

    encoder.setDelay(
      frame.delay
    )


    encoder.addFrame(
      frame.data
    )

  }


  encoder.finish()


  return encoder.out.getData()
}


/* ============================================================
   UPLOAD TERMAI
============================================================ */

async function uploadTermai(
  imageBuffer
) {

  const form =
    new FormData()


  const blob =
    new Blob(
      [
        imageBuffer
      ],
      {
        type:
          'image/gif'
      }
    )


  form.append(
    'file',
    blob,
    'bratelegan.gif'
  )


  const response =
    await fetch(
      TERMAI_UPLOAD_URL,
      {
        method: 'POST',
        body: form
      }
    )


  if (
    !response.ok
  ) {

    const errorText =
      await response.text()


    throw new Error(
      `Termai HTTP ${response.status}: ${errorText}`
    )

  }


  const data =
    await response.json()


  const imageUrl =
    data?.path ||
    data?.url ||
    data?.data?.url ||
    data?.result?.url


  if (!imageUrl) {

    console.error(
      'TERMAI RESPONSE:',
      data
    )


    throw new Error(
      'URL gambar dari Termai tidak ditemukan'
    )

  }


  return imageUrl
}


/* ============================================================
   GET TEXT
============================================================ */

function getText(req) {

  if (
    req.method ===
    'GET'
  ) {

    return (
      req.query?.text ||
      ''
    )

  }


  if (
    req.method ===
    'POST'
  ) {

    if (
      typeof req.body ===
      'string'
    ) {

      try {

        const body =
          JSON.parse(
            req.body
          )


        return (
          body.text ||
          ''
        )

      } catch {

        return ''

      }

    }


    return (
      req.body?.text ||
      ''
    )

  }


  return ''
}


/* ============================================================
   API
============================================================ */

module.exports =
  async (
    req,
    res
  ) => {

    const started =
      Date.now()


    try {

      /*
       * METHOD
       */

      if (
        req.method !== 'GET' &&
        req.method !== 'POST'
      ) {

        return res
          .status(405)
          .json({

            status:
              false,

            creator:
              'Ndra09',

            error:
              'Gunakan method GET atau POST'

          })

      }


      /*
       * TEXT
       */

      const text =
        String(
          getText(req)
        ).trim()


      if (!text) {

        return res
          .status(400)
          .json({

            status:
              false,

            creator:
              'Ndra09',

            error:
              'Parameter text wajib diisi',

            example:
              '/api/bratelegan?text=halo 😂🔥'

          })

      }


      /*
       * LIMIT
       */

      if (
        text.length > 300
      ) {

        return res
          .status(400)
          .json({

            status:
              false,

            creator:
              'Ndra09',

            error:
              'Text maksimal 300 karakter'

          })

      }


      /*
       * FONT
       */

      if (!font) {

        return res
          .status(500)
          .json({

            status:
              false,

            creator:
              'Ndra09',

            error:
              'Font Aptos.ttf tidak ditemukan. Pastikan file ada di assets/Aptos.ttf'

          })

      }


      /*
       * CREATE GIF
       */

      const gif =
        await createGif(
          text
        )


      console.log(
        'GIF CREATED:',
        gif.length,
        'bytes'
      )


      /*
       * UPLOAD
       */

      const imageUrl =
        await uploadTermai(
          gif
        )


      const elapsed =
        Date.now() -
        started


      console.log(
        'BRAT DONE:',
        elapsed,
        'ms'
      )


      /*
       * RESPONSE
       */

      return res
        .status(200)
        .json({

          status:
            true,

          creator:
            'Ndra09',

          result: {

            text,

            url_gambar:
              imageUrl,

            content_type:
              'image/gif',

            animated:
              true,

            message:
              'Brat Elegan berhasil dibuat',

            processing_time:
              `${elapsed}ms`

          }

        })


    } catch (error) {

      console.error(
        'BRAT ELEGAN ERROR:',
        error
      )


      return res
        .status(500)
        .json({

          status:
            false,

          creator:
            'Ndra09',

          error:
            error.message ||
            'Gagal membuat Brat Elegan'

        })

    }

  }
