import {
  getAssetPath
} from "@/services/asset-storage";
import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {Readable} from "node:stream";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
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

function streamFile(
  filePath: string,
  options?: {start?: number; end?: number}
): ReadableStream<Uint8Array> {
  return Readable.toWeb(
    createReadStream(filePath, options)
  ) as ReadableStream<Uint8Array>;
}

async function serveAsset(
  request: Request,
  id: string,
  includeBody: boolean
) {
  const filePath = getAssetPath(id);

  if (!filePath) {
    return new Response("Invalid asset ID.", {status: 400});
  }

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return new Response("Asset not found.", {status: 404});
    }

    const size = fileStats.size;
    const contentType =
      contentTypes[path.extname(id).toLowerCase()] ??
      "application/octet-stream";

    const commonHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff"
    };

    const range = request.headers.get("range");

    if (!range) {
      return new Response(
        includeBody ? streamFile(filePath) : null,
        {
          status: 200,
          headers: {
            ...commonHeaders,
            "Content-Length": String(size)
          }
        }
      );
    }

    const match = /^bytes=(\d*)-(\d*)$/i.exec(range);

    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    let start: number;
    let end: number;

    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2]);

      if (
        !Number.isFinite(suffixLength) ||
        suffixLength <= 0
      ) {
        return new Response(null, {
          status: 416,
          headers: {
            ...commonHeaders,
            "Content-Range": `bytes */${size}`
          }
        });
      }

      start = Math.max(0, size - suffixLength);
      end = size - 1;
    } else {
      start = match[1] ? Number(match[1]) : 0;
      end = match[2] ? Number(match[2]) : size - 1;
    }

    end = Math.min(end, size - 1);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      start >= size
    ) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    return new Response(
      includeBody
        ? streamFile(filePath, {start, end})
        : null,
      {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`
        }
      }
    );
  } catch (error) {
    console.error("Asset serving error:", {
      id,
      filePath,
      error
    });

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
