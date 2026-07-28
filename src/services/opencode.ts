
import {animationSchema} from "@/lib/editor-schema";
import {z} from "zod";

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable()
      })
    })
  )
});

const resultSchema = z.object({
  animations: z.array(
    z.object({
      id: z.string(),
      animation: animationSchema
    })
  )
});

function extractJson(value: string): string {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("OpenCode did not return a JSON object.");
  }

  return cleaned.slice(start, end + 1);
}

export async function generateContextualAnimations(options: {
  apiKey: string;
  model: string;
  lines: Array<{id: string; line: string}>;
}) {
  const response = await fetch(
    "https://opencode.ai/zen/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: [
              "Assign one animation to every lyric line.",
              "Use the meaning, emotion and intensity of each line.",
              "Allowed values:",
              "fade, slide_up, pop, neon_pulse, zoom_blur, rain, shake.",
              "Avoid assigning the same animation repeatedly.",
              "Return JSON only in this format:",
              '{"animations":[{"id":"id","animation":"fade"}]}'
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify(options.lines)
          }
        ]
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `OpenCode failed (${response.status}): ${(await response.text()).slice(
        0,
        400
      )}`
    );
  }

  const body = responseSchema.parse(await response.json());
  const content = body.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenCode returned an empty response.");
  }

  return resultSchema.parse(
    JSON.parse(extractJson(content))
  ).animations;
}


