
"use client";

import {useEditorStore} from "@/stores/editor-store";
import {TopBar} from "./TopBar";
import {LeftPanel} from "./LeftPanel";
import {PreviewCanvas} from "./PreviewCanvas";
import {Timeline} from "./Timeline";

export function EditorWorkspace() {
  const project = useEditorStore((s) => s.project);

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="panel-3d p-12 text-center animate-fade-in">
          <h2 className="text-2xl font-bold">No project loaded</h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload audio and lyrics first to create a project.
          </p>
          <a href="/upload" className="button-primary mt-6 inline-block">
            Go to upload
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-grid">
      <TopBar />
      <LeftPanel />
      <PreviewCanvas />
      <Timeline />
    </div>
  );
}


