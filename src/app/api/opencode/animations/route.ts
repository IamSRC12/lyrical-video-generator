import { requireAuth } from "@/lib/auth-guard";
import { lyricSegmentSchema } from "@/lib/editor-schema";
import { generateDeepSeekAnimations } from "@/services/opencode";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestBodySchema = z.object({
  segments: z.array(lyricSegmentSchema),
  bpm: z.number().optional(),
  moodHint: z.string().optional(),
  requestId: z.string().optional()
});

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const customKey = request.headers.get("x-opencode-key");
    const apiKey = customKey || process.env.OPENCODE_API_KEY;

    const body = await request.json();
    const { segments, bpm, moodHint, requestId } = requestBodySchema.parse(body);

    const result = await generateDeepSeekAnimations({
      apiKey,
      segments,
      bpm,
      moodHint,
      requestId
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DeepSeek AI animation generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
