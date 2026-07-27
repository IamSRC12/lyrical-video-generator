import {readFile} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const {id} = await context.params;

  if (!/^[a-f0-9-]{36}[.][a-z0-9]{1,8}$/i.test(id)) {
    return new Response("Invalid asset ID.", {status: 400});
  }

  try {
    const directory = path.resolve(
      process.env.ASSET_DIRECTORY ?? "./data/assets"
    );

    const data = await readFile(path.join(directory, id));
    const type = contentTypes[path.extname(id).toLowerCase()] ??
      "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes"
      }
    });
  } catch {
    return new Response("Asset not found.", {status: 404});
  }
}
