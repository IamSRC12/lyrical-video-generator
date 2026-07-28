import {requireUser} from "@/lib/auth-guard";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function safeExtension(name: string) {
  const extension = path.extname(name).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({message: "File is required."}, {status: 400});
    }

    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 100_000_000);

    if (file.size > maxBytes) {
      return Response.json({message: "File is too large."}, {status: 413});
    }

    const id = `${crypto.randomUUID()}${safeExtension(file.name)}`;
    const directory = path.resolve(
      process.env.ASSET_DIRECTORY ?? "./data/assets"
    );

    await mkdir(directory, {recursive: true});
    await writeFile(path.join(directory, id), Buffer.from(await file.arrayBuffer()));

    const assetPath = `/api/assets/${encodeURIComponent(id)}`;

    return Response.json({
      id,
      path: assetPath
    });
  } catch (error) {
    if (error instanceof Response) return error;

    return Response.json(
      {message: error instanceof Error ? error.message : "Upload failed."},
      {status: 500}
    );
  }
}
