import { requireAuth } from "@/lib/auth-guard";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const STORAGE_DIR = path.resolve(process.env.ASSET_STORAGE_PATH ?? "./data/assets");

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
    }

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds maximum size limit of 50MB" }, { status: 400 });
    }

    const extension = path.extname(file.name) || ".bin";
    const assetId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${extension}`;
    
    await mkdir(STORAGE_DIR, { recursive: true });
    const filePath = path.join(STORAGE_DIR, assetId);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/api/assets/${assetId}`;

    return NextResponse.json({
      id: assetId,
      url,
      filename: file.name,
      mimeType: file.type,
      size: file.size
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload error";
    return NextResponse.json({ error: `Asset upload failed: ${message}` }, { status: 500 });
  }
}
