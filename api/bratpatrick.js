const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const CREATOR = "Ndra09";

const IMAGE_PATH = path.join(
    process.cwd(),
    "assets",
    "bratpatrick.png"
);

const CTERMAI_KEY =
    process.env.CTERMAI_KEY ||
    "AIzaBj7z2z3xBjsk";

const CTERMAI_UPLOAD_URL =
    "https://c.termai.cc/api/upload?key=" +
    encodeURIComponent(CTERMAI_KEY);

module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};

function escapeXml(text) {
    return String(text).replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;"
        })[char]
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
            continue;
        }

        if (current) {
            lines.push(current);
        }

        if (word.length > maxChars) {
            let remaining = word;

            while (remaining.length > maxChars) {
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

    if (current) {
        lines.push(current);
    }

    return lines;
}

function createTextSvg(
    text,
    fontSize = 62
) {
    const paperX = 445;
    const paperY = 755;
    const paperWidth = 665;
    const paperHeight = 500;
    const paddingX = 55;

    let actualFontSize =
        Number(fontSize) || 62;

    actualFontSize = Math.max(
        30,
        Math.min(
            actualFontSize,
            100
        )
    );

    let maxChars = Math.floor(
        (paperWidth - paddingX * 2) /
        (actualFontSize * 0.55)
    );

    maxChars = Math.max(
        8,
        maxChars
    );

    let lines = wrapText(
        text,
        maxChars
    );

    const maxLines = 6;

    if (lines.length > maxLines) {
        lines =
            lines.slice(
                0,
                maxLines
            );

        let last =
            lines[maxLines - 1];

        if (!last.endsWith("...")) {
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

    const centerX =
        paperX +
        paperWidth / 2;

    const startY =
        paperY +
        (paperHeight - totalHeight) / 2 +
        actualFontSize / 2;

    const textElements =
        lines.map(
            (line, index) => {

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
                        font-size="${actualFontSize}px"
                        font-weight="700"
                        fill="#111111"
                        stroke="#111111"
                        stroke-width="0.6"
                        paint-order="stroke"
                    >${escapeXml(line)}</text>
                `;
            }
        ).join("");

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

async function uploadToCtermai(buffer) {

    if (
        typeof FormData === "undefined" ||
        typeof Blob === "undefined"
    ) {
        throw new Error(
            "FormData atau Blob tidak tersedia pada runtime."
        );
    }

    const formData =
        new FormData();

    const blob =
        new Blob(
            [buffer],
            {
                type: "image/png"
            }
        );

    formData.append(
        "file",
        blob,
        "bratpatrick.png"
    );

    const response =
        await fetch(
            CTERMAI_UPLOAD_URL,
            {
                method: "POST",
                body: formData
            }
        );

    const responseText =
        await response.text();

    let data = null;

    try {
        data =
            JSON.parse(
                responseText
            );
    } catch {
        throw new Error(
            "Response Ctermai bukan JSON. HTTP " +
            response.status
        );
    }

    if (
        !response.ok ||
        !data
    ) {
        throw new Error(
            data?.message ||
            data?.error ||
            "Upload Ctermai gagal."
        );
    }

    const imageUrl =
        data.path ||
        data.url ||
        data.result?.path ||
        data.result?.url;

    if (!imageUrl) {
        throw new Error(
            "Upload Ctermai berhasil tetapi URL gambar tidak ditemukan."
        );
    }

    return imageUrl;
}

function parseBody(req) {

    let body =
        req.body;

    if (
        body === undefined ||
        body === null
    ) {
        return {};
    }

    if (
        typeof body === "object"
    ) {
        return body;
    }

    if (
        typeof body === "string"
    ) {
        try {
            return JSON.parse(
                body
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

    if (
        req.method === "OPTIONS"
    ) {
        return res.status(200).json({
            status: true,
            creator: CREATOR
        });
    }

    if (
        req.method !== "POST"
    ) {
        return res.status(405).json({
            status: false,
            creator: CREATOR,
            error:
                "Method Not Allowed. Gunakan POST."
        });
    }

    try {

        if (
            !fs.existsSync(
                IMAGE_PATH
            )
        ) {
            return res.status(500).json({
                status: false,
                creator: CREATOR,
                error:
                    "File assets/bratpatrick.png tidak ditemukan."
            });
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
            return res.status(400).json({
                status: false,
                creator: CREATOR,
                error:
                    "Parameter text wajib diisi.",
                example: {
                    text:
                        "HALO DUNIA"
                }
            });
        }

        if (
            text.length > 500
        ) {
            return res.status(400).json({
                status: false,
                creator: CREATOR,
                error:
                    "Teks terlalu panjang. Maksimal 500 karakter."
            });
        }

        let fontSize =
            Number(
                body.fontSize ??
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

        const outputBuffer =
            await sharp(
                IMAGE_PATH
            )
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
            outputBuffer.toString(
                "base64"
            );

        const urlGambar =
            await uploadToCtermai(
                outputBuffer
            );

        return res.status(200).json({

            status: true,

            creator: CREATOR,

            result: {

                text:
                    text,

                fontSize:
                    fontSize,

                mime:
                    "image/png",

                url_gambar:
                    urlGambar,

                base64:
                    base64

            }

        });

    } catch (error) {

        console.error(
            "BRAT PATRICK ERROR:",
            error
        );

        return res.status(500).json({

            status: false,

            creator: CREATOR,

            error:
                error?.message ||
                "Internal Server Error"

        });

    }
};