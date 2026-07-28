import { z } from "zod";

const groqWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number()
});

const groqVerboseResponseSchema = z.object({
  task: z.string().optional(),
  language: z.string().optional(),
  duration: z.number().optional(),
  text: z.string().optional(),
  words: z.array(groqWordSchema).default([])
});

export type GroqWord = z.infer<typeof groqWordSchema>;
export type GroqVerboseResponse = z.infer<typeof groqVerboseResponseSchema>;

export async function transcribeWithGroq(options: {
  apiKey: string;
  file: File | Blob;
  filename?: string;
  prompt?: string;
}): Promise<GroqVerboseResponse> {
  const formData = new FormData();

  const fileName = options.filename || (options.file instanceof File ? options.file.name : "audio.mp3");
  formData.append("file", options.file, fileName);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("temperature", "0");

  if (options.prompt && options.prompt.trim()) {
    formData.append("prompt", options.prompt.slice(0, 800));
  }

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`
    },
    body: formData,
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMessage = errorText;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson?.error?.message) parsedMessage = errJson.error.message;
    } catch {
      // Use raw text snippet
    }
    throw new Error(`Groq API Error (${response.status}): ${parsedMessage.slice(0, 300)}`);
  }

  const rawJson = await response.json();
  return groqVerboseResponseSchema.parse(rawJson);
}
