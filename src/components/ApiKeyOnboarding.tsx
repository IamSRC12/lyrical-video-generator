"use client";

import {
  clearStoredGroqKey,
  clearStoredNvidiaKey,
  getStoredGroqKey,
  getStoredNvidiaKey,
  setStoredGroqKey,
  setStoredNvidiaKey
} from "@/services/api-keys";
import { Key, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ApiKeyOnboardingProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ApiKeyOnboarding({ isOpen, onClose }: ApiKeyOnboardingProps) {
  const [groqKey, setGroqKey] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadKeys() {
      try {
        const [gKey, nKey] = await Promise.all([
          getStoredGroqKey(),
          getStoredNvidiaKey()
        ]);
        if (gKey) setGroqKey(gKey);
        if (nKey) setNvidiaKey(nKey);
        if (gKey || nKey) setIsSaved(true);
      } catch (err) {
        console.error("Failed to load encrypted keys:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (isOpen) {
      loadKeys();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      await setStoredGroqKey(groqKey);
      await setStoredNvidiaKey(nvidiaKey);
      setIsSaved(true);
      toast.success("API keys encrypted and saved in secure browser storage.");
      onClose();
    } catch {
      toast.error("Failed to encrypt API keys. Verify WebCrypto support.");
    }
  };

  const handleClear = async () => {
    try {
      await clearStoredGroqKey();
      await clearStoredNvidiaKey();
      setGroqKey("");
      setNvidiaKey("");
      setIsSaved(false);
      toast.info("Stored API keys removed.");
    } catch {
      toast.error("Failed to clear API keys.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="rounded-xl bg-yellow-500/10 p-3 text-yellow-400 border border-yellow-500/20">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">API Key Settings</h2>
            <p className="text-sm text-zinc-400">Encrypted in browser storage with AES-GCM</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-zinc-950 p-3 border border-zinc-850 flex items-start space-x-2.5 text-xs text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Keys are encrypted using 256-bit AES-GCM with non-extractable keys in IndexedDB. Keys are transmitted only per HTTPS request and never stored in server logs.
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-zinc-400">Loading key settings...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Groq API Key (Transcription)</span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-yellow-400 hover:underline font-normal"
                >
                  Get key
                </a>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-yellow-500 focus:outline-none"
                />
                <Key className="absolute right-3 top-3 h-4 w-4 text-zinc-600" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>NVIDIA NIM API Key (AI Animations)</span>
                <a
                  href="https://build.nvidia.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-yellow-400 hover:underline font-normal"
                >
                  Get key
                </a>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={nvidiaKey}
                  onChange={(e) => setNvidiaKey(e.target.value)}
                  placeholder="nvapi-..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-yellow-500 focus:outline-none"
                />
                <Key className="absolute right-3 top-3 h-4 w-4 text-zinc-600" />
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {isSaved && (
            <button
              onClick={handleClear}
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20"
            >
              Clear Keys
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 hover:brightness-110 shadow-lg shadow-yellow-500/20"
            >
              Save Key Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
