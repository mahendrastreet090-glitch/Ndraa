const sharp = require('sharp')
const GIFEncoder = require('gif-encoder-2')
const opentype = require('opentype.js')
const path = require('path')

const FONT_PATH = path.join(process.cwd(), 'assets', 'Aptos.ttf')

const WIDTH = 512
const HEIGHT = 512

const BOLD_OFFSET = 2.2
const BOLD_STEPS = 8

let font

try {
  font = opentype.loadSync(FONT_PATH)
} catch (err) {
  console.error('FONT LOAD ERROR:', err)
}

function wrapText(text, maxChars) {
  const words = text.trim().split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    if (!line) {
      line = word
      continue
    }

    const test = line + ' ' + word

    if (test.length <= maxChars) {
      line = test
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines.length ? lines : ['']
}

function getFontSize(text) {
  if (text.length <= 15) return 78
  if (text.length <= 30) return 68
  if (text.length <= 50) return 58
  if (text.length <= 75) return 48
  if (text.length <= 100) return 40

  return 34
}

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function getWordWidth(word, fontSize) {
  return font.getAdvanceWidth(
    word,
    fontSize,
    {
      kerning: true
    }
  )
}

function createBoldPath(word, x, y, fontSize) {
  const paths = []

  const basePath = font.getPath(
    word,
    x,
    y,
    fontSize
  )

  const baseData = basePath.toPathData(2)

  paths.push(`
    <path
      d="${baseData}"
      fill="#000000"
    />
  `)

  const radius = BOLD_OFFSET

  for (
    let i = 0;
    i < BOLD_STEPS;
    i++
  ) {
    const angle =
      (Math.PI * 2 * i) /
      BOLD_STEPS

    const dx =
      Math.cos(angle) * radius

    const dy =
      Math.sin(angle) * radius

    const boldPath = font.getPath(
      word,
      x + dx,
      y + dy,
      fontSize
    )

    paths.push(`
      <path
        d="${boldPath.toPathData(2)}"
        fill="#000000"
      />
    `)
  }

  return paths.join('\n')
}

function createSinglePath(
  word,
  x,
  y,
  fontSize
) {
  return font
    .getPath(
      word,
      x,
      y,
      fontSize
    )
    .toPathData(2)
}

function buildLayout(words, fontSize) {
  const fullText =
    words.join(' ')

  const maxChars =
    fullText.length <= 25 ? 16 :
    fullText.length <= 50 ? 18 :
    fullText.length <= 80 ? 21 :
    24

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
    (HEIGHT - totalHeight) / 2 +
    fontSize

  const result = []

  let wordIndex = 0

  for (const line of lines) {

    const lineWords =
      line.split(/\s+/)

    const wordData = []

    for (const word of lineWords) {

      const tempPath =
        font.getPath(
          word,
          0,
          0,
          fontSize
        )

      const box =
        tempPath.getBoundingBox()

      const width =
        getWordWidth(
          word,
          fontSize
        )

      wordData.push({
        word,
        width,
        box
      })
    }

    const gap =
      fontSize * 0.28

    const lineWidth =
      wordData.reduce(
        (total, item) =>
          total + item.width,
        0
      ) +
      gap *
      Math.max(
        0,
        wordData.length - 1
      )

    let x =
      (WIDTH - lineWidth) / 2

    for (const item of wordData) {

      const tempPath =
        font.getPath(
          item.word,
          x,
          startY,
          fontSize
        )

      const box =
        tempPath.getBoundingBox()

      const centerX =
        (box.x1 + box.x2) / 2

      const centerY =
        (box.y1 + box.y2) / 2

      const actualWidth =
        box.x2 - box.x1

      const actualHeight =
        box.y2 - box.y1

      result.push({
        index: wordIndex,
        word: item.word,
        x,
        y: startY,
        width: actualWidth,
        height: actualHeight,
        centerX,
        centerY,
        path:
          createSinglePath(
            item.word,
            x,
            startY,
            fontSize
          ),
        advance: item.width
      })

      x +=
        item.width +
        gap

      wordIndex++
    }

    startY += lineHeight
  }

  return result
}

function createSvg(
  words,
  visibleCount,
  activeIndex,
  scale,
  shineProgress
) {
  const fontSize =
    getFontSize(
      words.join(' ')
    )

  const layout =
    buildLayout(
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

  for (const item of layout) {

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

          <path
            d="${item.path}"
            fill="#000000"
            opacity="0.28"
            filter="url(#shadowBlur)"
            transform="translate(3 4)"
          />

          ${createBoldPath(
            item.word,
            item.x,
            item.y,
            fontSize
          )}

        </g>
      `)

      const shineX =
        item.x -
        item.width * 1.5 +
        item.width *
        4 *
        shineProgress

      elements.push(`
        <g
          clip-path="url(#activeWordClip)"
          transform="${transform}"
        >

          <rect
            x="${shineX}"
            y="${item.y - fontSize}"
            width="${Math.max(
              18,
              fontSize * 0.20
            )}"
            height="${fontSize * 2.5}"
            rx="${fontSize * 0.1}"
            fill="#ffffff"
            opacity="0.95"
            transform="rotate(18 ${shineX} ${item.y})"
            filter="url(#shineBlur)"
          />

        </g>
      `)

      const sparkleSize =
        Math.max(
          10,
          Math.min(
            20,
            fontSize * 0.24
          )
        )

      const sparkleX =
        item.x +
        item.width *
        (
          0.20 +
          shineProgress *
          0.60
        )

      const sparkleY =
        item.y -
        fontSize * 0.25

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
          (1 -
            shineProgress) /
          0.25
      }

      elements.push(`
        <g
          opacity="${Math.max(
            0,
            sparkleOpacity
          )}"
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
              2,
              sparkleSize * 0.16
            )}"
            fill="#ffffff"
          />

        </g>
      `)

    } else {

      elements.push(`
        ${createBoldPath(
          item.word,
          item.x,
          item.y,
          fontSize
        )}
      `)
    }
  }

  let clipPath

  if (active) {

    clipPath = `
      <clipPath
        id="activeWordClip"
      >
        <path
          d="${active.path}"
        />
      </clipPath>
    `

  } else {

    clipPath = `
      <clipPath
        id="activeWordClip"
      >
        <rect
          x="0"
          y="0"
          width="512"
          height="512"
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
            stdDeviation="3"
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
            stdDeviation="2"
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

        ${clipPath}

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
  shineProgress
) {
  const svg =
    createSvg(
      words,
      visibleCount,
      activeIndex,
      scale,
      shineProgress
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

  const frames = []

  const POP_SCALES = [
    0.68,
    0.82,
    0.94,
    1.04,
    1.08,
    1.03,
    1.00
  ]

  const SHINE = [
    0.00,
    0.12,
    0.28,
    0.48,
    0.68,
    0.86,
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
          ]
        )

      frames.push({
        data: frame.data,
        delay: 60
      })
    }

    const hold =
      await renderFrame(
        words,
        visibleCount,
        wordIndex,
        1,
        1
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
      1
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

  if (req.method === 'GET') {
    return req.query?.text || ''
  }

  if (req.method === 'POST') {

    if (
      typeof req.body ===
      'string'
    ) {

      try {

        const body =
          JSON.parse(req.body)

        return body.text || ''

      } catch {

        return ''
      }
    }

    return req.body?.text || ''
  }

  return ''
}

module.exports =
  async (req, res) => {

    try {

      if (
        req.method !== 'GET' &&
        req.method !== 'POST'
      ) {

        return res.status(405).json({
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

        return res.status(400).json({
          status: false,
          creator: 'Ndra09',
          error:
            'Parameter text wajib diisi',
          example:
            '/api/bratelegan?text=halo dunia'
        })
      }

      if (text.length > 300) {

        return res.status(400).json({
          status: false,
          creator: 'Ndra09',
          error:
            'Text maksimal 300 karakter'
        })
      }

      if (!font) {

        return res.status(500).json({
          status: false,
          creator: 'Ndra09',
          error:
            'Font Aptos.ttf tidak ditemukan. Pastikan file ada di assets/Aptos.ttf'
        })
      }

      const result =
        await createGif(text)

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

      return res.status(500).json({
        status: false,
        creator: 'Ndra09',
        error:
          error.message ||
          'Gagal membuat Brat Elegan'
      })
    }
  }
