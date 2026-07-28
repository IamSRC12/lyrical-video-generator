import {requireUser} from "@/lib/auth-guard";
import {
  getRemotionBundlePath,
  getRenderOutputDirectory,
  getRenderConcurrency
} from "@/services/render";
import {projectSchema} from "@/lib/editor-schema";
import {access, mkdir, rm} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json();
    const project = projectSchema.parse(body.project);

    const bundlePath = getRemotionBundlePath();
    await access(bundlePath);

    const outputDir = getRenderOutputDirectory();
    const concurrency = getRenderConcurrency();

    await mkdir(outputDir, {recursive: true});

    const outputFilename = `${crypto.randomUUID()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    const internalBase =
      process.env.RENDER_BASE_URL ??
      `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

    function rewriteAssetUrl(value: string): string {
      try {
        const parsed = new URL(value);

        if (parsed.pathname.startsWith("/api/assets/")) {
          return new URL(
            `${parsed.pathname}${parsed.search}`,
            internalBase
          ).toString();
        }

        return value;
      } catch {
        return value;
      }
    }

    const renderProject = {
      ...project,
      audioUrl: rewriteAssetUrl(project.audioUrl),
      backgroundUrl: project.backgroundUrl
        ? rewriteAssetUrl(project.backgroundUrl)
        : undefined
    };

    const {renderMedia, selectComposition} = await import(
      "@remotion/renderer"
    );

    const rendererOptions = {
      chromiumOptions: {
        enableMultiProcessOnLinux: true
      },
      timeoutInMilliseconds: 120_000,
      logLevel: "info" as const
    };

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "LyricalVideo",
      inputProps: {project: renderProject},
      ...rendererOptions
    });

    const startTime = Date.now();

    try {
      await renderMedia({
        composition,
        serveUrl: bundlePath,
        codec: "h264",
        audioCodec: "aac",
        outputLocation: outputPath,
        inputProps: {project: renderProject},
        concurrency,
        crf: 18,
        pixelFormat: "yuv420p",
        x264Preset: "medium",
        overwrite: true,
        licenseKey: process.env.REMOTION_LICENSE_KEY || undefined,
        ...rendererOptions,
        onProgress: ({progress}) => {
          console.log(`Render progress: ${Math.round(progress * 100)}%`);
        },
        onBrowserLog: (log) => {
          console.log(`[Remotion ${log.type}] ${log.text}`);
        },
        onDownload: (src) => {
          console.log(`Downloading render asset: ${src}`);
          return ({percent}) => {
            if (percent !== null) {
              console.log(`Asset download: ${Math.round(percent * 100)}%`);
            }
          };
        }
      });
    } catch (error) {
      await rm(outputPath, {force: true});
      throw error;
    }

    const durationMs = Date.now() - startTime;

    return Response.json({
      url: `/api/renders/${encodeURIComponent(outputFilename)}`,
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
