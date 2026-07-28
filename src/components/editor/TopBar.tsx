"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Download, Film } from "lucide-react";

export function TopBar() {
  const project = useEditorStore((s) => s.project);
  if (!project) return null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 text-white">
      <div className="flex items-center gap-3">
        <Film size={18} className="text-yellow-400" />
        <span className="text-sm font-bold tracking-tight">{project.title}</span>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{project.fps} FPS</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 rounded-lg bg-yellow-500 px-3 py-1 text-xs font-bold text-zinc-950">
          <Download size={14} />
          Export MP4
        </button>
      </div>
    </header>
  );
}
