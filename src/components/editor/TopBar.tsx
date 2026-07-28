"use client";

import {useState} from "react";
import {
  Check,
  ChevronDown,
  Download,
  Film,
  LoaderCircle,
  Monitor,
  Sparkles,
  Zap
} from "lucide-react";
import {toast} from "sonner";
import {useEditorStore} from "@/stores/editor-store";
import {apiKeyStorage} from "@/services/api-keys";
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

  const [selectedProfile, setSelectedProfile] = useState<ExportProfile>("standard");
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (!project) return null;

  const is1080 = project.width === 1920;

  async function handleContextualAnimations() {
    if (!project) return;

    const credentials = await apiKeyStorage.get();
    if (!credentials || (!credentials.groq && !credentials.opencode && !credentials.nvidia)) {
      toast.error("API keys not found. Please setup API keys on the home page settings.");
      return;
    }

    toast.info("Generating contextual animations...");

    try {
      const response = await fetch("/api/opencode/animations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-key": credentials.groq || "",
          "x-opencode-key": credentials.opencode || "",
          "x-nvidia-key": credentials.nvidia || ""
        },
        body: JSON.stringify({
          provider: credentials.provider || "groq",
          model: credentials.provider === "nvidia" ? credentials.nvidiaModel : credentials.opencodeModel,
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
        throw new Error(err.message);
      }

      const result = await response.json();
      setExportState(false, 100);
      toast.success(
        `Rendered successfully in ${(result.durationMs / 1000).toFixed(1)}s`
      );

      // Programmatic anchor download
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.download = result.outputFilename ?? "lyrical-video.mp4";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setExportState(false, 0);
      toast.error(
        error instanceof Error ? error.message : "Export failed."
      );
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

      <div className="flex items-center gap-2 relative">
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
                  Rendering...
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
