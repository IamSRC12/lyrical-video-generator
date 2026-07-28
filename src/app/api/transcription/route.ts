import { alignLyricsToWords } from "@/lib/alignment";
import { requireAuth } from "@/lib/auth-guard";
import { transcribeWithGroq } from "@/services/groq";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

// Server-side transcription & alignment cache keyed by audio + lyrics SHA-256
const alignmentCache = new Map<
  string,
  { segments: any[]; duration: number; whisperText: string; wordCount: number }
>();

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const customGroqKey = request.headers.get("x-groq-key");
    const groqApiKey = customGroqKey || process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "No Groq API key provided. Please configure custom API key or set GROQ_API_KEY on server." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const lyricsText = formData.get("lyrics") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    if (!lyricsText || !lyricsText.trim()) {
      return NextResponse.json({ error: "Missing lyrics text" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Generate SHA-256 cache key
    const cacheKey = createHash("sha256")
      .update(fileBuffer)
      .update(lyricsText.trim())
      .update("v2_alignment")
      .digest("hex");

    if (alignmentCache.has(cacheKey)) {
      return NextResponse.json(alignmentCache.get(cacheKey));
    }

    // Step 1: Transcribe audio with Groq Whisper
    const transcription = await transcribeWithGroq({
      apiKey: groqApiKey,
      file,
      prompt: lyricsText.slice(0, 500)
    });

    if (!transcription.words || transcription.words.length === 0) {
      return NextResponse.json(
        { error: "Groq transcription returned no timed words. Check audio clarity or format." },
        { status: 422 }
      );
    }

    // Step 2: Perform global DP alignment
    const segments = alignLyricsToWords(lyricsText, transcription.words);

    const result = {
      segments,
      duration: transcription.duration || 0,
      whisperText: transcription.text || "",
      wordCount: transcription.words.length
    };

    alignmentCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transcription error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
