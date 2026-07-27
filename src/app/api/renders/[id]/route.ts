import {readFile, stat} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function getRenderPath(id: string): string | null {
  if (!/^[a-f0-9-]{36}[.]mp4$/i.test(id)) {
    return null;
  }

  return path.join(
    path.resolve(process.env.RENDER_DIRECTORY ?? "./data/renders"),
    id
  );
}

async function serveRender(request: Request, id: string, includeBody: boolean) {
  const filePath = getRenderPath(id);

  if (!filePath) {
    return new Response("Invalid render ID.", {status: 400});
  }

  try {
    const fileStats = await stat(filePath);
    const size = fileStats.size;
    const range = request.headers.get("range");

    const commonHeaders = {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="lyrical-video-${id}"`
    };

    if (!range) {
      const data = includeBody ? await readFile(filePath) : null;

      return new Response(data, {
        headers: {
          ...commonHeaders,
          "Content-Length": String(size)
        }
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/i.exec(range);

    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {"Content-Range": `bytes */${size}`}
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = Math.min(
      match[2] ? Number(match[2]) : size - 1,
      size - 1
    );

    if (start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: {"Content-Range": `bytes */${size}`}
      });
    }

    const data = includeBody
      ? (await readFile(filePath)).subarray(start, end + 1)
      : null;

    return new Response(data, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`
      }
    });
  } catch {
    return new Response("Render not found.", {status: 404});
  }
}

export async function GET(
  request: Request,
  context: {params: Promise<{id: string}>}
) {
  const {id} = await context.params;
  return serveRender(request, id, true);
}

export async function HEAD(
  request: Request,
  context: {params: Promise<{id: string}>}
) {
  const {id} = await context.params;
  return serveRender(request, id, false);
}
