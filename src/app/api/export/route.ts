import { requireAuth } from "@/lib/auth-guard";
import { projectSchema } from "@/lib/editor-schema";
import { renderProjectVideo } from "@/services/render";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const project = projectSchema.parse(body.project);

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          sendEvent({ type: "progress", progress: 0.02 });

          const result = await renderProjectVideo(project, (progress) => {
            sendEvent({ type: "progress", progress });
          });

          const downloadUrl = `/api/assets/${result.filename}`;
          sendEvent({ type: "done", url: downloadUrl, filename: result.filename });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Render failed";
          sendEvent({ type: "error", error: message });
          controller.close();
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project export request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
