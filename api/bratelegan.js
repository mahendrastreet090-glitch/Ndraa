import sharp from 'sharp'
import GIFEncoder from 'gif-encoder-2'
import opentype from 'opentype.js'
import twemoji from 'twemoji'
import emojiRegex from 'emoji-regex'
import path from 'path'
import fs from 'fs'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

const CREATOR = 'Ndra09'

const TERMAI_UPLOAD_URL =
  'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk'

const FONT_PATH = path.join(
  process.cwd(),
  'assets',
  'Aptos.ttf'
)

const WIDTH = 1024
const HEIGHT = 1024

const SIDE_PADDING = 70
const WORD_GAP_RATIO = 0.20

const BOLD_OFFSET = 2.8
const BOLD_STEPS = 8

let font

try {
  font = opentype.loadSync(FONT_PATH)
} catch (error) {
  console.error(
    'FONT LOAD ERROR:',
    error.message
  )
}

// ============================================
// SPLIT WORD
// ============================================

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

// ============================================
// EMOJI
// ============================================

function findEmojiParts(text) {
  const regex = emojiRegex()
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
      value: match[0],
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

// ============================================
// EMOJI ASSET
// ============================================

function loadEmojiAssets(text) {
  const assets = {}

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

  let emojiDir

  try {
    emojiDir =
      path.join(
        path.dirname(
          require.resolve('twemoji')
        ),
        '../assets/svg'
      )
  } catch {
    emojiDir = null
  }

  if (!emojiDir) {
    return assets
  }

  for (
    const code of codes
  ) {
    try {
      const file =
        path.join(
          emojiDir,
          `${code}.svg`
        )

      if (
        !fs.existsSync(file)
      ) {
        continue
      }

      const svg =
        fs.readFileSync(
          file
        )

      assets[code] =
        `data:image/svg+xml;base64,${svg.toString('base64')}`

    } catch (error) {
      console.error(
        'EMOJI ERROR:',
        code,
        error.message
      )
    }
  }

  return assets
}

// ============================================
// FONT
// ============================================

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

function getPartWidth(
  part,
  fontSize
) {
  if (
    part.type === 'emoji'
  ) {
    return fontSize
  }

  return getFontAdvance(
    part.value,
    fontSize
  )
}

function getWordWidth(
  word,
  fontSize
) {
  const parts =
    findEmojiParts(
      word
    )

  let width = 0

  for (
    const part of parts
  ) {
    width +=
      getPartWidth(
        part,
        fontSize
      )
  }

  return width
}

// ============================================
// LINE
// ============================================

function calculateLines(
  words,
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
    const word of words
  ) {
    const wordWidth =
      getWordWidth(
        word,
        fontSize
      )

    const nextWidth =
      current.length
        ? currentWidth +
          gap +
          wordWidth
        : wordWidth

    if (
      current.length &&
      nextWidth >
        maxWidth
    ) {
      lines.push({
        words: current,
        width: currentWidth
      })

      current = [word]

      currentWidth =
        wordWidth
    } else {
      current.push(word)

      currentWidth =
        nextWidth
    }
  }

  if (
    current.length
  ) {
    lines.push({
      words: current,
      width: currentWidth
    })
  }

  return lines
}

// ============================================
// FONT SIZE
// ============================================

function getBestFontSize(
  words
) {
  let size = 145

  while (
    size >= 42
  ) {
    const lines =
      calculateLines(
        words,
        size
      )

    const lineHeight =
      size * 1.16

    const totalHeight =
      lines.length *
      lineHeight

    if (
      totalHeight <=
        HEIGHT - 160 &&
      lines.length <= 5
    ) {
      return size
    }

    size -= 5
  }

  return 42
}

// ============================================
// BOLD TEXT
// ============================================

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
    `<path d="${base.toPathData(2)}" fill="#000000"/>`
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
      `<path d="${bold.toPathData(2)}" fill="#000000"/>`
    )
  }

  return result.join('')
}

// ============================================
// LAYOUT
// ============================================

function buildLayout(
  words,
  fontSize
) {
  const lines =
    calculateLines(
      words,
      fontSize
    )

  const lineHeight =
    fontSize * 1.16

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

  let index = 0

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
      const word of line.words
    ) {
      const parts =
        findEmojiParts(
          word
        )

      const wordWidth =
        getWordWidth(
          word,
          fontSize
        )

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
                fontSize *
                  0.90
            )

          maxY =
            Math.max(
              maxY,
              y
            )
        }

        wordParts.push({
          ...part,
          x: partX,
          width: partWidth
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

        maxY = y
      }

      result.push({
        index,
        word,
        x,
        y,
        width:
          maxX - minX,
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
        parts: wordParts
      })

      x +=
        wordWidth +
        gap

      index++
    }

    y += lineHeight
  }

  return result
}

// ============================================
// RENDER WORD
// ============================================

function renderWord(
  item,
  fontSize,
  assets
) {
  return item.parts
    .map(part => {
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

      const src =
        assets[part.code]

      if (!src) {
        return ''
      }

      const size =
        fontSize

      const emojiY =
        item.y -
        fontSize *
          0.90

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
    })
    .join('')
}

// ============================================
// SVG FRAME
// ============================================

function createSvg(
  layout,
  visibleCount,
  activeIndex,
  scale,
  shine,
  assets,
  fontSize
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

      elements.push(`
        <g transform="${transform}">
          <rect
            x="${item.x - 15}"
            y="${item.y - fontSize}"
            width="${item.width + 30}"
            height="${fontSize * 1.25}"
            rx="${fontSize * 0.12}"
            fill="#000000"
            opacity="0.16"
            filter="url(#shadow)"
            transform="translate(7 9)"
          />

          ${renderWord(
            item,
            fontSize,
            assets
          )}
        </g>
      `)

      if (
        shine < 1
      ) {
        const shineX =
          item.x -
          item.width +
          item.width *
            2 *
            shine

        elements.push(`
          <rect
            x="${shineX}"
            y="${item.y - fontSize}"
            width="${fontSize * 0.16}"
            height="${fontSize * 2}"
            fill="#ffffff"
            opacity="0.95"
            filter="url(#shine)"
            transform="rotate(18 ${shineX} ${item.y})"
          />
        `)
      }

      const sparkleSize =
        Math.max(
          14,
          Math.min(
            30,
            fontSize *
              0.19
          )
        )

      const sparkleX =
        item.x +
        item.width *
          (
            0.15 +
            shine * 0.7
          )

      const sparkleY =
        item.y -
        fontSize *
          0.2

      let opacity = 1

      if (
        shine < 0.2
      ) {
        opacity =
          shine / 0.2
      } else if (
        shine > 0.75
      ) {
        opacity =
          (
            1 - shine
          ) / 0.25
      }

      elements.push(`
        <g opacity="${Math.max(
          0,
          opacity
        )}">
          <path
            d="
              M ${sparkleX} ${sparkleY - sparkleSize}
              L ${sparkleX + sparkleSize * 0.24} ${sparkleY - sparkleSize * 0.24}
              L ${sparkleX + sparkleSize} ${sparkleY}
              L ${sparkleX + sparkleSize * 0.24} ${sparkleY + sparkleSize * 0.24}
              L ${sparkleX} ${sparkleY + sparkleSize}
              L ${sparkleX - sparkleSize * 0.24} ${sparkleY + sparkleSize * 0.24}
              L ${sparkleX - sparkleSize} ${sparkleY}
              L ${sparkleX - sparkleSize * 0.24} ${sparkleY - sparkleSize * 0.24}
              Z
            "
            fill="#ffffff"
            filter="url(#sparkle)"
          />
        </g>
      `)

    } else {
      elements.push(
        renderWord(
          item,
          fontSize,
          assets
        )
      )
    }
  }

  const clip =
    active
      ? `
        <clipPath id="clip">
          <rect
            x="${active.x - 30}"
            y="${active.y - fontSize}"
            width="${active.width + 60}"
            height="${fontSize * 1.5}"
          />
        </clipPath>
      `
      : ''

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${WIDTH}"
      height="${HEIGHT}"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
    >

      <defs>

        <filter
          id="shadow"
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
          id="shine"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur
            stdDeviation="3"
          />
        </filter>

        <filter
          id="sparkle"
          x="-200%"
          y="-200%"
          width="400%"
          height="400%"
        >
          <feGaussianBlur
            stdDeviation="2"
          />
        </filter>

        ${clip}

      </defs>

      <rect
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="#ffffff"
      />

      ${elements.join('')}

    </svg>
  `
}

// ============================================
// RENDER FRAME
// ============================================

async function renderFrame(
  layout,
  visibleCount,
  activeIndex,
  scale,
  shine,
  assets,
  fontSize
) {
  const svg =
    createSvg(
      layout,
      visibleCount,
      activeIndex,
      scale,
      shine,
      assets,
      fontSize
    )

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .raw()
    .toBuffer({
      resolveWithObject:
        true
    })
}

// ============================================
// CREATE GIF
// ============================================

async function createGif(text) {
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
    words.length > 15
  ) {
    throw new Error(
      'Maksimal 15 kata'
    )
  }

  const fontSize =
    getBestFontSize(
      words
    )

  const layout =
    buildLayout(
      words,
      fontSize
    )

  const assets =
    loadEmojiAssets(
      text
    )

  const frames = []

  const POP = [
    0.78,
    0.94,
    1.06,
    1.00
  ]

  const SHINE = [
    0.00,
    0.28,
    0.65,
    1.00
  ]

  for (
    let wordIndex = 0;
    wordIndex <
      words.length;
    wordIndex++
  ) {
    const visibleCount =
      wordIndex + 1

    for (
      let i = 0;
      i < POP.length;
      i++
    ) {
      const frame =
        await renderFrame(
          layout,
          visibleCount,
          wordIndex,
          POP[i],
          SHINE[i],
          assets,
          fontSize
        )

      frames.push({
        data: frame.data,
        delay:
          i === 3
            ? 160
            : 65
      })
    }
  }

  const finalFrame =
    await renderFrame(
      layout,
      words.length,
      -1,
      1,
      1,
      assets,
      fontSize
    )

  frames.push({
    data:
      finalFrame.data,
    delay: 1000
  })

  const encoder =
    new GIFEncoder(
      WIDTH,
      HEIGHT,
      'neuquant',
      true
    )

  encoder.setRepeat(0)
  encoder.setQuality(10)

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

// ============================================
// UPLOAD TERMAI
// ============================================

async function uploadTermai(
  imageBuffer
) {
  const formData =
    new FormData()

  const blob =
    new Blob(
      [imageBuffer],
      {
        type: 'image/gif'
      }
    )

  formData.append(
    'file',
    blob,
    'bratelegan.gif'
  )

  const response =
    await fetch(
      TERMAI_UPLOAD_URL,
      {
        method: 'POST',

        headers: {
          'User-Agent':
            'Mozilla/5.0'
        },

        body: formData
      }
    )

  if (
    !response.ok
  ) {
    throw new Error(
      `Termai HTTP ${response.status}`
    )
  }

  const result =
    await response.json()

  const imageUrl =
    result?.path ||
    result?.url ||
    result?.data?.url

  if (
    !imageUrl
  ) {
    console.error(
      'Response Termai:',
      result
    )

    throw new Error(
      'Termai tidak mengembalikan URL GIF'
    )
  }

  return imageUrl
}

// ============================================
// HANDLER
// ============================================

export default async function handler(
  req,
  res
) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  )

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  )

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  )

  if (
    req.method === 'OPTIONS'
  ) {
    return res
      .status(200)
      .end()
  }

  if (
    req.method !== 'GET' &&
    req.method !== 'POST'
  ) {
    return res
      .status(405)
      .json({
        status: false,
        creator: CREATOR,
        error:
          'Gunakan GET atau POST'
      })
  }

  try {
    let text = ''

    if (
      req.method === 'GET'
    ) {
      text =
        req.query?.text ||
        ''
    } else {
      const body =
        req.body || {}

      if (
        typeof body ===
        'string'
      ) {
        try {
          const parsed =
            JSON.parse(
              body
            )

          text =
            parsed?.text ||
            ''
        } catch {
          text = ''
        }
      } else {
        text =
          body?.text ||
          ''
      }
    }

    text =
      String(
        text
      ).trim()

    if (!text) {
      return res
        .status(400)
        .json({
          status: false,
          creator: CREATOR,
          error:
            'Parameter text wajib diisi',
          example:
            '/api/bratelegan?text=HELO GEYS 🔥'
        })
    }

    if (
      text.length > 300
    ) {
      return res
        .status(400)
        .json({
          status: false,
          creator: CREATOR,
          error:
            'Text maksimal 300 karakter'
        })
    }

    if (!font) {
      return res
        .status(500)
        .json({
          status: false,
          creator: CREATOR,
          error:
            'Font Aptos.ttf tidak ditemukan'
        })
    }

    const gifBuffer =
      await createGif(
        text
      )

    const imageUrl =
      await uploadTermai(
        gifBuffer
      )

    return res
      .status(200)
      .json({
        status: true,
        creator: CREATOR,
        result: {
          text,
          url_gambar:
            imageUrl,
          content_type:
            'image/gif',
          animated: true,
          ukuran: {
            width: WIDTH,
            height: HEIGHT
          },
          message:
            'Brat Elegan berhasil dibuat'
        }
      })

  } catch (error) {
    console.error(
      '[BRAT ELEGAN ERROR]',
      error
    )

    return res
      .status(500)
      .json({
        status: false,
        creator: CREATOR,
        error:
          error?.message ||
          'Gagal membuat Brat Elegan'
      })
  }
}
