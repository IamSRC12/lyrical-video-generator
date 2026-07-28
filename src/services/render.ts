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

export function getRenderConcurrency(): string {
  return process.env.RENDER_CONCURRENCY ?? "75%";
}

export type RenderProgressCallback = (progress: number) => void;

class RenderSemaphore {
  private activeCount = 0;
  private maxConcurrent = 2;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.activeCount++;
  }

  release(): void {
    this.activeCount--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const renderSemaphore = new RenderSemaphore();

export async function renderProjectVideo(
  project: EditorProject,
  onProgress?: RenderProgressCallback
): Promise<{ filePath: string; filename: string }> {
  const bundlePath = getRemotionBundlePath();

  if (!existsSync(bundlePath)) {
    throw new Error(
      `Remotion bundle directory not found at "${bundlePath}". Please execute "npm run build:remotion" prior to starting production server.`
    );
  }

  const outputDir = getRenderOutputDirectory();
  await mkdir(outputDir, { recursive: true });

  const renderId = `video_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.mp4`;
  const outputPath = path.join(outputDir, renderId);

  await renderSemaphore.acquire();

  try {
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "LyricalVideo",
      inputProps: { project }
    });

    const durationInFrames = Math.max(
      1,
      Math.ceil((project.duration || 10) * project.fps)
    );

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        width: project.width,
        height: project.height,
        fps: project.fps
      },
      serveUrl: bundlePath,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { project },
      onProgress: ({ progress }) => {
        if (onProgress) onProgress(progress);
      }
    });

    return { filePath: outputPath, filename: renderId };
  } finally {
    renderSemaphore.release();
  }
}
