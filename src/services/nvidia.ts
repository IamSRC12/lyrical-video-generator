import { animationSchema, type AnimationName, type LyricSegment } from "@/lib/editor-schema";
import { z } from "zod";

const aiAnimationAssignmentSchema = z.object({
  id: z.string(),
  animation: animationSchema,
  intensity: z.number().min(0.2).max(3).optional()
});

const aiResponseSchema = z.array(aiAnimationAssignmentSchema);

const VALID_ANIMATIONS: AnimationName[] = [
  "fade",
  "slide_up",
  "pop",
  "neon_pulse",
  "zoom_blur",
  "rain",
  "shake"
];

function sanitizeJsonString(text: string): string {
  // Strip Markdown code blocks if present
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return clean.trim();
}

function getDeterministicFallback(segmentLine: string, index: number): AnimationName {
  const lower = segmentLine.toLowerCase();
  if (lower.includes("rain") || lower.includes("fall") || lower.includes("tear")) return "rain";
  if (lower.includes("fire") || lower.includes("dance") || lower.includes("loud") || lower.includes("beat")) return "neon_pulse";
  if (lower.includes("jump") || lower.includes("up") || lower.includes("rise")) return "slide_up";
  if (lower.includes("crazy") || lower.includes("shake") || lower.includes("wild")) return "shake";
  if (lower.includes("look") || lower.includes("eye") || lower.includes("see")) return "zoom_blur";
  return VALID_ANIMATIONS[index % VALID_ANIMATIONS.length];
}

export async function generateNvidiaAnimations(options: {
  apiKey: string;
  segments: LyricSegment[];
  bpm?: number;
  moodHint?: string;
}): Promise<LyricSegment[]> {
  const { apiKey, segments, bpm = 120, moodHint = "energetic" } = options;

  if (!segments.length) return segments;

  const promptSegments = segments.map((s, idx) => ({
    id: s.id,
    index: idx,
    line: s.line,
    duration: (s.end - s.start).toFixed(2)
  }));

  const systemPrompt = `You are a high-end music video motion graphics director.
Given a list of lyric lines, song BPM (${bpm}), and mood ("${moodHint}"), assign the single most visually engaging animation to each line.
You MUST choose ONLY from these exact animation names: ["fade", "slide_up", "pop", "neon_pulse", "zoom_blur", "rain", "shake"].
Output ONLY valid JSON matching this structure:
[
  { "id": "segment-id", "animation": "chosen_animation_name", "intensity": 1.0 }
]
Do not include any conversational text or explanation outside the JSON array.`;

  const userPrompt = `Assign animations to these lyric lines:\n${JSON.stringify(promptSegments, null, 2)}`;

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NVIDIA API response HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const cleanJson = sanitizeJsonString(rawContent);

      const parsed = JSON.parse(cleanJson);
      const validated = aiResponseSchema.parse(parsed);

      const mapById = new Map(validated.map((v) => [v.id, v]));

      return segments.map((seg, idx) => {
        const match = mapById.get(seg.id);
        if (match && VALID_ANIMATIONS.includes(match.animation)) {
          return {
            ...seg,
            animation: match.animation,
            animationIntensity: match.intensity ?? seg.animationIntensity ?? 1.0
          };
        }
        return {
          ...seg,
          animation: getDeterministicFallback(seg.line, idx)
        };
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Exponential backoff wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  console.warn("NVIDIA NIM AI animation request failed, using deterministic fallbacks:", lastError?.message);

  // Return segments with deterministic animation fallbacks on AI failure
  return segments.map((seg, idx) => ({
    ...seg,
    animation: getDeterministicFallback(seg.line, idx)
  }));
}
