"use client";

import type { AnimationMode, AnimationName } from "@/lib/editor-schema";
import { getStoredOpencodeKey } from "@/services/api-keys";
import { useEditorStore } from "@/stores/editor-store";
import { Download, Layers, Sparkles, Type, Wand2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function LeftPanel() {
  const project = useEditorStore((s) => s.project);
  const updateTextStyle = useEditorStore((s) => s.updateTextStyle);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setSegmentAnimation = useEditorStore((s) => s.setSegmentAnimation);
  const setSegmentAnimationMode = useEditorStore((s) => s.setSegmentAnimationMode);
  const setAllAnimations = useEditorStore((s) => s.setAllAnimations);
  const setKaraokeEnabled = useEditorStore((s) => s.setKaraokeEnabled);
  const setSegmentKaraokeOverride = useEditorStore((s) => s.setSegmentKaraokeOverride);

  const [activeTab, setActiveTab] = useState<"style" | "animation" | "ai" | "export">("style");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  if (!project) return null;

  const style = project.textStyle;
  const selectedSeg = project.segments.find((s) => s.id === selectedSegmentId);

  const handleExportMp4 = async () => {
    setIsExporting(true);
    setExportProgress(0.05);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Export request failed (HTTP ${response.status})`);
      }

      const { jobId } = await response.json();
      toast.info("Export job queued. Processing 60 FPS video server-side...");

      // Poll export job status until completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/export/${jobId}`);
          if (!statusRes.ok) return;

          const jobData = await statusRes.json();
          setExportProgress(Math.round(jobData.progress * 100));

          if (jobData.status === "completed") {
            clearInterval(pollInterval);
            setIsExporting(false);
            setExportProgress(100);
            toast.success("MP4 Video successfully rendered!");

            if (jobData.downloadUrl) {
              const link = document.createElement("a");
              link.href = jobData.downloadUrl;
              link.download = `${project.title || "lyrical-video"}.mp4`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          } else if (jobData.status === "failed") {
            clearInterval(pollInterval);
            setIsExporting(false);
            toast.error(`Export failed: ${jobData.error || "Unknown render error"}`);
          }
        } catch (pollErr) {
          console.warn("Export polling error:", pollErr);
        }
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
      setIsExporting(false);
    }
  };

  const handleRegenerateDeepSeekAnimations = async () => {
    setIsGeneratingAi(true);
    const requestId = crypto.randomUUID();
    useEditorStore.getState().beginGeneration(requestId);

    try {
      const opencodeKey = await getStoredOpencodeKey();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (opencodeKey) headers["x-opencode-key"] = opencodeKey;

      const res = await fetch("/api/opencode/animations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          segments: project.segments,
          bpm: project.bpm || 120,
          moodHint: "expressive",
          requestId
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "AI generation request failed");
      }

      const data = await res.json();
      if (data.suggestions?.length) {
        useEditorStore.getState().applyAnimationSuggestions(requestId, data.suggestions);
        toast.success("DeepSeek V4 Flash motion graphics generated!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      useEditorStore.getState().failGeneration(requestId, msg);
      toast.error(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <aside className="w-80 border-r border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
      {/* Tab Selectors */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 p-1">
        <button
          onClick={() => setActiveTab("style")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "style"
              ? "bg-zinc-800 text-yellow-400 border border-zinc-700"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          <span>Text</span>
        </button>
        <button
          onClick={() => setActiveTab("animation")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "animation"
              ? "bg-zinc-800 text-yellow-400 border border-zinc-700"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Motion</span>
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "ai"
              ? "bg-zinc-800 text-yellow-400 border border-zinc-700"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI</span>
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "export"
              ? "bg-zinc-800 text-yellow-400 border border-zinc-700"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "style" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Type className="h-4 w-4 text-yellow-400" />
              <span>Typography & Karaoke</span>
            </h2>

            {/* Project Global Karaoke Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 border border-zinc-850">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Karaoke Word Highlighting</div>
                <div className="text-[11px] text-zinc-400">Global project toggle</div>
              </div>
              <button
                onClick={() => setKaraokeEnabled(!project.karaokeEnabled)}
                className="text-yellow-400 hover:scale-105 transition-transform"
              >
                {project.karaokeEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-zinc-600" />}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Font Family</label>
              <select
                value={style.fontFamily}
                onChange={(e) => updateTextStyle({ fontFamily: e.target.value })}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-white focus:border-yellow-500 focus:outline-none"
              >
                <option value="Inter">Inter (Sans-Serif)</option>
                <option value="Roboto">Roboto</option>
                <option value="Impact">Impact (Bold Heavy)</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Georgia">Georgia (Serif)</option>
                <option value="Courier New">Courier New (Mono)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Size ({style.fontSize}px)</label>
                <input
                  type="range"
                  min="20"
                  max="180"
                  value={style.fontSize}
                  onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Weight ({style.fontWeight})</label>
                <input
                  type="range"
                  min="300"
                  max="900"
                  step="100"
                  value={style.fontWeight}
                  onChange={(e) => updateTextStyle({ fontWeight: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Text Color</label>
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => updateTextStyle({ color: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded bg-zinc-950 border border-zinc-800 p-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Highlight Color</label>
                <input
                  type="color"
                  value={style.highlightColor}
                  onChange={(e) => updateTextStyle({ highlightColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded bg-zinc-950 border border-zinc-800 p-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Stroke Color</label>
                <input
                  type="color"
                  value={style.outlineColor}
                  onChange={(e) => updateTextStyle({ outlineColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded bg-zinc-950 border border-zinc-800 p-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Stroke ({style.outlineWidth}px)</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={style.outlineWidth}
                  onChange={(e) => updateTextStyle({ outlineWidth: Number(e.target.value) })}
                  className="w-full accent-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Vertical Position ({style.positionY}%)</label>
              <input
                type="range"
                min="10"
                max="90"
                value={style.positionY}
                onChange={(e) => updateTextStyle({ positionY: Number(e.target.value) })}
                className="w-full accent-yellow-400"
              />
            </div>
          </div>
        )}

        {activeTab === "animation" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Layers className="h-4 w-4 text-yellow-400" />
              <span>Motion Graphic Animations</span>
            </h2>

            {selectedSeg ? (
              <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-850 space-y-3">
                <div className="text-xs font-semibold text-zinc-300">
                  Selected Line: <span className="text-yellow-400 font-mono">"{selectedSeg.text}"</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Karaoke Override</span>
                  <button
                    onClick={() =>
                      setSegmentKaraokeOverride(
                        selectedSeg.id,
                        selectedSeg.karaokeOverride === undefined ? false : !selectedSeg.karaokeOverride
                      )
                    }
                    className="text-yellow-400"
                  >
                    {selectedSeg.karaokeOverride ?? project.karaokeEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Animation Mode</label>
                  <select
                    value={selectedSeg.animationMode}
                    onChange={(e) => setSegmentAnimationMode(selectedSeg.id, e.target.value as AnimationMode)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="auto">Auto (Deterministic)</option>
                    <option value="ai">AI (DeepSeek V4 Flash)</option>
                    <option value="manual">Manual Override</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Animation Preset</label>
                  <select
                    value={selectedSeg.animation}
                    onChange={(e) => setSegmentAnimation(selectedSeg.id, e.target.value as AnimationName)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade In/Out</option>
                    <option value="slide_up">Slide Up</option>
                    <option value="pop">Pop & Scale</option>
                    <option value="neon_pulse">Neon Glow Pulse</option>
                    <option value="zoom_blur">Zoom Blur</option>
                    <option value="rain">Lyric Rain</option>
                    <option value="shake">Camera Shake</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Select a line on the timeline to customize its specific animation.</p>
            )}

            <div className="pt-2">
              <label className="block text-xs font-medium text-zinc-300 mb-2">Apply Preset to ALL Lines</label>
              <div className="grid grid-cols-2 gap-2">
                {(["none", "fade", "slide_up", "pop", "neon_pulse", "zoom_blur", "rain", "shake"] as AnimationName[]).map((anim) => (
                  <button
                    key={anim}
                    onClick={() => setAllAnimations(anim)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 py-2 text-xs font-semibold text-zinc-300 hover:border-yellow-500/50 hover:text-yellow-400 transition-all capitalize"
                  >
                    {anim.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span>DeepSeek V4 Flash Assistant</span>
            </h2>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Query DeepSeek V4 Flash via OpenCode adapter to assign restrained, context-aware motion graphic presets.
            </p>

            <button
              onClick={handleRegenerateDeepSeekAnimations}
              disabled={isGeneratingAi}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:brightness-110 disabled:opacity-50 transition-all shadow-md shadow-yellow-500/20"
            >
              <Wand2 className="h-4 w-4" />
              <span>{isGeneratingAi ? "Generating AI Animations..." : "Generate AI Animations"}</span>
            </button>
          </div>
        )}

        {activeTab === "export" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Download className="h-4 w-4 text-yellow-400" />
              <span>Async 60 FPS Video Export</span>
            </h2>

            <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-850 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Resolution</span>
                <span className="text-white font-mono">{project.width}x{project.height}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Frame Rate</span>
                <span className="text-yellow-400 font-mono">60 FPS</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Duration</span>
                <span className="text-white font-mono">{project.duration.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Codec</span>
                <span className="text-white font-mono">H.264 / MP4</span>
              </div>
            </div>

            {isExporting ? (
              <div className="space-y-2 rounded-xl bg-zinc-950 p-4 border border-zinc-800">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span>Rendering 60 FPS MP4 video...</span>
                  <span className="text-yellow-400">{exportProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleExportMp4}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-3 text-xs font-bold text-zinc-950 hover:brightness-110 shadow-lg shadow-yellow-500/20"
              >
                <Download className="h-4 w-4" />
                <span>Start Async 60 FPS Export</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
