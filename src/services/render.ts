import type { EditorProject } from "@/lib/editor-schema";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export function getRemotionBundlePath(): string {
  return path.resolve(
    process.env.REMOTION_BUNDLE_DIRECTORY ?? "./remotion-bundle"
  );
}

export function getRenderOutputDirectory(): string {
  return path.resolve(process.env.RENDER_DIRECTORY ?? "./data/renders");
}

export type ExportJob = {
  id: string;
  userId: string;
  projectId: string;
  status: "queued" | "rendering" | "completed" | "failed";
  progress: number;
  outputAssetId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const exportJobs = new Map<string, ExportJob>();

export function getExportJob(jobId: string): ExportJob | undefined {
  return exportJobs.get(jobId);
}

export function createExportJob(userId: string, projectId: string): ExportJob {
  const job: ExportJob = {
    id: `job_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    userId,
    projectId,
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  exportJobs.set(job.id, job);
  return job;
}

export async function processExportJob(jobId: string, project: EditorProject): Promise<void> {
  const job = exportJobs.get(jobId);
  if (!job) return;

  const bundlePath = getRemotionBundlePath();
  if (!existsSync(bundlePath)) {
    job.status = "failed";
    job.error = `Remotion bundle directory not found at "${bundlePath}". Please execute "npm run build:remotion" prior to starting production server.`;
    job.updatedAt = Date.now();
    return;
  }

  const outputDir = getRenderOutputDirectory();
  await mkdir(outputDir, { recursive: true });

  const renderId = `video_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.mp4`;
  const outputPath = path.join(outputDir, renderId);

  job.status = "rendering";
  job.progress = 0.05;
  job.updatedAt = Date.now();

  try {
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "LyricalVideo",
      inputProps: { project }
    });

    const fps = 60;
    const durationInFrames = Math.max(
      1,
      Math.ceil((project.duration || 10) * fps)
    );

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        width: project.width || 1920,
        height: project.height || 1080,
        fps
      },
      serveUrl: bundlePath,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { project },
      onProgress: ({ progress }) => {
        job.progress = Math.min(0.99, Math.max(0.05, progress));
        job.updatedAt = Date.now();
      }
    });

    job.status = "completed";
    job.progress = 1.0;
    job.outputAssetId = renderId;
    job.updatedAt = Date.now();
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Video rendering failed";
    job.updatedAt = Date.now();
  }
}
