import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {Readable} from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function getAssetPath(id: string): string | null {
  if (!/^[a-f0-9-]{36}[.][a-z0-9]{1,8}$/i.test(id)) {
    return null;
  }

  const directory = path.resolve(
    process.env.ASSET_DIRECTORY ?? "./data/assets"
  );

  return path.join(directory, id);
}

function fileStream(
  filePath: string,
  options?: {start?: number; end?: number}
): ReadableStream<Uint8Array> {
  return Readable.toWeb(
    createReadStream(filePath, options)
  ) as ReadableStream<Uint8Array>;
}

async function serveAsset(request: Request, id: string, includeBody: boolean) {
  const filePath = getAssetPath(id);

  if (!filePath) {
    return new Response("Invalid asset ID.", {status: 400});
  }

  try {
    const fileStats = await stat(filePath);
    const size = fileStats.size;
    const type =
      contentTypes[path.extname(id).toLowerCase()] ??
      "application/octet-stream";

    const commonHeaders = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable"
    };

    const range = request.headers.get("range");

    if (!range) {
      const body = includeBody ? fileStream(filePath) : null;

      return new Response(body, {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Length": String(size)
        }
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/i.exec(range);

    if (!match) {
      return new Response("Invalid Range header.", {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : size - 1;

    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, size - suffixLength);
      end = size - 1;
    }

    start = Math.max(0, start);
    end = Math.min(size - 1, end);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      start >= size
    ) {
      return new Response("Requested range is not satisfiable.", {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    const body = includeBody
      ? fileStream(filePath, {start, end})
      : null;

    return new Response(body, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`
      }
    });
  } catch {
    return new Response("Asset not found.", {status: 404});
  }
}

export async function GET(
  request: Request,
  context: {params: Promise<{id: string}>}
) {
  const {id} = await context.params;
  return serveAsset(request, id, true);
}

export async function HEAD(
  request: Request,
  context: {params: Promise<{id: string}>}
) {
  const {id} = await context.params;
  return serveAsset(request, id, false);
}
