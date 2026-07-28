import { requireAuth } from "@/lib/auth-guard";
import { getExportJob } from "@/services/render";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ jobId: string }> }
) {
  const { response } = await requireAuth();
  if (response) return response;

  const params = await props.params;
  const jobId = params.jobId;

  const job = getExportJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }

  const downloadUrl = job.outputAssetId ? `/api/assets/${job.outputAssetId}` : undefined;

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    outputAssetId: job.outputAssetId,
    downloadUrl,
    error: job.error,
    updatedAt: job.updatedAt
  });
}
