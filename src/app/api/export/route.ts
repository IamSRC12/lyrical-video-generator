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

function getInternalRenderBaseUrl(request: Request): string {
  if (process.env.RENDER_BASE_URL) {
    return process.env.RENDER_BASE_URL.replace(/\/+$/, "");
  }

  const requestUrl = new URL(request.url);

  if (process.env.NODE_ENV !== "production") {
    return `http://127.0.0.1:${requestUrl.port || "3000"}`;
  }

  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

function rewriteLocalAssetUrl(
  value: string,
  renderBaseUrl: string
): string {
  try {
    const parsed = new URL(value);

    if (parsed.pathname.startsWith("/api/assets/")) {
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

async function verifyRenderAsset(
  url: string,
  label: string
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new Error(
      `${label} could not be reached by the renderer: ${
        error instanceof Error ? error.message : "Network error"
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${label} is unavailable (${response.status}). ` +
        "Please re-upload the file before exporting."
    );
  }

  const contentLength = Number(
    response.headers.get("content-length") ?? 0
  );

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error(
      `${label} is empty. Please re-upload the file.`
    );
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

    const renderBaseUrl = getInternalRenderBaseUrl(request);

    const renderProject = {
      ...project,
      audioUrl: rewriteLocalAssetUrl(
        project.audioUrl,
        renderBaseUrl
      ),
      backgroundUrl: project.backgroundUrl
        ? rewriteLocalAssetUrl(
            project.backgroundUrl,
            renderBaseUrl
          )
        : undefined
    };

    console.log("Export asset resolution", {
      originalAudioUrl: project.audioUrl,
      renderAudioUrl: renderProject.audioUrl,
      renderBaseUrl
    });

    await verifyRenderAsset(
      renderProject.audioUrl,
      "Audio asset"
    );

    if (renderProject.backgroundUrl) {
      await verifyRenderAsset(
        renderProject.backgroundUrl,
        "Background asset"
      );
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
          console.log(`[Remotion browser ${log.type}] ${log.text}`);
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
