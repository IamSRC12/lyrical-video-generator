import {requireUser} from "@/lib/auth-guard";
import {
  getRemotionBundlePath,
  getRenderOutputDirectory,
  getRenderConcurrency
} from "@/services/render";
import {projectSchema} from "@/lib/editor-schema";
import {access, mkdir, rm} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

export const runtime = "nodejs";
export const maxDuration = 600;

const exportSchema = z.object({
  project: projectSchema,
  profile: z.enum(["draft", "standard", "high"]).default("standard")
});

async function verifyAsset(url: string, label: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(
        `${label} is unavailable (${response.status}). ` +
          "The project may contain an expired upload. Please re-upload the file."
      );
    }

    const length = Number(response.headers.get("content-length") ?? 0);

    if (length <= 0) {
      throw new Error(`${label} is empty or inaccessible.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("unavailable")) {
      throw error;
    }
    // Non-critical network errors in dev environment can log warning
    console.warn(`Preflight asset verification warning for ${label}:`, error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json();
    const {project, profile} = exportSchema.parse(body);

    const bundlePath = getRemotionBundlePath();
    await access(bundlePath);

    const outputDir = getRenderOutputDirectory();
    const concurrency = getRenderConcurrency();

    await mkdir(outputDir, {recursive: true});

    const outputFilename = `${crypto.randomUUID()}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    const requestUrl = new URL(request.url);
    const renderBaseUrl =
      process.env.RENDER_BASE_URL ??
      (process.env.NODE_ENV === "production"
        ? `http://127.0.0.1:${process.env.PORT ?? "3000"}`
        : `http://127.0.0.1:${requestUrl.port || "3000"}`);

    function rewriteLocalAssetUrl(value: string): string {
      try {
        const parsed = new URL(value);

        if (
          parsed.pathname.startsWith("/api/assets/") ||
          parsed.pathname.startsWith("/api/renders/")
        ) {
          return new URL(
            `${parsed.pathname}${parsed.search}`,
            renderBaseUrl
          ).toString();
        }

        return value;
      } catch {
        return value;
      }
    }

    const renderProject = {
      ...project,
      audioUrl: rewriteLocalAssetUrl(project.audioUrl),
      backgroundUrl: project.backgroundUrl
        ? rewriteLocalAssetUrl(project.backgroundUrl)
        : undefined
    };

    // Preflight asset verification
    await verifyAsset(renderProject.audioUrl, "Audio asset");
    if (renderProject.backgroundUrl) {
      await verifyAsset(renderProject.backgroundUrl, "Background asset");
    }

    const profiles = {
      draft: {
        crf: 23,
        x264Preset: "veryfast" as const,
        width: 1280,
        height: 720
      },
      standard: {
        crf: 18,
        x264Preset: "fast" as const,
        width: renderProject.width,
        height: renderProject.height
      },
      high: {
        crf: 15,
        x264Preset: "medium" as const,
        width: renderProject.width,
        height: renderProject.height
      }
    };

    const profileSettings = profiles[profile];

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
      inputProps: {
        project: {
          ...renderProject,
          width: profileSettings.width,
          height: profileSettings.height
        }
      },
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
        inputProps: {
          project: {
            ...renderProject,
            width: profileSettings.width,
            height: profileSettings.height
          }
        },
        concurrency,
        crf: profileSettings.crf,
        pixelFormat: "yuv420p",
        x264Preset: profileSettings.x264Preset,
        overwrite: true,
        licenseKey: process.env.REMOTION_LICENSE_KEY || undefined,
        ...rendererOptions,
        onProgress: ({progress}) => {
          console.log(`Render progress (${profile}): ${Math.round(progress * 100)}%`);
        },
        onBrowserLog: (log) => {
          console.log(`[Remotion ${log.type}] ${log.text}`);
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
