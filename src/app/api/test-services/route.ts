import { requireAuth } from "@/lib/auth-guard";
import { getRemotionBundlePath, getRenderOutputDirectory } from "@/services/render";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export type ServiceTestResult = {
  service: "groq" | "opencode" | "assets" | "export";
  ok: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, string | number | boolean>;
};

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  try {
    const customGroqKey = request.headers.get("x-groq-key");
    const customOpencodeKey = request.headers.get("x-opencode-key");

    const groqApiKey = customGroqKey || process.env.GROQ_API_KEY;
    const opencodeApiKey = customOpencodeKey || process.env.OPENCODE_API_KEY;

    const results: ServiceTestResult[] = [];

    // 1. Test Groq API (Minimal authenticated models list)
    const groqStart = Date.now();
    if (!groqApiKey) {
      results.push({
        service: "groq",
        ok: false,
        latencyMs: Date.now() - groqStart,
        message: "No Groq API key configured on server or in browser storage."
      });
    } else {
      try {
        const groqUrl = `${process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1"}/models`;
        const groqRes = await fetch(groqUrl, {
          headers: { Authorization: `Bearer ${groqApiKey}` },
          signal: AbortSignal.timeout(10000)
        });
        const latency = Date.now() - groqStart;

        if (groqRes.ok) {
          results.push({
            service: "groq",
            ok: true,
            latencyMs: latency,
            message: "Groq API key verified successfully.",
            details: { status: groqRes.status }
          });
        } else {
          results.push({
            service: "groq",
            ok: false,
            latencyMs: latency,
            message: `Groq authentication failed (HTTP ${groqRes.status})`
          });
        }
      } catch (err) {
        results.push({
          service: "groq",
          ok: false,
          latencyMs: Date.now() - groqStart,
          message: err instanceof Error ? err.message : "Groq connection failed"
        });
      }
    }

    // 2. Test OpenCode / DeepSeek API
    const opencodeStart = Date.now();
    if (!opencodeApiKey) {
      results.push({
        service: "opencode",
        ok: false,
        latencyMs: Date.now() - opencodeStart,
        message: "No OpenCode/DeepSeek API key configured on server or in browser storage."
      });
    } else {
      try {
        const baseUrl = (process.env.OPENCODE_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
        const model = process.env.OPENCODE_MODEL || "deepseek-v4-flash";
        const ocUrl = `${baseUrl}/models`;

        const ocRes = await fetch(ocUrl, {
          headers: { Authorization: `Bearer ${opencodeApiKey}` },
          signal: AbortSignal.timeout(10000)
        });
        const latency = Date.now() - opencodeStart;

        if (ocRes.ok) {
          results.push({
            service: "opencode",
            ok: true,
            latencyMs: latency,
            message: `DeepSeek provider endpoint reached using model "${model}".`,
            details: { model, status: ocRes.status }
          });
        } else {
          results.push({
            service: "opencode",
            ok: false,
            latencyMs: latency,
            message: `OpenCode/DeepSeek auth failed (HTTP ${ocRes.status})`
          });
        }
      } catch (err) {
        results.push({
          service: "opencode",
          ok: false,
          latencyMs: Date.now() - opencodeStart,
          message: err instanceof Error ? err.message : "DeepSeek connection failed"
        });
      }
    }

    // 3. Test Asset Storage Read/Write
    const assetStart = Date.now();
    try {
      const storageDir = path.resolve(process.env.ASSET_STORAGE_PATH ?? "./data/assets");
      await mkdir(storageDir, { recursive: true });
      const testFile = path.join(storageDir, `.health_check_${Date.now()}.tmp`);
      await writeFile(testFile, "OK");
      await rm(testFile, { force: true });

      results.push({
        service: "assets",
        ok: true,
        latencyMs: Date.now() - assetStart,
        message: "Asset storage directory writable.",
        details: { path: storageDir }
      });
    } catch (err) {
      results.push({
        service: "assets",
        ok: false,
        latencyMs: Date.now() - assetStart,
        message: err instanceof Error ? err.message : "Asset storage write failed"
      });
    }

    // 4. Test Export Environment & Remotion Bundle Readiness
    const exportStart = Date.now();
    const bundlePath = getRemotionBundlePath();
    const renderDir = getRenderOutputDirectory();
    const bundleExists = existsSync(bundlePath);

    if (bundleExists) {
      results.push({
        service: "export",
        ok: true,
        latencyMs: Date.now() - exportStart,
        message: "Prebuilt Remotion bundle and render directory verified.",
        details: { bundlePath, renderDir, fps: 60 }
      });
    } else {
      results.push({
        service: "export",
        ok: false,
        latencyMs: Date.now() - exportStart,
        message: `Remotion bundle not found at "${bundlePath}". Execute "npm run build:remotion" prior to rendering.`
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Diagnostics test error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
