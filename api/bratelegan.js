const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')
const opentype = require('opentype.js')
const twemoji = require('twemoji')
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

const BOLD_OFFSET = 3.8
const BOLD_STEPS = 10

const EMOJI_SIZE_MULTIPLIER = 1.05

const CACHE_DIR = '/tmp/twemoji-cache'

let font

try {
  font = opentype.loadSync(FONT_PATH)
} catch (err) {
  console.error(
    'FONT LOAD ERROR:',
    err
  )
}

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(
      CACHE_DIR,
      {
        recursive: true
      }
    )
  }
} catch (err) {
  console.error(
    'CACHE DIR ERROR:',
    err
  )
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text, maxChars) {
  const words =
    text.trim().split(/\s+/)

  const lines = []

  let line = ''

  for (const word of words) {

    if (!line) {
      line = word
      continue
    }

    const test =
      line + ' ' + word

    if (
      test.length <=
      maxChars
    ) {
      line = test
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines.length
    ? lines
    : ['']
}

function getFontSize(text) {

  if (text.length <= 15) {
    return 156
  }

  if (text.length <= 30) {
    return 136
  }

  if (text.length <= 50) {
    return 116
  }

  if (text.length <= 75) {
    return 96
  }

  if (text.length <= 100) {
    return 80
  }

  return 68
}

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function getEmojiCodePoints(emoji) {
  return twemoji.convert.toCodePoint(
    emoji
  )
}

function getEmojiUrl(code) {
  return (
    'https://cdn.jsdelivr.net/gh/' +
    'twitter/twemoji@14.0.2/' +
    'assets/svg/' +
    code +
    '.svg'
  )
}

function downloadFile(url) {

  return new Promise(
    (resolve, reject) => {

      https.get(
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
                Buffer.concat(chunks)
              )
            }
          )

          response.on(
            'error',
            reject
          )
        }
      ).on(
        'error',
        reject
      )
    }
  )
}

async function getEmojiSvg(code) {

  const cacheFile =
    path.join(
      CACHE_DIR,
      `${code}.svg`
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

  const url =
    getEmojiUrl(code)

  const data =
    await downloadFile(url)

  try {
    fs.writeFileSync(
      cacheFile,
      data
    )
  } catch {}

  return data
}

async function prepareEmojiAssets(text) {

  const assets = {}

  twemoji.parse(
    text,
    {
      callback: icon => {

        if (!assets[icon]) {
          assets[icon] = null
        }

        return ''
      }
    }
  )

  const codes =
    Object.keys(assets)

  for (const code of codes) {

    try {

      const svg =
        await getEmojiSvg(code)

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

function parseWordParts(word) {

  const parts = []

  let lastIndex = 0

  const markerStart = '⟦'
  const markerEnd = '⟧'

  const parsed =
    twemoji.parse(
      word,
      {
        callback: icon => {
          return (
            markerStart +
            icon +
            markerEnd
          )
        }
      }
    )

  const regex =
    /⟦([^⟧]+)⟧/g

  let match

  while (
    (match = regex.exec(parsed))
  ) {

    if (
      match.index >
      lastIndex
    ) {

      parts.push({
        type: 'text',
        value:
          parsed.slice(
            lastIndex,
            match.index
          )
      })
    }

    parts.push({
      type: 'emoji',
      code: match[1]
    })

    lastIndex =
      regex.lastIndex
  }

  if (
    lastIndex <
    parsed.length
  ) {

    parts.push({
      type: 'text',
      value:
        parsed.slice(
          lastIndex
        )
    })
  }

  if (!parts.length) {

    parts.push({
      type: 'text',
      value: word
    })
  }

  return parts
}

function getPartWidth(
  part,
  fontSize
) {

  if (
    part.type === 'emoji'
  ) {

    return (
      fontSize *
      EMOJI_SIZE_MULTIPLIER
    )
  }

  return font.getAdvanceWidth(
    part.value,
    fontSize,
    {
      kerning: true
    }
  )
}

function getWordWidth(
  word,
  fontSize
) {

  const parts =
    parseWordParts(word)

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

  result.push(`
    <path
      d="${base.toPathData(2)}"
      fill="#000000"
    />
  `)

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

    result.push(`
      <path
        d="${bold.toPathData(2)}"
        fill="#000000"
      />
    `)
  }

  return result.join('\n')
}

function createTextPart(
  text,
  x,
  y,
  fontSize
) {

  return createBoldTextPath(
    text,
    x,
    y,
    fontSize
  )
}

function createEmojiPart(
  code,
  x,
  y,
  fontSize,
  assets
) {

  const src =
    assets[code]

  if (!src) {
    return ''
  }

  const size =
    fontSize *
    EMOJI_SIZE_MULTIPLIER

  const emojiY =
    y -
    fontSize *
    0.90

  return `
    <image
      href="${src}"
      x="${x}"
      y="${emojiY}"
      width="${size}"
      height="${size}"
      preserveAspectRatio="xMidYMid meet"
    />
  `
}

async function buildLayout(
  words,
  fontSize
) {

  const fullText =
    words.join(' ')

  const maxChars =
    fullText.length <= 25
      ? 16
      : fullText.length <= 50
        ? 18
        : fullText.length <= 80
          ? 21
          : 24

  const lines =
    wrapText(
      fullText,
      maxChars
    )

  const lineHeight =
    fontSize * 1.12

  const totalHeight =
    lines.length *
    lineHeight

  let startY =
    (
      HEIGHT -
      totalHeight
    ) / 2 +
    fontSize

  const result = []

  let globalIndex = 0

  for (const line of lines) {

    const lineWords =
      line.split(/\s+/)

    const data = []

    for (
      const word of lineWords
    ) {

      const width =
        getWordWidth(
          word,
          fontSize
        )

      data.push({
        word,
        width
      })
    }

    const gap =
      fontSize * 0.25

    const lineWidth =
      data.reduce(
        (
          total,
          item
        ) =>
          total +
          item.width,
        0
      ) +
      gap *
      Math.max(
        0,
        data.length - 1
      )

    let x =
      (
        WIDTH -
        lineWidth
      ) / 2

    for (
      const item of data
    ) {

      const parts =
        parseWordParts(
          item.word
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

          const path =
            font.getPath(
              part.value,
              partX,
              startY,
              fontSize
            )

          const box =
            path.getBoundingBox()

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
              startY -
              fontSize *
              0.90
            )

          maxY =
            Math.max(
              maxY,
              startY +
              fontSize *
              0.10
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

      const centerX =
        (
          minX +
          maxX
        ) / 2

      const centerY =
        (
          minY +
          maxY
        ) / 2

      result.push({
        index: globalIndex,
        word: item.word,
        x,
        y: startY,
        width:
          maxX - minX,
        height:
          maxY - minY,
        centerX,
        centerY,
        parts: wordParts
      })

      x +=
        item.width +
        gap

      globalIndex++
    }

    startY +=
      lineHeight
  }

  return result
}

async function createSvg(
  words,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
  assets
) {

  const text =
    words.join(' ')

  const fontSize =
    getFontSize(text)

  const layout =
    await buildLayout(
      words,
      fontSize
    )

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

    const isActive =
      item.index ===
      activeIndex

    if (isActive) {

      const cx =
        item.centerX

      const cy =
        item.centerY

      const transform =
        `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`

      elements.push(`
        <g
          transform="${transform}"
        >

          <rect
            x="${item.x - 10}"
            y="${item.y - fontSize}"
            width="${item.width + 20}"
            height="${fontSize * 1.35}"
            rx="${fontSize * 0.15}"
            fill="#000000"
            opacity="0.18"
            filter="url(#shadowBlur)"
            transform="translate(5 7)"
          />

          ${item.parts.map(
            part => {

              if (
                part.type ===
                'text'
              ) {

                return createTextPart(
                  part.value,
                  part.x,
                  item.y,
                  fontSize
                )
              }

              return createEmojiPart(
                part.code,
                part.x,
                item.y,
                fontSize,
                assets
              )
            }
          ).join('\n')}

        </g>
      `)

      if (shineProgress < 1) {

        const shineX =
          item.x -
          item.width * 1.5 +
          item.width *
          4 *
          shineProgress

        elements.push(`
          <g
            transform="${transform}"
            clip-path="url(#activeClip)"
          >

            <rect
              x="${shineX}"
              y="${item.y - fontSize}"
              width="${fontSize * 0.25}"
              height="${fontSize * 2.4}"
              rx="${fontSize * 0.12}"
              fill="#ffffff"
              opacity="0.95"
              transform="rotate(18 ${shineX} ${item.y})"
              filter="url(#shineBlur)"
            />

          </g>
        `)
      }

      const sparkleSize =
        Math.max(
          16,
          Math.min(
            34,
            fontSize * 0.22
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
        fontSize * 0.22

      let sparkleOpacity = 1

      if (
        shineProgress <
        0.15
      ) {

        sparkleOpacity =
          shineProgress /
          0.15

      } else if (
        shineProgress >
        0.75
      ) {

        sparkleOpacity =
          (
            1 -
            shineProgress
          ) / 0.25
      }

      elements.push(`
        <g
          opacity="${Math.max(
            0,
            sparkleOpacity
          )}"
          transform="${transform}"
        >

          <path
            d="
              M ${sparkleX} ${sparkleY - sparkleSize}
              L ${sparkleX + sparkleSize * 0.25} ${sparkleY - sparkleSize * 0.25}
              L ${sparkleX + sparkleSize} ${sparkleY}
              L ${sparkleX + sparkleSize * 0.25} ${sparkleY + sparkleSize * 0.25}
              L ${sparkleX} ${sparkleY + sparkleSize}
              L ${sparkleX - sparkleSize * 0.25} ${sparkleY + sparkleSize * 0.25}
              L ${sparkleX - sparkleSize} ${sparkleY}
              L ${sparkleX - sparkleSize * 0.25} ${sparkleY - sparkleSize * 0.25}
              Z
            "
            fill="#ffffff"
            filter="url(#sparkleBlur)"
          />

          <circle
            cx="${sparkleX}"
            cy="${sparkleY}"
            r="${Math.max(
              3,
              sparkleSize * 0.16
            )}"
            fill="#ffffff"
          />

        </g>
      `)

    } else {

      elements.push(`
        <g>
          ${item.parts.map(
            part => {

              if (
                part.type ===
                'text'
              ) {

                return createTextPart(
                  part.value,
                  part.x,
                  item.y,
                  fontSize
                )
              }

              return createEmojiPart(
                part.code,
                part.x,
                item.y,
                fontSize,
                assets
              )
            }
          ).join('\n')}
        </g>
      `)
    }
  }

  let activeClip

  if (active) {

    activeClip = `
      <clipPath
        id="activeClip"
      >
        <rect
          x="${active.x - 20}"
          y="${active.y - fontSize}"
          width="${active.width + 40}"
          height="${fontSize * 1.5}"
        />
      </clipPath>
    `

  } else {

    activeClip = `
      <clipPath
        id="activeClip"
      >
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
            stdDeviation="6"
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
            stdDeviation="4"
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
            stdDeviation="3"
          />
        </filter>

        ${activeClip}

      </defs>

      <rect
        x="0"
        y="0"
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="#ffffff"
      />

      ${elements.join('\n')}

    </svg>
  `
}

async function renderFrame(
  words,
  visibleCount,
  activeIndex,
  scale,
  shineProgress,
  assets
) {

  const svg =
    await createSvg(
      words,
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

async function createGif(text) {

  const words =
    splitWords(text)

  if (!words.length) {
    throw new Error(
      'Text tidak boleh kosong'
    )
  }

  const assets =
    await prepareEmojiAssets(
      text
    )

  const frames = []

  const POP_SCALES = [
    0.62,
    0.76,
    0.88,
    0.98,
    1.06,
    1.10,
    1.05,
    1.00
  ]

  const SHINE = [
    0.00,
    0.08,
    0.20,
    0.36,
    0.55,
    0.72,
    0.88,
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
      let frameIndex = 0;
      frameIndex <
      POP_SCALES.length;
      frameIndex++
    ) {

      const frame =
        await renderFrame(
          words,
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
        data: frame.data,
        delay: 55
      })
    }

    const hold =
      await renderFrame(
        words,
        visibleCount,
        wordIndex,
        1,
        1,
        assets
      )

    frames.push({
      data: hold.data,
      delay: 350
    })
  }

  const finalFrame =
    await renderFrame(
      words,
      words.length,
      -1,
      1,
      1,
      assets
    )

  frames.push({
    data: finalFrame.data,
    delay: 1800
  })

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
              'Font Aptos.ttf tidak ditemukan. Pastikan file ada di assets/Aptos.ttf'
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
