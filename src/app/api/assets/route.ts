import {requireUser} from "@/lib/auth-guard";
import {
  getAssetDirectory,
  saveAssetAtomically
} from "@/services/asset-storage";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedExtensions = new Set([
  ".mp3",
  ".wav",
  ".flac",
  ".ogg",
  ".webm",
  ".m4a",
  ".mp4",
  ".mov",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2"
]);

function safeExtension(name: string): string {
  const extension = path.extname(name).toLowerCase();

  return allowedExtensions.has(extension) ? extension : "";
}

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {message: "File is required."},
        {status: 400}
      );
    }

    if (file.size <= 0) {
      return Response.json(
        {message: "The selected file is empty."},
        {status: 400}
      );
    }

    const maxBytes = Number(
      process.env.MAX_UPLOAD_BYTES ?? 100_000_000
    );

    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      throw new Error("MAX_UPLOAD_BYTES is invalid.");
    }

    if (file.size > maxBytes) {
      return Response.json(
        {
          message:
            `File is too large. Maximum size is ${maxBytes} bytes.`
        },
        {status: 413}
      );
    }

    const extension = safeExtension(file.name);

    if (!extension) {
      return Response.json(
        {message: "Unsupported file extension."},
        {status: 415}
      );
    }

    const id = `${crypto.randomUUID()}${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await saveAssetAtomically(id, buffer);

    console.log("Asset uploaded", {
      id,
      size: buffer.length,
      directory: getAssetDirectory()
    });

    return Response.json({
      id,
      path: `/api/assets/${encodeURIComponent(id)}`,
      size: buffer.length
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Asset upload error:", error);

    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Asset upload failed."
      },
      {status: 500}
    );
  }
}
