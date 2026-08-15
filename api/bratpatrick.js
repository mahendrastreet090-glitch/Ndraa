const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const CREATOR = "Ndra09";

const IMAGE_PATH = path.join(
    process.cwd(),
    "assets",
    "bratpatrick.png"
);

const FONT_PATH = path.join(
    process.cwd(),
    "assets",
    "Aptos.ttf"
);

function sendJson(res, status, data) {
    res.statusCode = status;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    return res.end(
        JSON.stringify(data)
    );
}

function escapeXml(text) {
    return String(text).replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;"
        }[char])
    );
}

function wrapText(text, maxChars) {
    const words = String(text)
        .trim()
        .split(/\s+/);

    const lines = [];
    let current = "";

    for (const word of words) {
        const test = current
            ? current + " " + word
            : word;

        if (test.length <= maxChars) {
            current = test;
        } else {
            if (current) {
                lines.push(current);
            }

            if (word.length > maxChars) {
                let remaining = word;

                while (
                    remaining.length >
                    maxChars
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

function createTextSvg(
    text,
    imageWidth,
    imageHeight,
    fontSize
) {
    const scaleX =
        imageWidth / 1536;

    const scaleY =
        imageHeight / 1536;

    const paperX =
        445 * scaleX;

    const paperY =
        755 * scaleY;

    const paperWidth =
        665 * scaleX;

    const paperHeight =
        500 * scaleY;

    const paddingX =
        35 * scaleX;

    let size =
        Number(fontSize) || 115;

    size =
        Math.max(
            45,
            Math.min(
                size,
                170
            )
        );

    let maxChars =
        Math.floor(
            (paperWidth -
                paddingX * 2) /
            (size * 0.52)
        );

    maxChars =
        Math.max(
            5,
            maxChars
        );

    let lines =
        wrapText(
            text,
            maxChars
        );

    if (lines.length > 5) {
        lines =
            lines.slice(
                0,
                5
            );

        let last =
            lines[4];

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

        lines[4] =
            last;
    }

    if (lines.length >= 5) {
        size =
            Math.min(
                size,
                78
            );
    } else if (lines.length === 4) {
        size =
            Math.min(
                size,
                88
            );
    } else if (lines.length === 3) {
        size =
            Math.min(
                size,
                105
            );
    }

    const lineHeight =
        size * 1.12;

    const totalHeight =
        lines.length *
        lineHeight;

    const centerX =
        paperX +
        paperWidth / 2;

    const centerY =
        paperY +
        paperHeight / 2;

    const startY =
        centerY -
        totalHeight / 2 +
        lineHeight / 2;

    let fontData = "";

    try {
        if (
            fs.existsSync(
                FONT_PATH
            )
        ) {
            fontData =
                fs.readFileSync(
                    FONT_PATH
                ).toString("base64");
        }
    } catch {
        fontData = "";
    }

    const fontFace =
        fontData
            ? `
                <style>
                    @font-face {
                        font-family: "AptosCustom";
                        src: url(data:font/ttf;base64,${fontData});
                    }
                </style>
            `
            : "";

    const elements =
        lines
            .map(
                (
                    line,
                    index
                ) => {

                    const y =
                        startY +
                        index *
                        lineHeight;

                    return `
                        <text
                            x="${centerX}"
                            y="${y}"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-family="AptosCustom, Arial, Helvetica, sans-serif"
                            font-size="${size}px"
                            font-weight="700"
                            fill="#111111"
                            stroke="#111111"
                            stroke-width="0.7"
                            paint-order="stroke"
                        >${escapeXml(
                            line
                        )}</text>
                    `;
                }
            )
            .join("");

    return `
        <svg
            width="${imageWidth}"
            height="${imageHeight}"
            viewBox="0 0 ${imageWidth} ${imageHeight}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${fontFace}

            ${elements}
        </svg>
    `;
}

function parseBody(req) {
    if (
        req.body &&
        typeof req.body === "object"
    ) {
        return req.body;
    }

    if (
        typeof req.body === "string"
    ) {
        try {
            return JSON.parse(
                req.body
            );
        } catch {
            return {};
        }
    }

    return {};
}

module.exports = async function handler(
    req,
    res
) {
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    try {

        if (
            req.method ===
            "OPTIONS"
        ) {
            return sendJson(
                res,
                200,
                {
                    status: true,
                    creator: CREATOR
                }
            );
        }

        if (
            req.method !==
            "POST"
        ) {
            return sendJson(
                res,
                405,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "Gunakan method POST."
                }
            );
        }

        if (
            !fs.existsSync(
                IMAGE_PATH
            )
        ) {
            return sendJson(
                res,
                500,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "assets/bratpatrick.png tidak ditemukan."
                }
            );
        }

        const body =
            parseBody(req);

        const text =
            String(
                body.text ??
                req.query?.text ??
                ""
            ).trim();

        if (!text) {
            return sendJson(
                res,
                400,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "Parameter text wajib diisi.",
                    example: {
                        text:
                            "HALLO"
                    }
                }
            );
        }

        if (
            text.length >
            500
        ) {
            return sendJson(
                res,
                400,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "Maksimal 500 karakter."
                }
            );
        }

        let fontSize =
            Number(
                body.fontSize ??
                req.query?.fontSize ??
                115
            );

        if (
            !Number.isFinite(
                fontSize
            )
        ) {
            fontSize = 115;
        }

        fontSize =
            Math.max(
                45,
                Math.min(
                    fontSize,
                    170
                )
            );

        const metadata =
            await sharp(
                IMAGE_PATH
            ).metadata();

        const imageWidth =
            metadata.width;

        const imageHeight =
            metadata.height;

        if (
            !imageWidth ||
            !imageHeight
        ) {
            return sendJson(
                res,
                500,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "Ukuran gambar tidak dapat dibaca."
                }
            );
        }

        const svg =
            createTextSvg(
                text,
                imageWidth,
                imageHeight,
                fontSize
            );

        const output =
            await sharp(
                IMAGE_PATH
            )
                .rotate()
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

        const base64 =
            output.toString(
                "base64"
            );

        const dataUrl =
            "data:image/png;base64," +
            base64;

        return sendJson(
            res,
            200,
            {
                status: true,
                creator: CREATOR,
                result: {
                    text:
                        text,
                    fontSize:
                        fontSize,
                    mime:
                        "image/png",
                    width:
                        imageWidth,
                    height:
                        imageHeight,
                    url_gambar:
                        dataUrl,
                    base64:
                        base64
                }
            }
        );

    } catch (error) {

        console.error(
            "BRAT PATRICK ERROR:",
            error
        );

        return sendJson(
            res,
            500,
            {
                status: false,
                creator: CREATOR,
                error:
                    error?.message ||
                    "Internal Server Error",
                type:
                    error?.name ||
                    "Error"
            }
        );
    }
};

module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit:
                "10mb"
        }
    }
};
