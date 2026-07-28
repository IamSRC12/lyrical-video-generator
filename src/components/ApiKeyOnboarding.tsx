"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2, LoaderCircle, XCircle} from "lucide-react";
import {toast} from "sonner";
import {apiKeyStorage} from "@/services/api-keys";
import {soundManager} from "@/services/sound-manager";

type Status = "idle" | "testing" | "valid" | "invalid";

async function validateKey(provider: "groq" | "opencode", key: string) {
  const response = await fetch("/api/keys/validate", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({provider, key})
  });

  const body = await response.json();

  if (!response.ok || !body.valid) {
    throw new Error(body.message ?? `${provider} validation failed.`);
  }
}

function StatusIcon({status}: {status: Status}) {
  if (status === "testing") {
    return <LoaderCircle className="animate-spin text-violet-600" size={18} />;
  }

  if (status === "valid") {
    return <CheckCircle2 className="text-emerald-600" size={18} />;
  }

  if (status === "invalid") {
    return <XCircle className="text-red-600" size={18} />;
  }

  return null;
}

export function ApiKeyOnboarding() {
  const router = useRouter();
  const [groq, setGroq] = useState("");
  const [opencode, setOpencode] = useState("");
  const [opencodeModel, setOpencodeModel] = useState(
    "deepseek-v4-flash-free"
  );
  const [groqStatus, setGroqStatus] = useState<Status>("idle");
  const [opencodeStatus, setOpencodeStatus] = useState<Status>("idle");

  useEffect(() => {
    apiKeyStorage.get().then((saved) => {
      if (!saved) return;
      setGroq(saved.groq);
      setOpencode(saved.opencode);
      setOpencodeModel(saved.opencodeModel);
    });
  }, []);

  async function save() {
    try {
      setGroqStatus("testing");
      setOpencodeStatus("testing");

      const results = await Promise.allSettled([
        validateKey("groq", groq),
        validateKey("opencode", opencode)
      ]);

      const groqValid = results[0].status === "fulfilled";
      const opencodeValid = results[1].status === "fulfilled";

      setGroqStatus(groqValid ? "valid" : "invalid");
      setOpencodeStatus(opencodeValid ? "valid" : "invalid");

      if (!groqValid || !opencodeValid) {
        const failure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        );

        throw failure?.reason ?? new Error("API-key validation failed.");
      }

      await apiKeyStorage.set({
        groq,
        provider: "opencode",
        opencode,
        opencodeModel,
        nvidia: "",
        nvidiaModel: "meta/llama-3.3-70b-instruct"
      });
      await soundManager.beep(720);

      toast.success("API keys validated and encrypted locally.");
      router.push("/upload");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to validate keys."
      );
    }
  }

  return (
    <section className="panel-3d mx-auto max-w-2xl space-y-6 p-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black">Connect your AI providers</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keys are encrypted in this browser and sent only to authenticated
          server endpoints when an operation is requested.
        </p>
      </div>

      <label className="block">
        <span className="label">Groq API key</span>
        <div className="relative">
          <input
            className="input pr-11"
            type="password"
            autoComplete="off"
            value={groq}
            onChange={(event) => {
              setGroq(event.target.value);
              setGroqStatus("idle");
            }}
          />
          <span className="absolute right-3 top-3">
            <StatusIcon status={groqStatus} />
          </span>
        </div>
      </label>

      <label className="block">
        <span className="label">OpenCode Zen API key</span>
        <div className="relative">
          <input
            className="input pr-11"
            type="password"
            autoComplete="off"
            value={opencode}
            onChange={(event) => {
              setOpencode(event.target.value);
              setOpencodeStatus("idle");
            }}
          />
          <span className="absolute right-3 top-3">
            <StatusIcon status={opencodeStatus} />
          </span>
        </div>
      </label>

      <label className="block">
        <span className="label">OpenCode model ID</span>
        <input
          className="input"
          value={opencodeModel}
          onChange={async (event) => {
            setOpencodeModel(event.target.value);
            await soundManager.beep(540);
          }}
        />
        <span className="mt-1 block text-xs text-slate-500">
          OpenCode model catalog ID (e.g. deepseek-v4-flash-free).
        </span>
      </label>

      <button
        className="button-primary w-full"
        disabled={!groq || !opencode}
        onClick={save}
      >
        Validate and continue
      </button>
    </section>
  );
}
