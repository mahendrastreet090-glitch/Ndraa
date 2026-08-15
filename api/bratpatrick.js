import sharp from "sharp";
import path from "path";
import fs from "fs";
import opentype from "opentype.js";

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

    return res.end(
        JSON.stringify(data)
    );
}

function escapeXml(text) {
    return String(text).replace(
        /[&<>"']/g,
        (char) => {
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

function wrapTextByWidth(
    font,
    text,
    fontSize,
    maxWidth
) {
    const words = String(text)
        .trim()
        .split(/\s+/);

    const lines = [];
    let current = "";

    for (const word of words) {
        const test = current
            ? current + " " + word
            : word;

        const width =
            font.getAdvanceWidth(
                test,
                fontSize
            );

        if (
            width <= maxWidth
        ) {
            current = test;
            continue;
        }

        if (current) {
            lines.push(current);
        }

        if (
            font.getAdvanceWidth(
                word,
                fontSize
            ) <= maxWidth
        ) {
            current = word;
            continue;
        }

        let partial = "";

        for (
            const char of word
        ) {
            const testChar =
                partial + char;

            const charWidth =
                font.getAdvanceWidth(
                    testChar,
                    fontSize
                );

            if (
                charWidth <= maxWidth
            ) {
                partial =
                    testChar;
            } else {
                if (partial) {
                    lines.push(
                        partial
                    );
                }

                partial = char;
            }
        }

        current = partial;
    }

    if (current) {
        lines.push(current);
    }

    return lines;
}

function createGlyphPath(
    font,
    text,
    fontSize,
    centerX,
    baselineY
) {
    const pathObject =
        font.getPath(
            text,
            0,
            0,
            fontSize
        );

    const advanceWidth =
        font.getAdvanceWidth(
            text,
            fontSize
        );

    const xOffset =
        centerX -
        advanceWidth / 2;

    const commands =
        pathObject.commands;

    let pathData = "";

    for (
        const command of commands
    ) {
        switch (
            command.type
        ) {
            case "M":
                pathData +=
                    `M ${(
                        xOffset +
                        command.x
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y
                    ).toFixed(2)} `;
                break;

            case "L":
                pathData +=
                    `L ${(
                        xOffset +
                        command.x
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y
                    ).toFixed(2)} `;
                break;

            case "C":
                pathData +=
                    `C ${(
                        xOffset +
                        command.x1
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y1
                    ).toFixed(2)} ${(
                        xOffset +
                        command.x2
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y2
                    ).toFixed(2)} ${(
                        xOffset +
                        command.x
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y
                    ).toFixed(2)} `;
                break;

            case "Q":
                pathData +=
                    `Q ${(
                        xOffset +
                        command.x1
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y1
                    ).toFixed(2)} ${(
                        xOffset +
                        command.x
                    ).toFixed(2)} ${(
                        baselineY -
                        command.y
                    ).toFixed(2)} `;
                break;

            case "Z":
                pathData += "Z ";
                break;
        }
    }

    return pathData.trim();
}

function createTextSvg(
    font,
    text,
    width,
    height,
    requestedFontSize
) {
    const designWidth = 1536;
    const designHeight = 1536;

    const scaleX =
        width / designWidth;

    const scaleY =
        height / designHeight;

    const scale =
        Math.min(
            scaleX,
            scaleY
        );

    const paperX =
        445 * scale;

    const paperY =
        755 * scale;

    const paperWidth =
        665 * scale;

    const paperHeight =
        500 * scale;

    const padding =
        55 * scale;

    let fontSize =
        requestedFontSize *
        scale;

    fontSize =
        Math.max(
            14,
            fontSize
        );

    const maxWidth =
        paperWidth -
        padding * 2;

    let lines =
        wrapTextByWidth(
            font,
            text,
            fontSize,
            maxWidth
        );

    if (
        lines.length === 0
    ) {
        lines = [text];
    }

    if (
        lines.length > 6
    ) {
        lines =
            lines.slice(
                0,
                6
            );

        let last =
            lines[5];

        if (
            !last.endsWith(
                "..."
            )
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

        lines[5] =
            last;
    }

    if (
        lines.length >= 5
    ) {
        fontSize =
            Math.min(
                fontSize,
                52 * scale
            );
    } else if (
        lines.length >= 4
    ) {
        fontSize =
            Math.min(
                fontSize,
                58 * scale
            );
    }

    const lineHeight =
        fontSize * 1.2;

    const totalHeight =
        lines.length *
        lineHeight;

    const centerX =
        paperX +
        paperWidth / 2;

    const firstBaseline =
        paperY +
        (
            paperHeight -
            totalHeight
        ) / 2 +
        fontSize;

    let paths = "";

    lines.forEach(
        (
            line,
            index
        ) => {
            const baseline =
                firstBaseline +
                index *
                lineHeight;

            const pathData =
                createGlyphPath(
                    font,
                    line,
                    fontSize,
                    centerX,
                    baseline
                );

            paths += `
                <path
                    d="${pathData}"
                    fill="#111111"
                />
            `;
        }
    );

    return `
        <svg
            width="${width}"
            height="${height}"
            viewBox="0 0 ${width} ${height}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${paths}
        </svg>
    `;
}

function parseBody(req) {
    if (
        req.body &&
        typeof req.body ===
            "object"
    ) {
        return req.body;
    }

    if (
        typeof req.body ===
            "string"
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

        if (
            !fs.existsSync(
                FONT_PATH
            )
        ) {
            return sendJson(
                res,
                500,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "assets/Aptos.ttf tidak ditemukan."
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

        const metadata =
            await sharp(
                IMAGE_PATH
            ).metadata();

        const width =
            Number(
                metadata.width
            );

        const height =
            Number(
                metadata.height
            );

        if (
            !width ||
            !height
        ) {
            return sendJson(
                res,
                500,
                {
                    status: false,
                    creator: CREATOR,
                    error:
                        "Dimensi gambar tidak dapat dibaca."
                }
            );
        }

        const fontBuffer =
            fs.readFileSync(
                FONT_PATH
            );

        const font =
            opentype.parse(
                fontBuffer.buffer.slice(
                    fontBuffer.byteOffset,
                    fontBuffer.byteOffset +
                    fontBuffer.byteLength
                )
            );

        const svg =
            createTextSvg(
                font,
                text,
                width,
                height,
                fontSize
            );

        const output =
            await sharp(
                IMAGE_PATH
            )
                .composite([
                    {
                        input:
                            Buffer.from(
                                svg,
                                "utf8"
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
                    width: width,
                    height: height,
                    mime: "image/png",
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
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};