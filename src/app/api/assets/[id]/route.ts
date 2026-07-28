import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const STORAGE_DIR = path.resolve(process.env.ASSET_STORAGE_PATH ?? "./data/assets");

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".m4a": case ".aac": return "audio/mp4";
    case ".ogg": return "audio/ogg";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".mp4": return "video/mp4";
    default: return "application/octet-stream";
  }
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const id = params.id;

  // Sanitize path traversal attempts
  const safeFilename = path.basename(id);
  const filePath = path.join(STORAGE_DIR, safeFilename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);
    const mimeType = getMimeType(filePath);

    const stream = createReadStream(filePath);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileStat.size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
