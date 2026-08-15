import sharp from "sharp";
import path from "path";
import fs from "fs";

const CREATOR = "Ndra09";

const IMAGE_PATH = path.join(
    process.cwd(),
    "assets",
    "bratpatrick.png"
);

function sendJson(res, status, data) {
    res.statusCode = status;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    return res.end(
        JSON.stringify(data)
    );
}

function escapeXml(text) {
    return String(text).replace(
        /[&<>"']/g,
        function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&apos;"
            }[char];
        }
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
    fontSize
) {
    const paperX = 445;
    const paperY = 755;

    const paperWidth = 665;
    const paperHeight = 500;

    const paddingX = 55;

    let size =
        Number(fontSize) || 62;

    size = Math.max(
        30,
        Math.min(
            size,
            100
        )
    );

    let maxChars =
        Math.floor(
            (paperWidth -
                paddingX * 2) /
            (size * 0.55)
        );

    maxChars =
        Math.max(
            8,
            maxChars
        );

    let lines =
        wrapText(
            text,
            maxChars
        );

    if (lines.length > 6) {
        lines =
            lines.slice(
                0,
                6
            );

        let last =
            lines[5];

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

        lines[5] = last;
    }

    if (lines.length >= 5) {
        size =
            Math.min(
                size,
                52
            );
    } else if (
        lines.length >= 4
    ) {
        size =
            Math.min(
                size,
                58
            );
    }

    const lineHeight =
        size * 1.2;

    const totalHeight =
        lines.length *
        lineHeight;

    const centerX =
        paperX +
        paperWidth / 2;

    const startY =
        paperY +
        (paperHeight -
            totalHeight) / 2 +
        size / 2;

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
                            font-family="Arial, Helvetica, sans-serif"
                            font-size="${size}px"
                            font-weight="700"
                            fill="#111111"
                            stroke="#111111"
                            stroke-width="0.6"
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
            width="1536"
            height="1536"
            viewBox="0 0 1536 1536"
            xmlns="http://www.w3.org/2000/svg"
        >
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

export default async function handler(
    req,
    res
) {
    try {
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
                body?.text ??
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
                body?.fontSize ??
                req.query?.fontSize ??
                62
            );

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

        const svg =
            createTextSvg(
                text,
                fontSize
            );

        const svgBuffer =
            Buffer.from(
                svg,
                "utf8"
            );

        const output =
            await sharp(
                IMAGE_PATH
            )
                .composite([
                    {
                        input:
                            svgBuffer,
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
            `data:image/png;base64,${base64}`;

        return sendJson(
            res,
            200,
            {
                status: true,
                creator: CREATOR,
                result: {
                    text: text,
                    fontSize: fontSize,
                    mime: "image/png",
                    url_gambar: dataUrl,
                    base64: base64
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
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};