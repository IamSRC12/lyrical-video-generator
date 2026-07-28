
"use client";

import {useRef, useState} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ImagePlus,
  LoaderCircle,
  Move,
  Palette,
  Sparkles,
  Trash2,
  Type
} from "lucide-react";
import {useEditorStore} from "@/stores/editor-store";
import type {AnimationName} from "@/lib/editor-schema";
import {uploadAsset} from "@/services/asset-client";
import {toast} from "sonner";
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
  const setBackground = useEditorStore((s) => s.setBackground);
  const patchTextStyle = useEditorStore((s) => s.patchTextStyle);
  const setToggle = useEditorStore((s) => s.setToggle);

  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  if (!project) return null;

  const selectedSegment = project.segments.find(
    (s) => s.id === selectedSegmentId
  );

  async function uploadBackground(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image background.");
      return;
    }

    try {
      setUploadingBackground(true);
      const url = await uploadAsset(file);
      setBackground(url);
      toast.success("Background inserted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Background upload failed."
      );
    } finally {
      setUploadingBackground(false);
    }
  }

  return (
    <aside className="editor-sidebar flex flex-col overflow-hidden border-r border-white/5 bg-surface-raised">
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {/* Background Controls */}
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <ImagePlus size={12} />
            Background
          </div>

          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadBackground(file);
              event.currentTarget.value = "";
            }}
          />

          <button
            type="button"
            className="button-secondary w-full text-xs"
            disabled={uploadingBackground}
            onClick={() => backgroundInputRef.current?.click()}
          >
            {uploadingBackground ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <ImagePlus size={14} />
            )}
            Upload background image
          </button>

          {project.backgroundUrl && (
            <div className="space-y-2">
              <img
                src={project.backgroundUrl}
                alt="Background preview"
                className="h-24 w-full rounded-lg object-cover border border-white/10"
              />

              <button
                type="button"
                className="button-ghost w-full text-xs text-red-400"
                onClick={() => setBackground(undefined)}
              >
                <Trash2 size={14} />
                Remove image
              </button>
            </div>
          )}

          <label className="block">
            <span className="label text-xs">Canvas Color</span>
            <input
              type="color"
              value={project.backgroundColor}
              onChange={(event) =>
                useEditorStore.setState((state) =>
                  state.project
                    ? {
                        project: {
                          ...state.project,
                          backgroundColor: event.target.value
                        }
                      }
                    : state
                )
              }
              className="h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
        </div>

        {/* Text Style Controls */}
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Type size={12} />
            Typography
          </div>

          {/* Font Size & Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Size ({project.textStyle.fontSize}px)</label>
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
            </div>
            <div>
              <label className="label text-xs">Weight ({project.textStyle.fontWeight})</label>
              <input
                type="range"
                min={100}
                max={900}
                step={100}
                value={project.textStyle.fontWeight}
                onChange={(e) =>
                  patchTextStyle({fontWeight: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
          </div>

          {/* Line Height & Letter Spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Line Height ({project.textStyle.lineHeight})</label>
              <input
                type="range"
                min={0.8}
                max={2}
                step={0.1}
                value={project.textStyle.lineHeight}
                onChange={(e) =>
                  patchTextStyle({lineHeight: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
            <div>
              <label className="label text-xs">Spacing ({project.textStyle.letterSpacing}px)</label>
              <input
                type="range"
                min={-5}
                max={20}
                step={1}
                value={project.textStyle.letterSpacing}
                onChange={(e) =>
                  patchTextStyle({letterSpacing: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
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

        {/* Position & Box Styling */}
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Move size={12} />
            Position & Box
          </div>

          {/* Position X & Y */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Pos X ({project.textStyle.positionX}%)</label>
              <input
                type="range"
                min={10}
                max={90}
                value={project.textStyle.positionX}
                onChange={(e) =>
                  patchTextStyle({positionX: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
            <div>
              <label className="label text-xs">Pos Y ({project.textStyle.positionY}%)</label>
              <input
                type="range"
                min={10}
                max={90}
                value={project.textStyle.positionY}
                onChange={(e) =>
                  patchTextStyle({positionY: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
          </div>

          {/* Box Background & Opacity */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label text-xs">Box Color</span>
              <input
                type="color"
                value={project.textStyle.backgroundColor}
                onChange={(e) =>
                  patchTextStyle({backgroundColor: e.target.value})
                }
                className="h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </label>
            <div>
              <label className="label text-xs">
                Opacity ({Math.round(project.textStyle.backgroundOpacity * 100)}%)
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={project.textStyle.backgroundOpacity}
                onChange={(e) =>
                  patchTextStyle({backgroundOpacity: Number(e.target.value)})
                }
                className="w-full accent-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3 p-4">
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
              className="flex items-center justify-between text-sm cursor-pointer"
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
        <div className="p-4">
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
      </div>
    </aside>
  );
}


