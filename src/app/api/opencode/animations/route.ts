import {requireUser} from "@/lib/auth-guard";
import {generateContextualAnimations} from "@/services/opencode";
import {z} from "zod";

export const runtime = "nodejs";

const schema = z.object({
  model: z.string().min(1),
  provider: z.enum(["opencode", "nvidia"]).optional().default("opencode"),
  lines: z
    .array(z.object({id: z.string(), line: z.string().min(1)}))
    .min(1)
    .max(500)
});

export async function POST(request: Request) {
  try {
    await requireUser();

    const apiKey =
      request.headers.get("x-opencode-key") ||
      request.headers.get("x-nvidia-key") ||
      request.headers.get("x-ai-key");

    if (!apiKey) {
      return Response.json(
        {message: "AI provider API key is missing."},
        {status: 400}
      );
    }

    const input = schema.parse(await request.json());

    const animations = await generateContextualAnimations({
      apiKey,
      model: input.model,
      provider: input.provider,
      lines: input.lines
    });

    return Response.json({animations});
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
