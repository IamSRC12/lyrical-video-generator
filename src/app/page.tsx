"use client";

import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { UploadAndAlign } from "@/components/UploadAndAlign";
import { useEditorStore } from "@/stores/editor-store";

export default function HomePage() {
  const project = useEditorStore((s) => s.project);

  if (project) {
    return <EditorWorkspace />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center">
      <UploadAndAlign />
    </main>
  );
}
