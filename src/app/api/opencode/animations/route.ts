import {requireUser} from "@/lib/auth-guard";
import {generateContextualAnimations} from "@/services/opencode";
import {generateGroqAnimations} from "@/services/groq-animations";
import {z} from "zod";

export const runtime = "nodejs";

const schema = z.object({
  model: z.string().optional(),
  provider: z.enum(["groq", "opencode", "nvidia"]).optional().default("groq"),
  bpm: z.number().optional(),
  lines: z
    .array(z.object({id: z.string(), line: z.string().min(1)}))
    .min(1)
    .max(500)
});

export async function POST(request: Request) {
  try {
    await requireUser();

    const groqKey = request.headers.get("x-groq-key");
    const aiKey =
      request.headers.get("x-opencode-key") ||
      request.headers.get("x-nvidia-key") ||
      request.headers.get("x-ai-key") ||
      groqKey;

    const input = schema.parse(await request.json());

    // Try primary chosen provider
    if (input.provider === "groq" || !aiKey) {
      if (!groqKey) {
        return Response.json(
          {message: "Groq API key is missing for animation generation."},
          {status: 400}
        );
      }

      const animations = await generateGroqAnimations({
        apiKey: groqKey,
        model: input.model || "llama-3.3-70b-versatile",
        bpm: input.bpm,
        lines: input.lines
      });

      return Response.json({animations});
    }

    try {
      const animations = await generateContextualAnimations({
        apiKey: aiKey,
        model: input.model || "deepseek-v4-flash-free",
        provider: input.provider === "nvidia" ? "nvidia" : "opencode",
        lines: input.lines
      });

      return Response.json({animations});
    } catch (aiError) {
      console.warn("Primary AI animation failed, trying Groq Llama 3.3 70B fallback...", aiError);

      if (groqKey) {
        const fallbackAnimations = await generateGroqAnimations({
          apiKey: groqKey,
          model: "llama-3.3-70b-versatile",
          bpm: input.bpm,
          lines: input.lines
        });

        return Response.json({animations: fallbackAnimations});
      }

      throw aiError;
    }
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("AI animation generation error:", error);

    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Animation generation failed."
      },
      {status: 500}
    );
  }
}
