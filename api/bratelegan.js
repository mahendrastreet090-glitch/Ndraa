const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')
const opentype = require('opentype.js')
const twemoji = require('twemoji')
const emojiRegex = require('emoji-regex')
const path = require('path')
const fs = require('fs')

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
} catch (err) {
  console.error('FONT LOAD ERROR:', err.message)
}

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function findEmojiParts(text) {
  const regex = emojiRegex()
  const parts = []

  let lastIndex = 0
  let match

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: text.slice(lastIndex, match.index)
      })
    }

    parts.push({
      type: 'emoji',
      value: match[0],
      code: twemoji.convert.toCodePoint(match[0])
    })

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      value: text.slice(lastIndex)
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

function loadEmojiAssets(text) {
  const assets = {}
  const regex = emojiRegex()
  const codes = new Set()

  let match

  while ((match = regex.exec(text))) {
    codes.add(
      twemoji.convert.toCodePoint(match[0])
    )
  }

  let emojiDir

  try {
    emojiDir = path.join(
      path.dirname(require.resolve('twemoji')),
      '../assets/svg'
    )
  } catch {
    emojiDir = null
  }

  for (const code of codes) {
    if (!emojiDir) continue

    const file = path.join(
      emojiDir,
      `${code}.svg`
    )

    try {
      if (!fs.existsSync(file)) continue

      const svg = fs.readFileSync(file)

      assets[code] =
        `data:image/svg+xml;base64,${svg.toString('base64')}`
    } catch (err) {
      console.error(
        'EMOJI LOAD ERROR:',
        code,
        err.message
      )
    }
  }

  return assets
}

function getFontAdvance(text, fontSize) {
  if (!text) return 0

  return font.getAdvanceWidth(
    text,
    fontSize,
    {
      kerning: true
    }
  )
}

function getPartWidth(part, fontSize) {
  if (part.type === 'emoji') {
    return fontSize * 0.98
  }

  return getFontAdvance(
    part.value,
    fontSize
  )
}

function getWordWidth(word, fontSize) {
  const parts = findEmojiParts(word)

  let width = 0

  for (const part of parts) {
    width += getPartWidth(
      part,
      fontSize
    )
  }

  return width
}

function calculateLines(words, fontSize) {
  const maxWidth =
    WIDTH -
    SIDE_PADDING * 2

  const gap =
    fontSize *
    WORD_GAP_RATIO

  const lines = []

  let current = []
  let currentWidth = 0

  for (const word of words) {
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
      nextWidth > maxWidth
    ) {
      lines.push({
        words: current,
        width: currentWidth
      })

      current = [word]
      currentWidth = wordWidth
    } else {
      current.push(word)
      currentWidth = nextWidth
    }
  }

  if (current.length) {
    lines.push({
      words: current,
      width: currentWidth
    })
  }

  return lines
}

function getBestFontSize(words) {
  let size = 145

  while (size >= 42) {
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
      totalHeight <= HEIGHT - 160 &&
      lines.length <= 5
    ) {
      return size
    }

    size -= 5
  }

  return 42
}

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

  let globalIndex = 0

  for (const line of lines) {
    const gap =
      fontSize *
      WORD_GAP_RATIO

    let x =
      (
        WIDTH -
        line.width
      ) / 2

    for (const word of line.words) {
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

      for (const part of parts) {
        const partWidth =
          getPartWidth(
            part,
            fontSize
          )

        if (
          part.type === 'text'
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
              fontSize * 0.90
            )

          maxY =
            Math.max(
              maxY,
              y +
              fontSize * 0.10
            )
        }

        wordParts.push({
          ...part,
          x: partX,
          width: partWidth
        })

        partX += partWidth
      }

      if (minX === Infinity) {
        minX = x
        maxX = x + wordWidth
        minY = y - fontSize
        maxY = y
      }

      result.push({
        index: globalIndex,
        word,
        x,
        y,
        width: maxX - minX,
        height: maxY - minY,
        centerX:
          (minX + maxX) / 2,
        centerY:
          (minY + maxY) / 2,
        parts: wordParts
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

function renderWord(
  item,
  fontSize,
  assets
) {
  return item.parts
    .map(part => {
      if (
        part.type === 'text'
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

      if (!src) return ''

      const size =
        fontSize * 0.98

      const emojiY =
        item.y -
        fontSize * 0.90

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

function createSvg(
  layout,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
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

  for (const item of layout) {
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
            opacity="0.18"
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
        shineProgress < 1
      ) {
        const shineX =
          item.x -
          item.width * 1.2 +
          item.width *
          2.4 *
          shineProgress

        elements.push(`
          <g
            transform="${transform}"
            clip-path="url(#clip)"
          >
            <rect
              x="${shineX}"
              y="${item.y - fontSize}"
              width="${fontSize * 0.18}"
              height="${fontSize * 2.2}"
              fill="#ffffff"
              opacity="0.95"
              transform="rotate(18 ${shineX} ${item.y})"
              filter="url(#shine)"
            />
          </g>
        `)
      }

      const sparkleSize =
        Math.max(
          14,
          Math.min(
            30,
            fontSize * 0.19
          )
        )

      const sparkleX =
        item.x +
        item.width *
        (
          0.15 +
          shineProgress *
          0.70
        )

      const sparkleY =
        item.y -
        fontSize * 0.20

      let opacity = 1

      if (
        shineProgress < 0.18
      ) {
        opacity =
          shineProgress /
          0.18
      } else if (
        shineProgress > 0.75
      ) {
        opacity =
          (
            1 -
            shineProgress
          ) /
          0.25
      }

      elements.push(`
        <g
          opacity="${Math.max(
            0,
            opacity
          )}"
        >
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

  let clip

  if (active) {
    clip = `
      <clipPath id="clip">
        <rect
          x="${active.x - 30}"
          y="${active.y - fontSize}"
          width="${active.width + 60}"
          height="${fontSize * 1.5}"
        />
      </clipPath>
    `
  } else {
    clip = `
      <clipPath id="clip">
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
            stdDeviation="2.5"
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

async function renderFrame(
  layout,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
  assets,
  fontSize
) {
  const svg =
    createSvg(
      layout,
      visibleCount,
      activeIndex,
      scale,
      shineProgress,
      assets,
      fontSize
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

async function createGif(text) {
  const words =
    splitWords(text)

  if (!words.length) {
    throw new Error(
      'Text tidak boleh kosong'
    )
  }

  if (words.length > 20) {
    throw new Error(
      'Maksimal 20 kata untuk menjaga proses tetap cepat'
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
    0.72,
    0.90,
    1.05,
    1.00
  ]

  const SHINE = [
    0.00,
    0.25,
    0.60,
    1.00
  ]

  for (
    let wordIndex = 0;
    wordIndex < words.length;
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
          i === POP.length - 1
            ? 180
            : 70
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
    data: finalFrame.data,
    delay: 1200
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

  for (const frame of frames) {
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

function getText(req) {
  if (
    req.method === 'GET'
  ) {
    return (
      req.query?.text ||
      ''
    )
  }

  if (
    req.method === 'POST'
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

module.exports =
  async (
    req,
    res
  ) => {
    try {
      if (
        req.method !== 'GET' &&
        req.method !== 'POST'
      ) {
        return res
          .status(405)
          .json({
            status: false,
            creator: 'Ndra09',
            error:
              'Gunakan method GET atau POST'
          })
      }

      const text =
        String(
          getText(req)
        ).trim()

      if (!text) {
        return res
          .status(400)
          .json({
            status: false,
            creator: 'Ndra09',
            error:
              'Parameter text wajib diisi',
            example:
              '/api/bratelegan?text=halo 😂🔥'
          })
      }

      if (
        text.length > 300
      ) {
        return res
          .status(400)
          .json({
            status: false,
            creator: 'Ndra09',
            error:
              'Text maksimal 300 karakter'
          })
      }

      if (!font) {
        return res
          .status(500)
          .json({
            status: false,
            creator: 'Ndra09',
            error:
              'Font Aptos.ttf tidak ditemukan'
          })
      }

      const result =
        await createGif(
          text
        )

      res.setHeader(
        'Content-Type',
        'image/gif'
      )

      res.setHeader(
        'Content-Disposition',
        'inline; filename="bratelegan.gif"'
      )

      res.setHeader(
        'Cache-Control',
        'no-store'
      )

      return res
        .status(200)
        .send(result)

    } catch (error) {
      console.error(
        'BRAT ELEGAN ERROR:',
        error
      )

      return res
        .status(500)
        .json({
          status: false,
          creator: 'Ndra09',
          error:
            error.message ||
            'Gagal membuat Brat Elegan'
        })
    }
  }
