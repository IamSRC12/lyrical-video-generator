import {requireUser} from "@/lib/auth-guard";
import {
  getOrBuildRemotionBundle,
  getRenderOutputDirectory,
  getRenderConcurrency,
  getBrowserExecutable
} from "@/services/render";
import {
  createJob,
  updateJobProgress,
  completeJob,
  failJob
} from "@/services/render-jobs";
import {projectSchema} from "@/lib/editor-schema";
import {mkdir, rm} from "node:fs/promises";
import path from "node:path";
import {z, ZodError} from "zod";

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
  const port = requestUrl.port || process.env.PORT || "3000";

  return `http://127.0.0.1:${port}`;
}

function rewriteLocalAssetUrl(
  value: string,
  renderBaseUrl: string
): string {
  if (!value) return value;

  if (value.startsWith("/")) {
    return new URL(value, renderBaseUrl).toString();
  }

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

async function runRenderJob(
  jobId: string,
  project: z.infer<typeof projectSchema>,
  profile: "draft" | "standard" | "high",
  requestUrl: string
): Promise<void> {
  const startTime = Date.now();
  const outputDir = getRenderOutputDirectory();
  await mkdir(outputDir, {recursive: true});

  const outputFilename = `${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);

  const fakeRequest = new Request(requestUrl);
  const renderBaseUrl = getInternalRenderBaseUrl(fakeRequest);

  try {
    updateJobProgress(jobId, 0.01, "rendering");

    const renderProject = {
      ...project,
      audioUrl: rewriteLocalAssetUrl(project.audioUrl, renderBaseUrl),
      backgroundUrl: project.backgroundUrl
        ? rewriteLocalAssetUrl(project.backgroundUrl, renderBaseUrl)
        : undefined
    };

    console.log("Export asset resolution:", {
      originalAudioUrl: project.audioUrl,
      renderAudioUrl: renderProject.audioUrl,
      renderBaseUrl
    });

    await verifyRenderAsset(renderProject.audioUrl, "Audio asset");
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

    const bundlePath = await getOrBuildRemotionBundle();

    const {renderMedia, selectComposition, ensureBrowser} = await import(
      "@remotion/renderer"
    );

    await ensureBrowser();
    const browserExecutable = getBrowserExecutable();

    const rendererOptions = {
      chromiumOptions: {
        enableMultiProcessOnLinux: true
      },
      browserExecutable,
      timeoutInMilliseconds: 120_000,
      logLevel: (process.env.DEBUG_RENDER ? "verbose" : "info") as
        | "verbose"
        | "info"
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
      concurrency: getRenderConcurrency(),
      crf: profileSettings.crf,
      pixelFormat: "yuv420p",
      x264Preset: profileSettings.x264Preset,
      overwrite: true,
      licenseKey: process.env.REMOTION_LICENSE_KEY || undefined,
      ...rendererOptions,
      onProgress: ({progress}) => {
        updateJobProgress(jobId, progress, "rendering");
        console.log(
          `Render job ${jobId} progress (${profile}): ${Math.round(
            progress * 100
          )}%`
        );
      },
      onBrowserLog: (log) => {
        console.log(`[Remotion browser ${log.type}] ${log.text}`);
      }
    });

    const durationMs = Date.now() - startTime;
    completeJob(jobId, {
      url: `/api/renders/${encodeURIComponent(outputFilename)}`,
      outputFilename,
      durationMs
    });
  } catch (error) {
    await rm(outputPath, {force: true}).catch(() => {});
    const message =
      error instanceof Error ? error.message : "Render failed.";
    console.error(`Render job ${jobId} failed:`, message);
    failJob(jobId, message);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {message: "Invalid JSON request body."},
        {status: 400}
      );
    }

    const {project, profile} = exportSchema.parse(body);

    const job = createJob();

    // Start background render task without blocking response
    void runRenderJob(job.id, project, profile, request.url);

    return Response.json({jobId: job.id}, {status: 202});
  } catch (error) {
    if (error instanceof Response) return error;

    if (error instanceof ZodError) {
      return Response.json(
        {
          message: "Invalid project configuration.",
          issues: error.issues
        },
        {status: 422}
      );
    }

    console.error("Export endpoint error:", error);

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Export failed to start."
      },
      {status: 500}
    );
  }
}
