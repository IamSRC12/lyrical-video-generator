"use client";

import { defaultTextStyle, type AnimationName, type EditorProject, type LyricSegment } from "@/lib/editor-schema";
import { getStoredGroqKey, getStoredOpencodeKey } from "@/services/api-keys";
import { useEditorStore } from "@/stores/editor-store";
import { Activity, Key, Music, Sparkles, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ApiKeyOnboarding } from "./ApiKeyOnboarding";

type ProcessingStage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "aligning"
  | "beat_detection"
  | "ai_animation"
  | "ready";

export function UploadAndAlign() {
  const setProject = useEditorStore((s) => s.setProject);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [stageProgress, setStageProgress] = useState(0);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
      toast.error("Please upload a valid audio file (MP3, WAV, M4A, AAC, OGG).");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Audio file size must not exceed 50MB.");
      return;
    }

    setAudioFile(file);
    toast.success(`Loaded "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
  };

  const handleProcess = async () => {
    if (!audioFile) {
      toast.error("Please select an audio file.");
      return;
    }
    if (!lyricsText.trim()) {
      toast.error("Please enter or paste the song lyrics.");
      return;
    }
    if (stage !== "idle" && stage !== "ready") return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setStage("uploading");
      setStageProgress(15);

      const assetFormData = new FormData();
      assetFormData.append("file", audioFile);

      const uploadRes = await fetch("/api/assets", {
        method: "POST",
        body: assetFormData,
        signal
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed (HTTP ${uploadRes.status})`);
      }

      const assetData = await uploadRes.json();
      const audioAssetId = assetData.id;
      const audioUrl = assetData.url;

      const groqKey = await getStoredGroqKey();
      const opencodeKey = await getStoredOpencodeKey();

      setStage("transcribing");
      setStageProgress(35);

      const transFormData = new FormData();
      transFormData.append("file", audioFile);
      transFormData.append("lyrics", lyricsText);

      const headers: Record<string, string> = {};
      if (groqKey) headers["x-groq-key"] = groqKey;

      const transRes = await fetch("/api/transcription", {
        method: "POST",
        headers,
        body: transFormData,
        signal
      });

      if (!transRes.ok) {
        const errJson = await transRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Transcription failed (HTTP ${transRes.status})`);
      }

      setStage("aligning");
      setStageProgress(65);

      const transData = await transRes.json();
      let segments: LyricSegment[] = transData.segments;
      const duration = transData.duration || 120;

      setStage("beat_detection");
      setStageProgress(80);

      let beats: number[] = [];
      let bpm = 120;

      try {
        const audioCtx = new AudioContext();
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const { detectBeats } = await import("@/lib/beat-detection");
        const beatResult = await detectBeats(audioBuffer);
        beats = beatResult.beats;
        bpm = beatResult.bpm;

        await audioCtx.close();
      } catch (err) {
        console.warn("Client beat detection skipped:", err);
      }

      if (opencodeKey || process.env.NEXT_PUBLIC_ENABLE_AI !== "false") {
        setStage("ai_animation");
        setStageProgress(90);

        try {
          const aiHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (opencodeKey) aiHeaders["x-opencode-key"] = opencodeKey;

          const aiRes = await fetch("/api/opencode/animations", {
            method: "POST",
            headers: aiHeaders,
            body: JSON.stringify({ segments, bpm, moodHint: "expressive" }),
            signal
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            if (aiData.suggestions?.length) {
              const sugMap = new Map<string, { segmentId: string; animation: AnimationName; intensity?: number }>(
                aiData.suggestions.map((s: any) => [s.segmentId, s])
              );
              segments = segments.map((seg) => {
                const sug = sugMap.get(seg.id);
                if (sug) {
                  return {
                    ...seg,
                    animationMode: "ai",
                    animation: sug.animation,
                    animationIntensity: sug.intensity ?? 1.0
                  };
                }
                return seg;
              });
            }
          }
        } catch (err) {
          console.warn("DeepSeek AI animation generation skipped:", err);
        }
      }

      setStage("ready");
      setStageProgress(100);

      const newProject: EditorProject = {
        version: 2,
        id: crypto.randomUUID(),
        title: audioFile.name.replace(/\.[^/.]+$/, ""),
        fps: 60,
        width: 1920,
        height: 1080,
        duration: Math.max(duration, segments[segments.length - 1]?.end || 0),
        audioAssetId,
        audioUrl,
        backgroundColor: "#090d16",
        karaokeEnabled: true,
        beatSyncEnabled: false,
        segments,
        beats,
        bpm,
        textStyle: defaultTextStyle
      };

      setProject(newProject);
      toast.success("Project generated with 60 FPS timing! Ready to edit.");
    } catch (error) {
      if (signal.aborted) {
        toast.info("Processing cancelled.");
      } else {
        const msg = error instanceof Error ? error.message : "Processing failed";
        toast.error(msg);
      }
      setStage("idle");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const getStageLabel = () => {
    switch (stage) {
      case "uploading": return "Uploading audio asset...";
      case "transcribing": return "Transcribing with Groq Whisper v3...";
      case "aligning": return "Performing global DP fuzzy alignment...";
      case "beat_detection": return "Analyzing audio beats & BPM...";
      case "ai_animation": return "Generating AI animations via DeepSeek V4 Flash...";
      case "ready": return "Finalizing 60 FPS project...";
      default: return "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <ApiKeyOnboarding
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>AI Lyrical Video Studio</span>
            <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400 border border-yellow-500/20">
              Pro 60 FPS
            </span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Synchronize song audio with lyrics, detect beats, and generate motion graphics.
          </p>
        </div>

        <button
          onClick={() => setIsApiKeyModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:border-yellow-500/50 hover:text-white transition-all shadow-md"
        >
          <Key className="h-4 w-4 text-yellow-400" />
          <span>API Key Settings</span>
        </button>
      </div>

      <div className="space-y-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-8 shadow-2xl backdrop-blur-xl">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2 flex items-center gap-2">
            <Music className="h-4 w-4 text-yellow-400" />
            <span>1. Upload Song Audio</span>
          </label>
          <div className="relative group rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 hover:border-yellow-500/50 p-6 text-center transition-all">
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0 z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="rounded-full bg-yellow-500/10 p-3 text-yellow-400 group-hover:scale-110 transition-transform">
                <Upload className="h-6 w-6" />
              </div>
              {audioFile ? (
                <div>
                  <p className="text-sm font-semibold text-white">{audioFile.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Ready
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    Click or drag & drop audio file here
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">MP3, WAV, M4A, AAC, OGG up to 50MB</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span>2. Paste Song Lyrics</span>
            </span>
            <span className="text-xs font-normal text-zinc-500">
              One line per segment
            </span>
          </label>
          <textarea
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            rows={8}
            placeholder={`Paste raw song lyrics here...
Line 1 of song
Line 2 of song
Chorus repeat line`}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-4 text-sm text-white placeholder-zinc-600 focus:border-yellow-500 focus:outline-none font-mono leading-relaxed"
          />
        </div>

        {stage !== "idle" && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-400 animate-spin" />
                <span>{getStageLabel()}</span>
              </span>
              <span className="text-yellow-400">{stageProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-850 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-300"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleProcess}
            disabled={stage !== "idle" && stage !== "ready"}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-xl shadow-yellow-500/20 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <Wand2 className="h-5 w-5" />
            <span>Generate Lyrical Video & Open Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
