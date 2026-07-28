import {alignLyricsToWords} from "@/lib/alignment";
import {requireUser} from "@/lib/auth-guard";
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

    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 100_000_000);

    if (file.size > maxBytes) {
      return Response.json(
        {message: `Audio exceeds the ${maxBytes} byte application limit.`},
        {status: 413}
      );
    }

    if (file.type && !allowedTypes.has(file.type)) {
      return Response.json(
        {message: `Unsupported audio type: ${file.type}`},
        {status: 415}
      );
    }

    const transcription = await transcribeWithGroq({
      apiKey,
      file,
      prompt: lyrics.slice(0, 800)
    });

    const segments = alignLyricsToWords(lyrics, transcription.words);
    const finalWord = transcription.words.at(-1);

    return Response.json({
      transcript: transcription.text ?? "",
      duration:
        transcription.duration ??
        finalWord?.end ??
        segments.at(-1)?.end ??
        1,
      segments
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
