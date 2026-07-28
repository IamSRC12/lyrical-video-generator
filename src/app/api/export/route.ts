import { requireAuth } from "@/lib/auth-guard";
import { projectSchema } from "@/lib/editor-schema";
import { createExportJob, processExportJob } from "@/services/render";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const project = projectSchema.parse(body.project);

    const userId = session?.user?.id || "anonymous";
    const job = createExportJob(userId, project.id || "default-project");

    // Launch export processing in background without blocking response
    processExportJob(job.id, project).catch((err) => {
      console.error(`Export job ${job.id} failed:`, err);
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: "Export job enqueued successfully."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid export job request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
