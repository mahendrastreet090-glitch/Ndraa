const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const IMAGE_PATH = path.join(
    process.cwd(),
    "assets",
    "bratpatrick.png"
);

/*
|--------------------------------------------------------------------------
| BRAT PATRICK API
|--------------------------------------------------------------------------
| POST /api/bratpatrick
|
| JSON:
| {
|   "text": "HALO DUNIA"
| }
|
| atau:
|
| {
|   "text": "HALO DUNIA",
|   "fontSize": 70
| }
|
|--------------------------------------------------------------------------
*/

function escapeXml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}


/*
|--------------------------------------------------------------------------
| TEXT WRAPPER
|--------------------------------------------------------------------------
*/

function wrapText(text, maxChars) {

    const words = String(text)
        .trim()
        .split(/\s+/);

    const lines = [];

    let current = "";

    for (const word of words) {

        const test =
            current
                ? current + " " + word
                : word;

        if (test.length <= maxChars) {

            current = test;

        } else {

            if (current) {
                lines.push(current);
            }

            /*
             * Kalau satu kata sendiri terlalu panjang,
             * potong supaya tetap masuk kertas.
             */

            if (word.length > maxChars) {

                let remaining = word;

                while (
                    remaining.length > maxChars
                ) {

                    lines.push(
                        remaining.slice(
                            0,
                            maxChars
                        )
                    );

                    remaining =
                        remaining.slice(
                            maxChars
                        );
                }

                current = remaining;

            } else {

                current = word;

            }
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines;
}


/*
|--------------------------------------------------------------------------
| CREATE TEXT SVG
|--------------------------------------------------------------------------
*/

function createTextSvg(
    text,
    fontSize = 62
) {

    /*
     * Area kertas pada gambar 1536x1536
     *
     * Kiri   : ~435
     * Kanan  : ~1110
     * Atas   : ~755
     * Bawah  : ~1260
     */

    const paperX = 445;
    const paperY = 755;

    const paperWidth = 665;
    const paperHeight = 500;

    /*
     * Padding supaya tulisan tidak
     * terlalu dekat dengan pinggir kertas.
     */

    const paddingX = 55;

    const maxChars =
        Math.max(
            8,
            Math.floor(
                (paperWidth - paddingX * 2) /
                (fontSize * 0.55)
            )
        );

    const lines =
        wrapText(
            text,
            maxChars
        );


    /*
     * Batasi maksimal baris.
     */

    const maxLines = 6;

    if (lines.length > maxLines) {

        lines.length = maxLines;

        let last =
            lines[maxLines - 1];

        if (
            !last.endsWith("...")
        ) {

            last =
                last.slice(
                    0,
                    Math.max(
                        1,
                        last.length - 3
                    )
                ) + "...";

        }

        lines[maxLines - 1] =
            last;
    }


    /*
     * Otomatis mengecilkan font
     * kalau jumlah baris banyak.
     */

    let actualFontSize =
        Number(fontSize) || 62;

    if (lines.length >= 5) {

        actualFontSize =
            Math.min(
                actualFontSize,
                52
            );

    } else if (lines.length >= 4) {

        actualFontSize =
            Math.min(
                actualFontSize,
                58
            );
    }


    const lineHeight =
        actualFontSize * 1.2;

    const totalHeight =
        lines.length *
        lineHeight;

    const startY =
        paperY +
        (paperHeight - totalHeight) / 2 +
        actualFontSize;


    const textElements =
        lines
            .map(
                (line, index) => {

                    const y =
                        startY +
                        index *
                        lineHeight;

                    return `
                        <text
                            x="${paperX + paperWidth / 2}"
                            y="${y}"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-family="Arial, Helvetica, sans-serif"
                            font-size="${actualFontSize}px"
                            font-weight="700"
                            fill="#111111"
                            stroke="#111111"
                            stroke-width="0.6"
                            paint-order="stroke"
                        >${escapeXml(line)}</text>
                    `;
                }
            )
            .join("");


    return `
        <svg
            width="1536"
            height="1536"
            viewBox="0 0 1536 1536"
            xmlns="http://www.w3.org/2000/svg"
        >

            ${textElements}

        </svg>
    `;
}


/*
|--------------------------------------------------------------------------
| API HANDLER
|--------------------------------------------------------------------------
*/

module.exports = async function handler(
    req,
    res
) {

    try {

        /*
         * Hanya POST
         */

        if (req.method !== "POST") {

            return res.status(405).json({

                status: false,

                creator: "Ndra09",

                error:
                    "Method Not Allowed. Gunakan POST."

            });

        }


        /*
         * Pastikan asset tersedia
         */

        if (
            !fs.existsSync(
                IMAGE_PATH
            )
        ) {

            return res.status(500).json({

                status: false,

                creator: "Ndra09",

                error:
                    "File assets/bratpatrick.png tidak ditemukan."

            });

        }


        /*
         * Ambil body
         */

        let body =
            req.body || {};


        /*
         * Beberapa konfigurasi Vercel/server
         * dapat menerima body sebagai string.
         */

        if (
            typeof body === "string"
        ) {

            try {

                body =
                    JSON.parse(body);

            } catch {

                body = {};

            }
        }


        /*
         * Ambil teks
         */

        const text =
            String(
                body.text ||
                req.query?.text ||
                ""
            ).trim();


        /*
         * Validasi teks
         */

        if (!text) {

            return res.status(400).json({

                status: false,

                creator: "Ndra09",

                error:
                    "Parameter text wajib diisi.",

                example: {

                    text:
                        "HALO DUNIA"

                }

            });

        }


        /*
         * Batasi panjang text
         */

        if (text.length > 500) {

            return res.status(400).json({

                status: false,

                creator: "Ndra09",

                error:
                    "Teks terlalu panjang. Maksimal 500 karakter."

            });

        }


        /*
         * Font size optional
         */

        let fontSize =
            Number(
                body.fontSize ||
                req.query?.fontSize ||
                62
            );


        /*
         * Safety font size
         */

        if (
            !Number.isFinite(
                fontSize
            )
        ) {

            fontSize = 62;

        }


        fontSize =
            Math.max(
                30,
                Math.min(
                    fontSize,
                    100
                )
            );


        /*
         * Generate SVG text
         */

        const svg =
            createTextSvg(
                text,
                fontSize
            );


        /*
         * Load Patrick
         */

        const baseImage =
            sharp(
                IMAGE_PATH
            );


        /*
         * Composite text ke gambar
         */

        const outputBuffer =
            await baseImage
                .composite([
                    {
                        input:
                            Buffer.from(
                                svg
                            ),

                        top: 0,

                        left: 0
                    }
                ])
                .png()
                .toBuffer();


        /*
         * Convert ke Base64
         */

        const base64 =
            outputBuffer.toString(
                "base64"
            );


        /*
         * Data URL
         */

        const imageData =
            `data:image/png;base64,${base64}`;


        /*
         * Response
         */

        return res.status(200).json({

            status: true,

            creator: "Ndra09",

            result: {

                text:
                    text,

                fontSize:
                    fontSize,

                mime:
                    "image/png",

                url_gambar:
                    imageData,

                base64:
                    base64

            }

        });


    } catch (error) {

        console.error(
            "BRAT PATRICK API ERROR:",
            error
        );


        return res.status(500).json({

            status: false,

            creator: "Ndra09",

            error:
                error.message ||
                "Internal Server Error"

        });

    }

};