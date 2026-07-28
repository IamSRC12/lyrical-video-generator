import { animationSchema, type AnimationName, type LyricSegment } from "@/lib/editor-schema";
import { chooseAutoAnimation } from "@/lib/auto-animation";
import { z } from "zod";

const aiSuggestionSchema = z.object({
  segmentId: z.string(),
  animation: animationSchema,
  intensity: z.number().min(0.1).max(3.0).optional().default(1.0),
  reason: z.string().optional()
});

const aiResponseSchema = z.object({
  suggestions: z.array(aiSuggestionSchema)
});

function sanitizeJsonFence(text: string): string {
  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return clean.trim();
}

export async function generateDeepSeekAnimations(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  segments: LyricSegment[];
  bpm?: number;
  moodHint?: string;
  requestId?: string;
}): Promise<{ suggestions: Array<{ segmentId: string; animation: AnimationName; intensity: number }> }> {
  const { segments, bpm = 120, moodHint = "expressive" } = options;

  const apiKey = options.apiKey || process.env.OPENCODE_API_KEY;
  const baseUrl = (options.baseUrl || process.env.OPENCODE_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
  const model = options.model || process.env.OPENCODE_MODEL || "deepseek-v4-flash";
  const timeoutMs = Number(process.env.OPENCODE_TIMEOUT_MS ?? 30000);

  if (!segments.length) {
    return { suggestions: [] };
  }

  if (!apiKey) {
    // Return auto animations if no API key is provided
    return {
      suggestions: segments.map((seg) => ({
        segmentId: seg.id,
        animation: chooseAutoAnimation({
          text: seg.text,
          duration: seg.end - seg.start,
          alignmentConfidence: seg.alignmentConfidence,
          beatNearStart: false
        }),
        intensity: 1.0
      }))
    };
  }

  const promptInput = segments.map((s) => ({
    segmentId: s.id,
    lineIndex: s.lineIndex,
    text: s.text,
    duration: Number((s.end - s.start).toFixed(2))
  }));

  const systemPrompt = `You are a professional music video motion graphic designer.
Analyze the lyric segments for a song with BPM=${bpm} and mood="${moodHint}".
Assign an animation preset to each segment from ONLY this list: ["none", "fade", "slide_up", "pop", "neon_pulse", "zoom_blur", "rain", "shake"].
You MUST return ONLY valid JSON matching this exact schema:
{
  "suggestions": [
    {
      "segmentId": "exact-segment-id",
      "animation": "chosen_animation_name",
      "intensity": 1.0,
      "reason": "short explanation"
    }
  ]
}
Do NOT include any extra text, explanations, or Markdown fences.`;

  const userPrompt = `Assign motion graphic animations for these segments:\n${JSON.stringify(promptInput, null, 2)}`;

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const endpoint = `${baseUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
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
        throw new Error(`OpenCode/DeepSeek API error (HTTP ${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const cleanJson = sanitizeJsonFence(rawContent);

      const parsed = JSON.parse(cleanJson);
      const validated = aiResponseSchema.parse(parsed);

      return {
        suggestions: validated.suggestions.map((s) => ({
          segmentId: s.segmentId,
          animation: s.animation,
          intensity: s.intensity ?? 1.0
        }))
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, attempt * 600));
      }
    }
  }

  console.warn("OpenCode/DeepSeek AI animation generation failed, falling back to auto-animations:", lastError?.message);

  return {
    suggestions: segments.map((seg) => ({
      segmentId: seg.id,
      animation: chooseAutoAnimation({
        text: seg.text,
        duration: seg.end - seg.start,
        alignmentConfidence: seg.alignmentConfidence,
        beatNearStart: false
      }),
      intensity: 1.0
    }))
  };
}
