import {requireUser} from "@/lib/auth-guard";
import {z} from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["groq", "opencode", "nvidia"]),
  key: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireUser();

    const {provider, key} = requestSchema.parse(await request.json());
    const trimmedKey = key.trim();

    if (!trimmedKey) {
      return Response.json(
        {valid: false, message: "API key cannot be empty."},
        {status: 400}
      );
    }

    if (provider === "groq") {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          Accept: "application/json"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body?.error?.message ??
          (response.status === 401
            ? "Invalid Groq API key."
            : `Groq returned HTTP ${response.status}.`);

        return Response.json({valid: false, message}, {status: 400});
      }
    } else if (provider === "nvidia") {
      const response = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "meta/llama-3.3-70b-instruct",
            messages: [{role: "user", content: "hi"}],
            max_tokens: 1
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15_000)
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body?.detail ??
          body?.error?.message ??
          (response.status === 401
            ? "Invalid NVIDIA API key."
            : `NVIDIA API returned HTTP ${response.status}.`);

        return Response.json({valid: false, message}, {status: 400});
      }
    } else if (provider === "opencode") {
      const response = await fetch(
        "https://opencode.ai/zen/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "deepseek-v4-flash-free",
            messages: [{role: "user", content: "hi"}],
            max_tokens: 1
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15_000)
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body?.error?.message ??
          body?.message ??
          (response.status === 401
            ? "Invalid OpenCode Zen API key."
            : `OpenCode API returned HTTP ${response.status}.`);

        return Response.json({valid: false, message}, {status: 400});
      }
    }

    return Response.json({valid: true});
  } catch (error) {
    if (error instanceof Response) return error;

    return Response.json(
      {
        valid: false,
        message:
          error instanceof Error ? error.message : "Validation request failed."
      },
      {status: 400}
    );
  }
}
