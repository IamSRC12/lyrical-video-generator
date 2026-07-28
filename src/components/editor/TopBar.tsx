"use client";

import {useRef, useState} from "react";
import {
  Check,
  ChevronDown,
  Download,
  FileAudio,
  Film,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Sparkles
} from "lucide-react";
import {toast} from "sonner";
import {useEditorStore} from "@/stores/editor-store";
import {apiKeyStorage} from "@/services/api-keys";
import {uploadAsset} from "@/services/asset-client";
import {cn} from "@/lib/cn";

type ExportProfile = "draft" | "standard" | "high";

const EXPORT_PROFILES: Array<{
  id: ExportProfile;
  label: string;
  desc: string;
  badge: string;
}> = [
  {
    id: "draft",
    label: "Draft",
    desc: "720p • Faster render",
    badge: "Quick Preview"
  },
  {
    id: "standard",
    label: "Standard",
    desc: "1080p • Crisp balance",
    badge: "Recommended"
  },
  {
    id: "high",
    label: "High Quality",
    desc: "1080p • Highest fidelity",
    badge: "Final Export"
  }
];

export function TopBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const exportProgress = useEditorStore((s) => s.exportProgress);
  const setResolution = useEditorStore((s) => s.setResolution);
  const setExportState = useEditorStore((s) => s.setExportState);
  const setToggle = useEditorStore((s) => s.setToggle);
  const setSegments = useEditorStore((s) => s.setSegments);
  const replaceAudioUrl = useEditorStore((s) => s.replaceAudioUrl);

  const replaceAudioRef = useRef<HTMLInputElement>(null);
  const [isReplacingAudio, setIsReplacingAudio] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ExportProfile>("standard");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [needsAudioReupload, setNeedsAudioReupload] = useState(false);

  if (!project) return null;

  const is1080 = project.width === 1920;

  async function handleReplaceAudio(file: File) {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select a valid audio file.");
      return;
    }

    try {
      setIsReplacingAudio(true);
      toast.info(`Uploading replacement audio: ${file.name}...`);
      const uploadedUrl = await uploadAsset(file);

      replaceAudioUrl(uploadedUrl);
      setNeedsAudioReupload(false);
      toast.success("Audio file replaced and verified successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to replace audio."
      );
    } finally {
      setIsReplacingAudio(false);
    }
  }

  async function handleContextualAnimations() {
    if (!project) return;

    const credentials = await apiKeyStorage.get();
    if (!credentials) {
      toast.error("API keys not found. Please setup API keys on onboarding page.");
      return;
    }

    toast.info("Generating contextual animations with OpenCode Zen...");

    try {
      const response = await fetch("/api/opencode/animations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-opencode-key": credentials.opencode
        },
        body: JSON.stringify({
          model: credentials.opencodeModel,
          lines: project.segments.map((segment) => ({
            id: segment.id,
            line: segment.line
          }))
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message);
      }

      const {animations} = await response.json();
      const updated = project.segments.map((seg) => {
        const match = animations.find(
          (a: {id: string; animation: string}) => a.id === seg.id
        );
        return match ? {...seg, animation: match.animation} : seg;
      });

      setSegments(updated);
      setToggle("contextualAnimations", true);
      toast.success("Contextual animations applied!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Animation generation failed."
      );
    }
  }

  async function handleExport(profile: ExportProfile = selectedProfile) {
    if (!project) return;

    setShowExportMenu(false);
    setExportState(true, 0);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          project,
          profile
        })
      });

      if (!response.ok) {
        const err = await response.json();
        const msg = err.issues?.[0]?.message
          ? `${err.message}: ${err.issues[0].path.join(".")} ${err.issues[0].message}`
          : (err.message ?? "Export failed.");
        throw new Error(msg);
      }

      const {jobId} = await response.json();

      // Poll until job completes or fails
      let done = false;
      while (!done) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const pollRes = await fetch(`/api/export/${jobId}`, {
          cache: "no-store"
        });

        if (!pollRes.ok) {
          const err = await pollRes.json().catch(() => ({}));
          throw new Error(err.message ?? "Failed to check render progress.");
        }

        const job = await pollRes.json();
        setExportState(true, Math.round((job.progress || 0) * 100));

        if (job.status === "done") {
          done = true;
          toast.success(
            `Rendered successfully in ${((job.durationMs || 0) / 1000).toFixed(1)}s`
          );

          const anchor = document.createElement("a");
          anchor.href = job.url;
          anchor.download = job.outputFilename ?? "lyrical-video.mp4";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        } else if (job.status === "error") {
          done = true;
          throw new Error(job.message ?? "Render job failed.");
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Export failed.";

      if (
        msg.toLowerCase().includes("re-upload") ||
        msg.toLowerCase().includes("unavailable") ||
        msg.toLowerCase().includes("404")
      ) {
        setNeedsAudioReupload(true);
        toast.error(
          "Audio asset unavailable. Please click 'Replace Audio' to re-upload the song.",
          {duration: 8000}
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setExportState(false, 0);
    }
  }

  return (
    <header className="editor-topbar flex items-center justify-between border-b border-white/5 bg-surface-raised px-4">
      <div className="flex items-center gap-3">
        <Film size={18} className="text-violet-500" />
        <span className="text-sm font-bold tracking-tight">
          {project.title}
        </span>
        <span className="badge">{project.fps} FPS</span>
      </div>

      {/* Hidden file input for Replace Audio */}
      <input
        ref={replaceAudioRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleReplaceAudio(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center gap-2 relative">
        {/* Replace Audio recovery button */}
        <button
          type="button"
          className={cn(
            "button-ghost text-xs flex items-center gap-1.5",
            needsAudioReupload
              ? "border border-amber-500/50 bg-amber-500/15 text-amber-300 animate-pulse"
              : "text-slate-300 hover:text-white"
          )}
          disabled={isReplacingAudio}
          onClick={() => replaceAudioRef.current?.click()}
          title="Re-upload or replace the project audio track"
        >
          {isReplacingAudio ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>Replace Audio</span>
        </button>

        {/* Resolution toggle */}
        <button
          className={cn(
            "button-ghost text-xs",
            is1080 && "text-violet-400"
          )}
          onClick={() => setResolution(is1080 ? "720p" : "1080p")}
        >
          <Monitor size={14} />
          {is1080 ? "1080p" : "720p"}
        </button>

        {/* AI Animations */}
        <button
          className="button-ghost text-xs"
          onClick={handleContextualAnimations}
        >
          <Sparkles size={14} />
          AI Animations
        </button>

        {/* Export Button & Menu Dropdown */}
        <div className="relative">
          <div className="inline-flex rounded-lg overflow-hidden border border-violet-500/40">
            <button
              className="button-primary text-xs rounded-r-none border-r border-violet-600/40"
              disabled={isExporting}
              onClick={() => handleExport(selectedProfile)}
            >
              {isExporting ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Rendering ({exportProgress}%)...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Export MP4 ({selectedProfile.toUpperCase()})
                </>
              )}
            </button>

            <button
              className="button-primary px-2 rounded-l-none"
              disabled={isExporting}
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Select export profile"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Export Profiles Dropdown */}
          {showExportMenu && (
            <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md animate-fade-in space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5">
                Export Quality Profile
              </div>

              {EXPORT_PROFILES.map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors",
                    selectedProfile === p.id
                      ? "bg-violet-500/15 border border-violet-500/30 text-white"
                      : "hover:bg-white/5 text-slate-300"
                  )}
                  onClick={() => {
                    setSelectedProfile(p.id);
                    handleExport(p.id);
                  }}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{p.label}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                  </div>
                  {selectedProfile === p.id && <Check size={14} className="text-violet-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
