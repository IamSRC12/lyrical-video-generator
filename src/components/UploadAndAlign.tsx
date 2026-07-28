"use client";

import {useCallback, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {
  CloudUpload,
  FileAudio,
  LoaderCircle,
  Music2,
  Sparkles
} from "lucide-react";
import {toast} from "sonner";
import {apiKeyStorage} from "@/services/api-keys";
import {uploadAsset} from "@/services/asset-client";
import {detectBeats} from "@/lib/beat-detection";
import {soundManager} from "@/services/sound-manager";
import {useEditorStore, createProject} from "@/stores/editor-store";
import {cn} from "@/lib/cn";

type Stage = "idle" | "uploading" | "transcribing" | "analyzing" | "done";

export function UploadAndAlign() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const loadProject = useEditorStore((s) => s.loadProject);

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

  async function process() {
    if (!audioFile || !lyrics.trim()) {
      toast.error("Audio file and lyrics are both required.");
      return;
    }

    const credentials = await apiKeyStorage.get();
    if (!credentials) {
      toast.error("API keys not found. Please complete onboarding first.");
      router.push("/onboarding");
      return;
    }

    try {
      // Step 1: Upload audio asset
      setStage("uploading");
      setProgress(15);
      const audioUrl = await uploadAsset(audioFile);
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
      </div>

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
                MP3, WAV, FLAC, OGG, WebM — up to 100 MB
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
