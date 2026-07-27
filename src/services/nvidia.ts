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

const animationResponseSchema = z.object({
  animations: z.array(
    z.object({
      id: z.string(),
      animation: animationSchema
    })
  )
});

export async function generateContextualAnimations(options: {
  apiKey: string;
  model: string;
  lines: Array<{id: string; line: string}>;
}) {
  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: [
              "You assign safe visual animations to lyric lines.",
              "Return JSON only.",
              "Allowed animations: fade, slide_up, pop, neon_pulse,",
              "zoom_blur, rain, shake.",
              'Format: {"animations":[{"id":"line id","animation":"fade"}]}',
              "Return exactly one entry for every supplied ID."
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
      `NVIDIA NIM failed (${response.status}): ${(await response.text()).slice(
        0,
        300
      )}`
    );
  }

  const body = responseSchema.parse(await response.json());
  const raw = body.choices[0]?.message.content;

  if (!raw) throw new Error("NVIDIA returned an empty response.");

  const jsonText = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return animationResponseSchema.parse(JSON.parse(jsonText)).animations;
}
