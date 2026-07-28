import { requireAuth } from "@/lib/auth-guard";
import { lyricSegmentSchema } from "@/lib/editor-schema";
import { generateNvidiaAnimations } from "@/services/nvidia";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestBodySchema = z.object({
  segments: z.array(lyricSegmentSchema),
  bpm: z.number().optional(),
  moodHint: z.string().optional()
});

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const customNvidiaKey = request.headers.get("x-nvidia-key");
    const nvidiaApiKey = customNvidiaKey || process.env.NVIDIA_API_KEY;

    if (!nvidiaApiKey) {
      return NextResponse.json(
        { error: "No NVIDIA API key provided. Please configure custom API key or set NVIDIA_API_KEY on server." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { segments, bpm, moodHint } = requestBodySchema.parse(body);

    const updatedSegments = await generateNvidiaAnimations({
      apiKey: nvidiaApiKey,
      segments,
      bpm,
      moodHint
    });

    return NextResponse.json({ segments: updatedSegments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI animation generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
