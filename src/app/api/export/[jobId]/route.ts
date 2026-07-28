import {requireUser} from "@/lib/auth-guard";
import {getJob} from "@/services/render-jobs";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {params: Promise<{jobId: string}>}
) {
  try {
    await requireUser();
    const {jobId} = await context.params;

    const job = getJob(jobId);

    if (!job) {
      return Response.json(
        {message: "Render job not found."},
        {status: 404}
      );
    }

    return Response.json({
      status: job.status,
      progress: job.progress,
      url: job.url,
      outputFilename: job.outputFilename,
      durationMs: job.durationMs,
      message: job.message
    });
  } catch (error) {
    if (error instanceof Response) return error;

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to fetch job status."
      },
      {status: 500}
    );
  }
}
