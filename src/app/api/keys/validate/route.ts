import {requireUser} from "@/lib/auth-guard";
import {z} from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["groq", "opencode", "nvidia"]),
  key: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    await requireUser();

    const {provider, key} = requestSchema.parse(await request.json());

    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/models"
        : provider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1/models"
        : "https://opencode.ai/zen/v1/models";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      return Response.json(
        {
          valid: false,
          message:
            response.status === 401 || response.status === 403
              ? "The API key was rejected."
              : `Provider returned HTTP ${response.status}.`
        },
        {status: 400}
      );
    }

    return Response.json({valid: true});
  } catch (error) {
    if (error instanceof Response) return error;

    return Response.json(
      {
        valid: false,
        message:
          error instanceof Error ? error.message : "Validation failed."
      },
      {status: 400}
    );
  }
}
