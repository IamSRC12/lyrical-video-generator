import {requireUser} from "@/lib/auth-guard";
import {
  getRemotionBundlePath,
  getRenderOutputDirectory,
  getRenderConcurrency
} from "@/services/render";
import {projectSchema} from "@/lib/editor-schema";
import {mkdir} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json();
    const project = projectSchema.parse(body.project);

    const bundlePath = getRemotionBundlePath();
    const outputDir = getRenderOutputDirectory();
    const concurrency = getRenderConcurrency();

    await mkdir(outputDir, {recursive: true});

    const outputFilename = `${crypto.randomUUID()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    // Dynamic import to avoid bundling Remotion renderer with the Next.js client
    const {renderMedia, selectComposition} = await import(
      "@remotion/renderer"
    );

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "LyricalVideo",
      inputProps: {project}
    });

    const startTime = Date.now();

    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: {project},
      concurrency: concurrency === "75%" ? "75%" : Number(concurrency),
      chromiumOptions: {
        enableMultiProcessOnLinux: true
      }
    });

    const durationMs = Date.now() - startTime;
    const baseUrl =
      process.env.APP_BASE_URL ?? "http://localhost:3000";

    return Response.json({
      url: `${baseUrl}/api/assets/${encodeURIComponent(outputFilename)}`,
      durationMs,
      outputFilename
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Export error:", error);

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Export failed."
      },
      {status: 500}
    );
  }
}
