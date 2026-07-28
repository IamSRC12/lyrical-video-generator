
"use client";

import {
  Download,
  Film,
  LoaderCircle,
  Monitor,
  Sparkles
} from "lucide-react";
import {toast} from "sonner";
import {useEditorStore} from "@/stores/editor-store";
import {apiKeyStorage} from "@/services/api-keys";
import {cn} from "@/lib/cn";

export function TopBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const exportProgress = useEditorStore((s) => s.exportProgress);
  const setResolution = useEditorStore((s) => s.setResolution);
  const setExportState = useEditorStore((s) => s.setExportState);
  const setToggle = useEditorStore((s) => s.setToggle);
  const setSegments = useEditorStore((s) => s.setSegments);

  if (!project) return null;

  const is1080 = project.width === 1920;

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

  async function handleExport(profile = selectedProfile) {
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

      <div className="flex items-center gap-2">
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

        {/* Export */}
        <button
          className="button-primary text-xs"
          disabled={isExporting}
          onClick={handleExport}
        >
          {isExporting ? (
            <>
              <LoaderCircle size={14} className="animate-spin" />
              {Math.round(exportProgress)}%
            </>
          ) : (
            <>
              <Download size={14} />
              Export MP4
            </>
          )}
        </button>
      </div>
    </header>
  );
}


