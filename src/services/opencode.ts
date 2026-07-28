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

const rawResultSchema = z.object({
  animations: z.array(
    z.object({
      id: z.string(),
      animation: z.string()
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
        temperature: 0.1,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: [
              "You are selecting typography entrance animations for a lyrical video.",
              "Read the whole song in order and use the previous and next lines as context.",
              "Do not force variety. Repeating the same animation is correct when the emotion stays consistent.",
              "",
              "Animation rules:",
              "- fade: calm, intimate, reflective, neutral, soft or uncertain lines.",
              "- slide_up: hopeful, rising, moving forward, uplifting or building lines.",
              "- pop: joyful, playful, catchy, confident or strongly accented words.",
              "- neon_pulse: electric, nightlife, dreamy, romantic, futuristic or energetic lines.",
              "- zoom_blur: memory, confusion, longing, distance, dreams or surreal imagery.",
              "- rain: sadness, grief, loneliness, tears, loss or explicit rain imagery only.",
              "- shake: anger, fear, violence, panic, impact or extreme intensity only.",
              "",
              "Prefer fade when meaning is ambiguous.",
              "Do not use rain merely because a line is slow.",
              "Do not use shake unless the line is genuinely intense.",
              "Return exactly one result for every supplied ID.",
              "Preserve IDs exactly.",
              "Return JSON only:",
              '{"animations":[{"id":"original-id","animation":"fade"}]}'
            ].join("\n")
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

  const parsed = rawResultSchema.parse(
    JSON.parse(extractJson(content))
  );

  const generated = new Map<string, z.infer<typeof animationSchema>>();

  for (const item of parsed.animations) {
    const animation = animationSchema.safeParse(item.animation);

    if (animation.success) {
      generated.set(item.id, animation.data);
    }
  }

  return options.lines.map((line) => ({
    id: line.id,
    animation: generated.get(line.id) ?? "fade"
  }));
}
