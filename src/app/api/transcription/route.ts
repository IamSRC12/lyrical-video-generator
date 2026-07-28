import {alignLyricsToWords} from "@/lib/alignment";
import {requireUser} from "@/lib/auth-guard";
import {cleanLyrics} from "@/lib/lyrics-cleaning";
import {transcribeWithGroq} from "@/services/groq";

export const runtime = "nodejs";
export const maxDuration = 300;

const allowedTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mp4",
  "audio/ogg",
  "audio/webm"
]);

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("audio");
    const lyrics = formData.get("lyrics");
    const apiKey = request.headers.get("x-groq-key");

    if (!(file instanceof File)) {
      return Response.json({message: "Audio file is required."}, {status: 400});
    }

    if (typeof lyrics !== "string" || !lyrics.trim()) {
      return Response.json({message: "Lyrics are required."}, {status: 400});
    }

    if (!apiKey) {
      return Response.json({message: "Groq API key is missing."}, {status: 400});
    }

    const groqAttachmentLimit = 25 * 1024 * 1024;

    if (file.size > groqAttachmentLimit) {
      return Response.json(
        {
          message:
            "Direct Groq transcription uploads cannot exceed 25 MB. Compress the audio to 16 kHz mono FLAC or implement URL/chunked transcription."
        },
        {status: 413}
      );
    }

    if (file.type && !allowedTypes.has(file.type)) {
      return Response.json(
        {message: `Unsupported audio type: ${file.type}`},
        {status: 415}
      );
    }

    const cleanedLyrics = cleanLyrics(lyrics);

    const prompt = cleanedLyrics.text
      .split(/\s+/)
      .slice(0, 180)
      .join(" ");

    const transcription = await transcribeWithGroq({
      apiKey,
      file,
      prompt
    });

    const finalWord = transcription.words.at(-1);

    const duration = Math.max(
      transcription.duration ?? 0,
      finalWord?.end ?? 0,
      1
    );

    const segments = alignLyricsToWords(
      cleanedLyrics.text,
      transcription.words,
      duration
    );

    return Response.json({
      transcript: transcription.text ?? "",
      duration: Math.max(duration, segments.at(-1)?.end ?? 0),
      segments,
      removedLines: cleanedLyrics.removedLines,
      cleanedLyrics: cleanedLyrics.text
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Transcription error:", error);

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Transcription failed."
      },
      {status: 500}
    );
  }
}
