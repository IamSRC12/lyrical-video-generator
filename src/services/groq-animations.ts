import {animationSchema} from "@/lib/editor-schema";
import {z} from "zod";

const resultSchema = z.object({
  animations: z.array(
    z.object({
      id: z.string(),
      animation: animationSchema,
      intensity: z.number().min(0).max(1).optional().default(0.5),
      reason: z.string().optional().default("Subtle entrance")
    })
  )
});

export async function generateGroqAnimations(options: {
  apiKey: string;
  model?: string;
  bpm?: number;
  lines: Array<{
    id: string;
    line: string;
    start?: number;
    end?: number;
    energy?: number;
  }>;
}) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model ?? "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content: [
              "You select subtle typography animations for a lyric video.",
              "Use the complete song context, lyric meaning, line duration, BPM and audio energy.",
              "",
              "Allowed animations:",
              "fade, slide_up, pop, neon_pulse, zoom_blur, rain, shake.",
              "",
              "Rules:",
              "- fade: neutral, calm, intimate or ambiguous.",
              "- slide_up: hopeful, rising or building.",
              "- pop: playful, catchy, joyful or confident.",
              "- neon_pulse: energetic, romantic, nightlife or electric.",
              "- zoom_blur: memories, dreams, confusion or distance.",
              "- rain: grief, loneliness, tears or rain imagery only.",
              "- shake: anger, fear, impact or extreme intensity only.",
              "- Do not force animation variety.",
              "- Prefer fade if uncertain.",
              "- Return one result for every ID.",
              "",
              "Return JSON only:",
              '{"animations":[{"id":"id","animation":"fade","intensity":0.5,"reason":"short reason"}]}'
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              bpm: options.bpm ?? null,
              lines: options.lines
            })
          }
        ]
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Groq animation generation failed (${response.status}): ` +
        (await response.text()).slice(0, 400)
    );
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty animation response.");
  }

  const generated = resultSchema.parse(JSON.parse(content));
  const byId = new Map(
    generated.animations.map((animation) => [
      animation.id,
      animation
    ])
  );

  return options.lines.map((line) => {
    const match = byId.get(line.id);
    return {
      id: line.id,
      animation: match ? match.animation : ("fade" as const),
      intensity: match?.intensity ?? 0.4,
      reason: match?.reason ?? "Safe fallback"
    };
  });
}
