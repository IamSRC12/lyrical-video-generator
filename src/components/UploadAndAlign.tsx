"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Cpu,
  Eye,
  EyeOff,
  FileAudio,
  FlaskConical,
  Key,
  LoaderCircle,
  Music2,
  Save,
  Settings,
  Sparkles,
  Zap,
  XCircle
} from "lucide-react";
import {toast} from "sonner";
import {apiKeyStorage} from "@/services/api-keys";
import {uploadAsset} from "@/services/asset-client";
import {detectBeats} from "@/lib/beat-detection";
import {soundManager} from "@/services/sound-manager";
import {useEditorStore, createProject} from "@/stores/editor-store";
import {cn} from "@/lib/cn";

type Stage = "idle" | "uploading" | "transcribing" | "analyzing" | "done";
type ValidationStatus = "idle" | "testing" | "valid" | "invalid";
type AiProvider = "opencode" | "nvidia";

const OPENCODE_PRESET_MODELS = [
  {id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash (Free / Default)"},
  {id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (High Accuracy)"},
  {id: "gpt-4o-mini", label: "GPT-4o Mini (Fast)"},
  {id: "gemini-2.5-flash", label: "Gemini 2.5 Flash"},
  {id: "custom", label: "Custom Model ID..."}
];

const NVIDIA_PRESET_MODELS = [
  {id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct (Recommended)"},
  {id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B Instruct"},
  {id: "mistralai/mistral-large-2-instruct", label: "Mistral Large 2"},
  {id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1 Reasoning"},
  {id: "custom", label: "Custom NVIDIA Model ID..."}
];

async function validateKey(provider: "groq" | "opencode" | "nvidia", key: string) {
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

export function UploadAndAlign() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const loadProject = useEditorStore((s) => s.loadProject);

  // API & Model Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [provider, setProvider] = useState<AiProvider>("opencode");

  // OpenCode credentials state
  const [opencodeKey, setOpencodeKey] = useState("");
  const [opencodeModel, setOpencodeModel] = useState("deepseek-v4-flash-free");
  const [customOpencodeModel, setCustomOpencodeModel] = useState("");

  // NVIDIA credentials state
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [nvidiaModel, setNvidiaModel] = useState("meta/llama-3.3-70b-instruct");
  const [customNvidiaModel, setCustomNvidiaModel] = useState("");

  // UI state
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showOpencodeKey, setShowOpencodeKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);

  const [groqStatus, setGroqStatus] = useState<ValidationStatus>("idle");
  const [opencodeStatus, setOpencodeStatus] = useState<ValidationStatus>("idle");
  const [nvidiaStatus, setNvidiaStatus] = useState<ValidationStatus>("idle");

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hasConfiguredKeys, setHasConfiguredKeys] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    apiKeyStorage.get().then((saved) => {
      if (saved) {
        setGroqKey(saved.groq || "");
        setProvider(saved.provider || "opencode");

        // OpenCode saved values
        setOpencodeKey(saved.opencode || "");
        const isOpencodePreset = OPENCODE_PRESET_MODELS.some((m) => m.id === saved.opencodeModel);
        if (isOpencodePreset) {
          setOpencodeModel(saved.opencodeModel || "deepseek-v4-flash-free");
        } else if (saved.opencodeModel) {
          setOpencodeModel("custom");
          setCustomOpencodeModel(saved.opencodeModel);
        }

        // NVIDIA saved values
        setNvidiaKey(saved.nvidia || "");
        const isNvidiaPreset = NVIDIA_PRESET_MODELS.some((m) => m.id === saved.nvidiaModel);
        if (isNvidiaPreset) {
          setNvidiaModel(saved.nvidiaModel || "meta/llama-3.3-70b-instruct");
        } else if (saved.nvidiaModel) {
          setNvidiaModel("custom");
          setCustomNvidiaModel(saved.nvidiaModel);
        }

        const activeAiKey = saved.provider === "nvidia" ? saved.nvidia : saved.opencode;
        if (saved.groq && activeAiKey) {
          setHasConfiguredKeys(true);
          setGroqStatus("valid");
          if (saved.provider === "nvidia") setNvidiaStatus("valid");
          else setOpencodeStatus("valid");
        } else {
          setShowSettings(true);
        }
      } else {
        setShowSettings(true);
      }
    });
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file.");
      return;
    }
    setAudioFile(file);
    soundManager.beep(660);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function testIndividualKey(target: "groq" | "opencode" | "nvidia") {
    const key =
      target === "groq"
        ? groqKey
        : target === "nvidia"
        ? nvidiaKey
        : opencodeKey;

    const setStatus =
      target === "groq"
        ? setGroqStatus
        : target === "nvidia"
        ? setNvidiaStatus
        : setOpencodeStatus;

    const name =
      target === "groq" ? "Groq" : target === "nvidia" ? "NVIDIA API" : "OpenCode Zen";

    if (!key.trim()) {
      toast.error(`Please enter a ${name} API key first.`);
      return;
    }

    try {
      setStatus("testing");
      toast.info(`Testing ${name} API key...`);
      await validateKey(target, key.trim());
      setStatus("valid");
      await soundManager.beep(720);
      toast.success(`${name} API key is valid & working!`);
    } catch (err) {
      setStatus("invalid");
      toast.error(err instanceof Error ? err.message : `${name} validation failed.`);
    }
  }

  async function saveSettings(): Promise<boolean> {
    if (!groqKey.trim()) {
      toast.error("Groq API key is required for audio transcription.");
      return false;
    }

    const activeAiKey = provider === "nvidia" ? nvidiaKey.trim() : opencodeKey.trim();
    if (!activeAiKey) {
      toast.error(`API key is required for ${provider === "nvidia" ? "NVIDIA" : "OpenCode"}.`);
      return false;
    }

    const activeOpencodeModel = opencodeModel === "custom" ? customOpencodeModel.trim() : opencodeModel;
    const activeNvidiaModel = nvidiaModel === "custom" ? customNvidiaModel.trim() : nvidiaModel;

    try {
      setIsSavingSettings(true);
      setGroqStatus("testing");
      if (provider === "nvidia") setNvidiaStatus("testing");
      else setOpencodeStatus("testing");

      const results = await Promise.allSettled([
        validateKey("groq", groqKey),
        validateKey(provider, activeAiKey)
      ]);

      const groqValid = results[0].status === "fulfilled";
      const aiValid = results[1].status === "fulfilled";

      setGroqStatus(groqValid ? "valid" : "invalid");
      if (provider === "nvidia") setNvidiaStatus(aiValid ? "valid" : "invalid");
      else setOpencodeStatus(aiValid ? "valid" : "invalid");

      if (!groqValid || !aiValid) {
        const failure = results.find(
          (res): res is PromiseRejectedResult => res.status === "rejected"
        );
        throw failure?.reason ?? new Error("API Key validation failed.");
      }

      await apiKeyStorage.set({
        groq: groqKey.trim(),
        provider,
        opencode: opencodeKey.trim(),
        opencodeModel: activeOpencodeModel || "deepseek-v4-flash-free",
        nvidia: nvidiaKey.trim(),
        nvidiaModel: activeNvidiaModel || "meta/llama-3.3-70b-instruct"
      });

      await soundManager.beep(720);
      setHasConfiguredKeys(true);
      toast.success(`API keys and ${provider.toUpperCase()} provider settings saved!`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function process() {
    if (!audioFile || !lyrics.trim()) {
      toast.error("Audio file and lyrics are both required.");
      return;
    }

    let credentials = await apiKeyStorage.get();
    if (!credentials || !credentials.groq) {
      toast.info("Please configure and save your API keys first.");
      setShowSettings(true);
      return;
    }

    try {
      // Step 1: Upload audio asset
      setStage("uploading");
      setProgress(15);
      const uploadedAudio = await uploadAsset(audioFile);
      const audioUrl = uploadedAudio.url;
      setProgress(30);

      // Step 2: Transcribe and align
      setStage("transcribing");
      setProgress(45);

      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("lyrics", lyrics);

      const transcriptionResponse = await fetch("/api/transcription", {
        method: "POST",
        headers: {"x-groq-key": credentials.groq},
        body: formData
      });

      if (!transcriptionResponse.ok) {
        const err = await transcriptionResponse.json();
        throw new Error(err.message ?? "Transcription failed.");
      }

      const transcription = await transcriptionResponse.json();
      setProgress(70);

      if (transcription.removedLines?.length) {
        toast.info(
          `Removed ${transcription.removedLines.length} lyric headings: ` +
            transcription.removedLines.slice(0, 4).join(", ")
        );
      }

      // Step 3: Beat detection
      setStage("analyzing");
      setProgress(80);

      let beats: number[] = [];
      let decodedDuration = 0;
      try {
        const beatResult = await detectBeats(audioFile);
        beats = beatResult.beats;
        decodedDuration = beatResult.duration;
        toast.success(`Detected ~${beatResult.bpm} BPM`);
      } catch {
        toast.warning("Beat detection was not available for this file.");
      }

      setProgress(95);

      const finalSegmentEnd =
        transcription.segments.at(-1)?.end ?? 0;

      // Step 4: Create project
      const project = createProject({
        audioUrl,
        duration: Math.max(
          decodedDuration,
          transcription.duration,
          finalSegmentEnd,
          1
        ),
        segments: transcription.segments,
        beats
      });

      loadProject(project);
      setStage("done");
      setProgress(100);

      await soundManager.beep(880);
      toast.success("Project ready! Opening editor...");

      setTimeout(() => router.push("/editor"), 600);
    } catch (error) {
      setStage("idle");
      setProgress(0);
      toast.error(
        error instanceof Error ? error.message : "Processing failed."
      );
    }
  }

  const isProcessing = stage !== "idle" && stage !== "done";

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[.3em] text-violet-500">
          <Music2 size={16} />
          Upload &amp; Align
        </div>
        <h1 className="mt-2 text-4xl font-black tracking-tight">
          Create your lyrical video
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Drop your audio, paste the lyrics, and let AI handle the rest.
        </p>

        {/* API & Model Settings Toggle Bar */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              showSettings
                ? "border-violet-500 bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
                : hasConfiguredKeys
                ? "border-white/10 bg-white/5 text-slate-300 hover:border-violet-500/40 hover:bg-violet-500/10"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            )}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={14} className={cn(showSettings && "animate-spin-once")} />
            <span>API Keys &amp; AI Provider ({provider === "nvidia" ? "NVIDIA API" : "OpenCode Zen"})</span>
            {hasConfiguredKeys ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400" title="Keys Configured" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Keys Required" />
            )}
            {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* API & Model Settings Collapsible Panel */}
      {showSettings && (
        <div className="panel-3d border border-violet-500/30 bg-surface-raised p-6 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-violet-400" />
              <h2 className="text-lg font-bold text-white">API Credentials &amp; AI Provider Setup</h2>
            </div>
            <span className="text-xs text-slate-400">
              Encrypted locally in browser
            </span>
          </div>

          {/* Provider Option Selector: OpenCode vs NVIDIA */}
          <div className="space-y-2">
            <label className="label text-xs">AI Animation Provider Option</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition-all",
                  provider === "opencode"
                    ? "border-violet-500 bg-violet-500/15 text-white ring-1 ring-violet-500/40"
                    : "border-white/10 bg-black/40 text-slate-400 hover:border-white/20 hover:text-slate-200"
                )}
                onClick={() => setProvider("opencode")}
              >
                <Zap size={16} className={provider === "opencode" ? "text-violet-400" : "text-slate-500"} />
                <span>OpenCode Zen API</span>
              </button>

              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition-all",
                  provider === "nvidia"
                    ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                    : "border-white/10 bg-black/40 text-slate-400 hover:border-white/20 hover:text-slate-200"
                )}
                onClick={() => setProvider("nvidia")}
              >
                <Cpu size={16} className={provider === "nvidia" ? "text-emerald-400" : "text-slate-500"} />
                <span>NVIDIA NIM API</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
            {/* Groq Key Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label text-xs">Groq API Key (Whisper STT)</label>
                {groqStatus === "valid" && (
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                    <CheckCircle2 size={12} /> Valid
                  </span>
                )}
                {groqStatus === "invalid" && (
                  <span className="text-red-400 text-[10px] flex items-center gap-1">
                    <XCircle size={12} /> Invalid
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showGroqKey ? "text" : "password"}
                  className="input pr-9 text-xs font-mono"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    setGroqStatus("idle");
                  }}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                >
                  {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                className="button-ghost px-2.5 py-1 text-xs text-violet-400 hover:bg-violet-500/10 flex items-center gap-1.5"
                disabled={groqStatus === "testing" || !groqKey}
                onClick={() => testIndividualKey("groq")}
              >
                {groqStatus === "testing" ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <FlaskConical size={13} />
                )}
                <span>Test Groq Key</span>
              </button>
            </div>

            {/* AI Provider Key Input depending on option selection */}
            {provider === "opencode" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label text-xs">OpenCode Zen API Key</label>
                  {opencodeStatus === "valid" && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valid
                    </span>
                  )}
                  {opencodeStatus === "invalid" && (
                    <span className="text-red-400 text-[10px] flex items-center gap-1">
                      <XCircle size={12} /> Invalid
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showOpencodeKey ? "text" : "password"}
                    className="input pr-9 text-xs font-mono"
                    placeholder="sk-..."
                    value={opencodeKey}
                    onChange={(e) => {
                      setOpencodeKey(e.target.value);
                      setOpencodeStatus("idle");
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    onClick={() => setShowOpencodeKey(!showOpencodeKey)}
                  >
                    {showOpencodeKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="button-ghost px-2.5 py-1 text-xs text-violet-400 hover:bg-violet-500/10 flex items-center gap-1.5"
                  disabled={opencodeStatus === "testing" || !opencodeKey}
                  onClick={() => testIndividualKey("opencode")}
                >
                  {opencodeStatus === "testing" ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <FlaskConical size={13} />
                  )}
                  <span>Test OpenCode Key</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label text-xs">NVIDIA API Key</label>
                  {nvidiaStatus === "valid" && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valid
                    </span>
                  )}
                  {nvidiaStatus === "invalid" && (
                    <span className="text-red-400 text-[10px] flex items-center gap-1">
                      <XCircle size={12} /> Invalid
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showNvidiaKey ? "text" : "password"}
                    className="input pr-9 text-xs font-mono"
                    placeholder="nvapi-..."
                    value={nvidiaKey}
                    onChange={(e) => {
                      setNvidiaKey(e.target.value);
                      setNvidiaStatus("idle");
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                  >
                    {showNvidiaKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="button-ghost px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
                  disabled={nvidiaStatus === "testing" || !nvidiaKey}
                  onClick={() => testIndividualKey("nvidia")}
                >
                  {nvidiaStatus === "testing" ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <FlaskConical size={13} />
                  )}
                  <span>Test NVIDIA Key</span>
                </button>
              </div>
            )}
          </div>

          {/* Model Selector depending on option selection */}
          <div className="space-y-1.5 border-t border-white/5 pt-4">
            <label className="label text-xs font-semibold">
              {provider === "nvidia" ? "NVIDIA NIM Model" : "OpenCode Zen Model"}
            </label>

            {provider === "opencode" ? (
              <>
                <select
                  className="input text-xs cursor-pointer"
                  value={opencodeModel}
                  onChange={(e) => setOpencodeModel(e.target.value)}
                >
                  {OPENCODE_PRESET_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {m.label}
                    </option>
                  ))}
                </select>

                {opencodeModel === "custom" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="input text-xs font-mono"
                      placeholder="e.g. deepseek-v4-flash-free or gpt-4o"
                      value={customOpencodeModel}
                      onChange={(e) => setCustomOpencodeModel(e.target.value)}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <select
                  className="input text-xs cursor-pointer"
                  value={nvidiaModel}
                  onChange={(e) => setNvidiaModel(e.target.value)}
                >
                  {NVIDIA_PRESET_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {m.label}
                    </option>
                  ))}
                </select>

                {nvidiaModel === "custom" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="input text-xs font-mono"
                      placeholder="e.g. meta/llama-3.3-70b-instruct"
                      value={customNvidiaModel}
                      onChange={(e) => setCustomNvidiaModel(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="button-primary text-xs px-4 py-2"
              disabled={
                isSavingSettings ||
                !groqKey ||
                (provider === "nvidia" ? !nvidiaKey : !opencodeKey)
              }
              onClick={async () => {
                const ok = await saveSettings();
                if (ok) setShowSettings(false);
              }}
            >
              {isSavingSettings ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Validating &amp; Saving...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save &amp; Apply Settings
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Audio Dropzone */}
      <div
        className={cn("dropzone", dragActive && "active")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {audioFile ? (
          <>
            <FileAudio size={40} className="text-emerald-500" />
            <div className="text-center">
              <p className="font-semibold">{audioFile.name}</p>
              <p className="text-xs text-slate-500">
                {(audioFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <button
              className="button-ghost text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setAudioFile(null);
              }}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <CloudUpload size={40} className="text-violet-500" />
            <div className="text-center">
              <p className="font-semibold">
                Drop your audio file here
              </p>
              <p className="text-xs text-slate-500">
                MP3, WAV, FLAC, OGG, WebM — up to 25 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Lyrics Input */}
      <div>
        <label className="label">Lyrics</label>
        <textarea
          className="textarea"
          rows={10}
          placeholder={
            "Paste your lyrics here, one line per lyric line...\n\nVerse 1:\nI've been waiting for the light\nTo break through the endless night"
          }
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          disabled={isProcessing}
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>
            {lyrics.split(/\r?\n/).filter((l) => l.trim()).length} lines
          </span>
          <span>{lyrics.length} characters</span>
        </div>
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LoaderCircle size={16} className="animate-spin text-violet-500" />
            <span>
              {stage === "uploading" && "Uploading audio..."}
              {stage === "transcribing" && "Transcribing & aligning lyrics..."}
              {stage === "analyzing" && "Detecting beats..."}
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{width: `${progress}%`}}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        className="button-primary w-full"
        disabled={!audioFile || !lyrics.trim() || isProcessing}
        onClick={process}
      >
        <Sparkles size={16} />
        {isProcessing ? "Processing..." : "Transcribe & align"}
      </button>
    </div>
  );
}
