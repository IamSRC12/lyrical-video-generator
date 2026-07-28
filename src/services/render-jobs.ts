/**
 * In-memory render job store.
 * TODO: For multi-process or clustered deployments, replace this in-memory Map
 * with a shared persistent store (e.g. Redis or a database job queue).
 */

export type JobStatus = "queued" | "rendering" | "done" | "error";

export type RenderJob = {
  id: string;
  status: JobStatus;
  progress: number;
  url?: string;
  outputFilename?: string;
  durationMs?: number;
  message?: string;
  createdAt: number;
  updatedAt: number;
};

const jobs = new Map<string, RenderJob>();

export function createJob(): RenderJob {
  const id = crypto.randomUUID();
  const now = Date.now();
  const job: RenderJob = {
    id,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function updateJobProgress(
  id: string,
  progress: number,
  status: JobStatus = "rendering"
): void {
  const job = jobs.get(id);
  if (job) {
    job.status = status;
    job.progress = Math.min(1, Math.max(0, progress));
    job.updatedAt = Date.now();
  }
}

export function completeJob(
  id: string,
  result: {url: string; outputFilename: string; durationMs: number}
): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "done";
    job.progress = 1;
    job.url = result.url;
    job.outputFilename = result.outputFilename;
    job.durationMs = result.durationMs;
    job.updatedAt = Date.now();
  }
}

export function failJob(id: string, message: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "error";
    job.message = message;
    job.updatedAt = Date.now();
  }
}
