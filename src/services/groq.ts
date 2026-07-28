
import {z} from "zod";

const groqWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number()
});

const groqResponseSchema = z.object({
  text: z.string().optional(),
  duration: z.number().optional(),
  words: z.array(groqWordSchema)
});

export type GroqWord = z.infer<typeof groqWordSchema>;

export async function transcribeWithGroq(options: {
  apiKey: string;
  file: File;
  prompt?: string;
}) {
  const formData = new FormData();

  formData.append("file", options.file, options.file.name);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("temperature", "0");

  if (options.prompt) {
    formData.append("prompt", options.prompt.slice(0, 800));
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(180_000)
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Groq transcription failed (${response.status}): ${message.slice(0, 300)}`
    );
  }

  return groqResponseSchema.parse(await response.json());
}


