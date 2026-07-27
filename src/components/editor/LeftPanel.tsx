"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Palette,
  Sparkles,
  Type
} from "lucide-react";
import {useEditorStore} from "@/stores/editor-store";
import type {AnimationName} from "@/lib/editor-schema";
import {cn} from "@/lib/cn";

const ANIMATION_OPTIONS: Array<{value: AnimationName; label: string; emoji: string}> = [
  {value: "fade", label: "Fade", emoji: "✨"},
  {value: "slide_up", label: "Slide Up", emoji: "⬆️"},
  {value: "pop", label: "Pop", emoji: "💥"},
  {value: "neon_pulse", label: "Neon Pulse", emoji: "💜"},
  {value: "zoom_blur", label: "Zoom Blur", emoji: "🔍"},
  {value: "rain", label: "Rain", emoji: "🌧️"},
  {value: "shake", label: "Shake", emoji: "📳"}
];

export function LeftPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const selectSegment = useEditorStore((s) => s.selectSegment);
  const setAnimation = useEditorStore((s) => s.setAnimation);
  const patchTextStyle = useEditorStore((s) => s.patchTextStyle);
  const setToggle = useEditorStore((s) => s.setToggle);

  if (!project) return null;

  const selectedSegment = project.segments.find(
    (s) => s.id === selectedSegmentId
  );

  return (
    <aside className="editor-sidebar flex flex-col overflow-hidden border-r border-white/5 bg-surface-raised">
      {/* Text Style Controls */}
      <div className="space-y-4 border-b border-white/5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          <Type size={12} />
          Text Style
        </div>

        {/* Font Size */}
        <div>
          <label className="label text-xs">Font Size</label>
          <input
            type="range"
            min={20}
            max={220}
            step={2}
            value={project.textStyle.fontSize}
            onChange={(e) =>
              patchTextStyle({fontSize: Number(e.target.value)})
            }
            className="w-full accent-violet-500"
          />
          <span className="text-xs text-slate-500">
            {project.textStyle.fontSize}px
          </span>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="label text-xs">Text</span>
            <input
              type="color"
              value={project.textStyle.color}
              onChange={(e) => patchTextStyle({color: e.target.value})}
              className="h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
          <label className="block">
            <span className="label text-xs">Highlight</span>
            <input
              type="color"
              value={project.textStyle.highlightColor}
              onChange={(e) =>
                patchTextStyle({highlightColor: e.target.value})
              }
              className="h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
          <label className="block">
            <span className="label text-xs">Outline</span>
            <input
              type="color"
              value={project.textStyle.outlineColor}
              onChange={(e) =>
                patchTextStyle({outlineColor: e.target.value})
              }
              className="h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
        </div>

        {/* Alignment */}
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              className={cn(
                "button-ghost flex-1",
                project.textStyle.align === align && "bg-white/8 text-violet-400"
              )}
              onClick={() => patchTextStyle({align})}
            >
              {align === "left" && <AlignLeft size={14} />}
              {align === "center" && <AlignCenter size={14} />}
              {align === "right" && <AlignRight size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 border-b border-white/5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          <Sparkles size={12} />
          Features
        </div>

        {(
          [
            ["karaokeHighlight", "Karaoke Highlight"],
            ["beatSync", "Beat Sync"],
            ["contextualAnimations", "AI Animations"]
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between text-sm"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              className="toggle"
              checked={project.toggles[key]}
              onChange={(e) => setToggle(key, e.target.checked)}
            />
          </label>
        ))}
      </div>

      {/* Segment List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
          <Palette size={12} />
          Segments ({project.segments.length})
        </div>

        <div className="space-y-1">
          {project.segments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                "cursor-pointer rounded-lg border border-transparent p-3 text-sm transition-all",
                "hover:border-white/8 hover:bg-white/3",
                selectedSegmentId === segment.id &&
                  "border-violet-500/30 bg-violet-500/8"
              )}
              onClick={() => selectSegment(segment.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex-1 truncate font-medium">
                  {segment.line}
                </span>
                <span className="text-[10px] text-slate-500">
                  {segment.start.toFixed(1)}s
                </span>
              </div>

              {selectedSegmentId === segment.id && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {ANIMATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all",
                        "border border-white/8 hover:border-violet-500/30",
                        segment.animation === opt.value &&
                          "border-violet-500 bg-violet-500/15 text-violet-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnimation(segment.id, opt.value);
                      }}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
