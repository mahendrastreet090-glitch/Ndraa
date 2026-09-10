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
  console.error('FONT LOAD ERROR:', err.message)
}

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, {
      recursive: true
    })
  }
} catch (err) {
  console.error('CACHE DIR ERROR:', err.message)
}

function splitWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      response => {
        if (response.statusCode !== 200) {
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
  })
}

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

  if (
    !parts.length
  ) {
    parts.push({
      type: 'text',
      value: text
    })
  }

  return parts
}

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

function prepareWords(words) {
  return words.map(
    word => ({
      word,
      parts:
        findEmojiParts(
          word
        )
    })
  )
}

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

function createBoldTextPath(
  text,
  x,
  y,
  fontSize,
  fill = '#000000'
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
    )}" fill="${fill}"/>`
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
      )}" fill="${fill}"/>`
    )
  }

  return result.join('')
}

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
      const wordParts = []

      let partX = x

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      for (
        const part of item.parts
      ) {
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
          x: partX,
          width:
            partWidth
        })

        partX +=
          partWidth
      }

      result.push({
        index:
          result.length,
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
        item.width +
        gap
    }

    y += lineHeight
  }

  return result
}

function renderWord(
  item,
  fontSize,
  assets,
  color = '#000000'
) {
  return item.parts
    .map(
      part => {
        if (
          part.type === 'text'
        ) {
          return createBoldTextPath(
            part.value,
            part.x,
            item.y,
            fontSize,
            color
          )
        }

        const src =
          assets[
            part.code
          ]

        if (!src) {
          return ''
        }

        const size =
          fontSize

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

function renderWordGray(
  item,
  fontSize,
  assets
) {
  return item.parts
    .map(
      part => {
        if (
          part.type === 'text'
        ) {
          return createBoldTextPath(
            part.value,
            part.x,
            item.y,
            fontSize,
            '#bdbdbd'
          )
        }

        const src =
          assets[
            part.code
          ]

        if (!src) {
          return ''
        }

        const size =
          fontSize

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
            opacity="0.28"
            preserveAspectRatio="xMidYMid meet"
          />
        `
      }
    )
    .join('')
}

function renderLayout(
  layout,
  fontSize,
  assets,
  visibleCount,
  grayFirst
) {
  return layout
    .map(
      item => {
        if (
          item.index >=
          visibleCount
        ) {
          return ''
        }

        if (
          grayFirst &&
          item.index === 0
        ) {
          return `
            <g>
              ${renderWordGray(
                item,
                fontSize,
                assets
              )}
            </g>
          `
        }

        return `
          <g>
            ${renderWord(
              item,
              fontSize,
              assets
            )}
          </g>
        `
      }
    )
    .join('')
}

function createSvg(
  layout,
  fontSize,
  visibleCount,
  activeIndex,
  activeScale,
  wobbleRotate,
  wobbleY,
  grayFirst,
  shineProgress,
  showShine
) {
  const assets =
    createSvg.assets

  const normal =
    renderLayout(
      layout,
      fontSize,
      assets,
      visibleCount,
      grayFirst
    )

  let active = ''

  if (
    activeIndex >= 0 &&
    activeIndex < layout.length
  ) {
    const item =
      layout[
        activeIndex
      ]

    const cx =
      item.centerX

    const cy =
      item.centerY

    active = `
      <g
        transform="
          translate(${cx} ${cy})
          translate(0 ${wobbleY})
          rotate(${wobbleRotate})
          scale(${activeScale})
          translate(${-cx} ${-cy})
        "
      >
        ${renderWord(
          item,
          fontSize,
          assets
        )}
      </g>
    `
  }

  let wobbleGroup = ''

  if (
    activeIndex < 0
  ) {
    wobbleGroup = `
      <g
        transform="
          translate(
            0 ${wobbleY}
          )
          rotate(
            ${wobbleRotate}
            ${WIDTH / 2}
            ${HEIGHT / 2}
          )
        "
      >
        ${normal}
      </g>
    `
  } else {
    wobbleGroup = normal
  }

  let shine = ''

  if (
    showShine
  ) {
    const shineX =
      -fontSize * 2 +
      (
        WIDTH +
        fontSize * 4
      ) *
      shineProgress

    const shineWidth =
      fontSize * 0.28

    shine = `
      <g
        transform="
          rotate(
            16
            ${shineX}
            ${HEIGHT / 2}
          )
        "
        opacity="0.95"
      >
        <rect
          x="${shineX - shineWidth}"
          y="-300"
          width="${shineWidth}"
          height="${HEIGHT + 600}"
          fill="#ffffff"
          opacity="0.90"
          filter="url(#shineBlur)"
        />

        <rect
          x="${shineX - shineWidth * 0.22}"
          y="-300"
          width="${shineWidth * 0.44}"
          height="${HEIGHT + 600}"
          fill="#ffffff"
          opacity="0.92"
        />
      </g>
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
          id="shineBlur"
          x="-300%"
          y="-30%"
          width="600%"
          height="160%"
        >
          <feGaussianBlur
            stdDeviation="9"
          />
        </filter>

      </defs>

      <rect
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="#ffffff"
      />

      ${wobbleGroup}

      ${active}

      ${
        showShine
          ? `
            <g>
              ${renderLayout(
                layout,
                fontSize,
                assets,
                layout.length,
                grayFirst
              )}
            </g>

            ${shine}
          `
          : ''
      }

    </svg>
  `
}

async function renderFrame(
  layout,
  fontSize,
  visibleCount,
  activeIndex,
  activeScale,
  wobbleRotate,
  wobbleY,
  grayFirst,
  shineProgress,
  showShine,
  assets
) {
  createSvg.assets =
    assets

  const svg =
    createSvg(
      layout,
      fontSize,
      visibleCount,
      activeIndex,
      activeScale,
      wobbleRotate,
      wobbleY,
      grayFirst,
      shineProgress,
      showShine
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

  const fontSize =
    getBestFontSize(
      preparedWords
    )

  console.log(
    'FONT SIZE:',
    fontSize
  )

  const layout =
    buildLayout(
      preparedWords,
      fontSize
    )

  const assets =
    await prepareEmojiAssets(
      text
    )

  const frames = []

  const entranceScales = [
    0.35,
    0.58,
    0.78,
    0.94,
    1.06,
    1.02,
    1.00
  ]

  for (
    let wordIndex = 0;
    wordIndex <
    layout.length;
    wordIndex++
  ) {
    for (
      let i = 0;
      i <
      entranceScales.length;
      i++
    ) {
      const frame =
        await renderFrame(
          layout,
          fontSize,
          wordIndex + 1,
          wordIndex,
          entranceScales[i],
          0,
          0,
          false,
          1,
          false,
          assets
        )

      frames.push({
        data:
          frame.data,
        delay:
          i === 0
            ? 45
            : i === 1
              ? 38
              : 32
      })
    }

    const hold =
      await renderFrame(
        layout,
        fontSize,
        wordIndex + 1,
        -1,
        1,
        0,
        0,
        false,
        1,
        false,
        assets
      )

    frames.push({
      data:
        hold.data,
      delay:
        70
    })
  }

  const wobbleFrames = [
    {
      rotate: 0,
      y: 0,
      delay: 45
    },
    {
      rotate: -1.8,
      y: -7,
      delay: 42
    },
    {
      rotate: 1.8,
      y: 3,
      delay: 42
    },
    {
      rotate: -1.3,
      y: -4,
      delay: 42
    },
    {
      rotate: 1.1,
      y: 2,
      delay: 42
    },
    {
      rotate: -0.6,
      y: -1,
      delay: 42
    },
    {
      rotate: 0,
      y: 0,
      delay: 80
    }
  ]

  for (
    const wobble of wobbleFrames
  ) {
    const frame =
      await renderFrame(
        layout,
        fontSize,
        layout.length,
        -1,
        1,
        wobble.rotate,
        wobble.y,
        false,
        1,
        false,
        assets
      )

    frames.push({
      data:
        frame.data,
      delay:
        wobble.delay
    })
  }

  const grayBlink =
    await renderFrame(
      layout,
      fontSize,
      layout.length,
      -1,
      1,
      0,
      0,
      true,
      1,
      false,
      assets
    )

  frames.push({
    data:
      grayBlink.data,
    delay:
      75
  })

  const blackReturn =
    await renderFrame(
      layout,
      fontSize,
      layout.length,
      -1,
      1,
      0,
      0,
      false,
      1,
      false,
      assets
    )

  frames.push({
    data:
      blackReturn.data,
    delay:
      55
  })

  const shineProgress = [
    0.00,
    0.08,
    0.18,
    0.28,
    0.38,
    0.48,
    0.58,
    0.68,
    0.78,
    0.88,
    1.00
  ]

  for (
    let i = 0;
    i <
    shineProgress.length;
    i++
  ) {
    const frame =
      await renderFrame(
        layout,
        fontSize,
        layout.length,
        -1,
        1,
        0,
        0,
        false,
        shineProgress[i],
        true,
        assets
      )

    frames.push({
      data:
        frame.data,
      delay:
        i ===
        shineProgress.length - 1
          ? 700
          : 35
    })
  }

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

async function uploadTermai(
  imageBuffer
) {
  const form =
    new FormData()

  const blob =
    new Blob(
      [imageBuffer],
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
    const started =
      Date.now()

    try {
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
              '/api/bratelegan?text=selain donatur dilarang ngatur 😂'
          })
      }

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

      const gif =
        await createGif(
          text
        )

      console.log(
        'GIF CREATED:',
        gif.length,
        'bytes'
      )

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
