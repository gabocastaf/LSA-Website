"use client";

import { useMemo, useRef, useState } from "react";
import { Heart, Maximize2, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { vibrateLight } from "@/lib/haptics";
import { REACTION_TYPES, REACTION_META, type ReactionType } from "@/lib/reactions";
import { toggleReaction } from "@/app/moments/social-actions";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { DeleteFeedItemButton } from "@/components/delete-feed-item-button";
import { Popover, PopoverPortal, PopoverPositioner, PopoverPopup } from "@/components/ui/popover";
import type { MomentPhoto } from "@/components/moments-wall";

// ---------------------------------------------------------------------------
// Gesture state machine (pointer events only, mouse + touch + pen share one
// code path). Sequence:
//
//   pointerdown -> starts a LONG_PRESS_MS timer and records the origin point.
//
//   pointermove (before long-press fires) -> if the pointer has moved more
//     than MOVE_CANCEL_PX from the origin, the long-press timer is cancelled
//     and the gesture is abandoned (`moved = true`). This is what lets the
//     feed scroll under a finger without a tray popping open mid-scroll.
//
//   pointermove (after long-press has fired, tray open) -> the gesture
//     becomes press-drag-release: we hit-test the pointer position against
//     each tray emoji button's bounding rect and track whichever one it's
//     over. Pointer capture (set on pointerdown) keeps these events routed
//     to this element even though the tray renders in a portal on top of it.
//
//   pointerup:
//     - if the long-press already fired: whatever emoji (if any) the pointer
//       was last over gets selected, the tray closes, and `suppressClick` is
//       set so the browser's synthesized trailing `click` doesn't leak into
//       anything underneath. Tap/double-tap logic is skipped entirely.
//     - else if the pointer moved past the cancel threshold: no-op, this was
//       a scroll/drag, not a tap.
//     - else this is a completed tap. If it lands within DOUBLE_TAP_MS of the
//       previous tap, it's tap #2: the pending single-tap timer (if any) is
//       cancelled so the deferred single-tap action never fires, and the
//       heart reaction toggles instead. Otherwise it's tap #1: a
//       DOUBLE_TAP_MS timer is started, and if no second tap arrives before
//       it fires, the resolved single-tap action runs (open the lightbox for
//       mouse, toggle the metadata overlay for touch/pen).
//
//   pointercancel -> full reset of every timer/flag (fires when the browser
//     takes over the gesture for native scrolling).
//
// This ~300ms delay before a lone tap's action fires (for both the overlay
// reveal and, on mouse, opening the lightbox) is an inherent cost of
// distinguishing "tap" from "the first half of a double-tap" this way, not a
// bug to chase during testing.
// ---------------------------------------------------------------------------

const DOUBLE_TAP_MS = 300;
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

const ASPECT_MIN = 0.5;
const ASPECT_MAX = 2;
const ROW_UNIT_PX = 8;
const GAP_PX = 16;
const ROW_SPAN_MIN = 20;
const ROW_SPAN_MAX = 90;

const FLOAT_DELAY_STEPS = 7;
const FLOAT_DELAY_MS = 150;
const FLOAT_DURATION_BASE_MS = 4000;
const FLOAT_DURATION_STEPS = 5;
const FLOAT_DURATION_STEP_MS = 400;

function computeRowSpan(aspectRatio: number, colSpan: number, colWidth: number) {
  const clampedRatio = Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, aspectRatio));
  const width = colSpan * colWidth + (colSpan - 1) * GAP_PX;
  const height = width / clampedRatio;
  const span = Math.ceil((height + GAP_PX) / (ROW_UNIT_PX + GAP_PX));
  return Math.min(ROW_SPAN_MAX, Math.max(ROW_SPAN_MIN, span));
}

function topReactionType(counts: Record<ReactionType, number>): ReactionType | null {
  let best: ReactionType | null = null;
  for (const type of REACTION_TYPES) {
    if (counts[type] > 0 && (best === null || counts[type] > counts[best])) {
      best = type;
    }
  }
  return best;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MomentBubbleCard({
  photo,
  tier,
  colSpan,
  colWidth,
  index,
  entranceDelayMs,
  isAdmin,
  isOwner,
  deletePhotoAction,
  onExpand,
}: {
  photo: MomentPhoto;
  tier: "hero" | "large" | "medium" | "small";
  colSpan: number;
  colWidth: number;
  index: number;
  entranceDelayMs: number;
  isAdmin: boolean;
  isOwner: boolean;
  deletePhotoAction: (formData: FormData) => void;
  onExpand: () => void;
}) {
  const [aspectRatio, setAspectRatio] = useState(1);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayHitEmoji, setTrayHitEmoji] = useState<ReactionType | null>(null);
  const [burst, setBurst] = useState<{ key: number; muted: boolean } | null>(null);
  const [confirmPop, setConfirmPop] = useState<{ key: number; emoji: string } | null>(null);
  const [counts, setCounts] = useState(photo.reactionCounts);
  const [viewerReacted, setViewerReacted] = useState(new Set(photo.viewerReactedTypes));

  const bubbleRef = useRef<HTMLDivElement>(null);
  const trayButtonRefs = useRef<Partial<Record<ReactionType, HTMLButtonElement | null>>>({});
  const pointerDownXY = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const longPressFired = useRef(false);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const trayHitEmojiRef = useRef<ReactionType | null>(null);

  const rowSpan = useMemo(
    () => (colWidth > 0 ? computeRowSpan(aspectRatio, colSpan, colWidth) : 40),
    [aspectRatio, colSpan, colWidth],
  );

  const totalReactions = REACTION_TYPES.reduce((sum, type) => sum + counts[type], 0);
  const best = topReactionType(counts);
  const hearted = viewerReacted.has("heart");

  const floatDelay = `${(index % FLOAT_DELAY_STEPS) * FLOAT_DELAY_MS}ms`;
  const floatDuration = `${
    FLOAT_DURATION_BASE_MS + (index % FLOAT_DURATION_STEPS) * FLOAT_DURATION_STEP_MS
  }ms`;

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  }

  async function applyReaction(type: ReactionType, wasReacted: boolean) {
    setViewerReacted((prev) => {
      const next = new Set(prev);
      if (wasReacted) next.delete(type);
      else next.add(type);
      return next;
    });
    setCounts((prev) => ({ ...prev, [type]: prev[type] + (wasReacted ? -1 : 1) }));

    const formData = new FormData();
    formData.set("photoId", photo.id);
    formData.set("reactionType", type);
    const result = await toggleReaction(formData);

    if (result.error) {
      setViewerReacted((prev) => {
        const next = new Set(prev);
        if (wasReacted) next.add(type);
        else next.delete(type);
        return next;
      });
      setCounts((prev) => ({ ...prev, [type]: prev[type] + (wasReacted ? 1 : -1) }));
    }
  }

  function handleDoubleTapLike() {
    const wasHearted = viewerReacted.has("heart");
    if (!prefersReducedMotion()) {
      setBurst({ key: Date.now(), muted: wasHearted });
    }
    vibrateLight();
    void applyReaction("heart", wasHearted);
  }

  function handleTraySelect(type: ReactionType) {
    const wasReacted = viewerReacted.has(type);
    if (!prefersReducedMotion()) {
      setConfirmPop({ key: Date.now(), emoji: REACTION_META[type].emoji });
    }
    void applyReaction(type, wasReacted);
  }

  function resolveSingleTap(pointerType: string) {
    if (pointerType === "mouse") {
      onExpand();
    } else {
      setOverlayOpen((prev) => !prev);
    }
  }

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore — pointer capture is a nice-to-have for the tray drag, not required for correctness.
    }

    pointerDownXY.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    longPressFired.current = false;
    trayHitEmojiRef.current = null;
    setTrayHitEmoji(null);

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setPressed(true);
      setTrayOpen(true);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!longPressFired.current) {
      if (pointerDownXY.current) {
        const dx = e.clientX - pointerDownXY.current.x;
        const dy = e.clientY - pointerDownXY.current.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          moved.current = true;
          clearLongPressTimer();
        }
      }
      return;
    }

    let hit: ReactionType | null = null;
    for (const type of REACTION_TYPES) {
      const el = trayButtonRefs.current[type];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        hit = type;
        break;
      }
    }
    trayHitEmojiRef.current = hit;
    setTrayHitEmoji(hit);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released or never captured — nothing to do.
    }
    clearLongPressTimer();

    if (longPressFired.current) {
      const hit = trayHitEmojiRef.current;
      longPressFired.current = false;
      setTrayOpen(false);
      setPressed(false);
      suppressClick.current = true;
      if (hit) handleTraySelect(hit);
      return;
    }

    if (moved.current) {
      moved.current = false;
      return;
    }

    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      if (singleTapTimer.current !== null) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTapTime.current = 0;
      handleDoubleTapLike();
    } else {
      lastTapTime.current = now;
      const pointerType = e.pointerType;
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        resolveSingleTap(pointerType);
      }, DOUBLE_TAP_MS);
    }
  }

  function handlePointerCancel() {
    clearLongPressTimer();
    if (singleTapTimer.current !== null) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }
    longPressFired.current = false;
    moved.current = false;
    trayHitEmojiRef.current = null;
    setTrayHitEmoji(null);
    setTrayOpen(false);
    setPressed(false);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onExpand();
    }
  }

  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        animationDelay: `${entranceDelayMs}ms`,
      }}
      className="animate-in fade-in zoom-in-95 duration-300 fill-mode-backwards motion-reduce:animate-none"
    >
      <div
        className="h-full w-full animate-bubble-float motion-reduce:animate-none"
        style={{
          animationDelay: floatDelay,
          animationDuration: floatDuration,
          animationPlayState: pressed || trayOpen ? "paused" : "running",
        }}
      >
        <div
          ref={bubbleRef}
          role="button"
          tabIndex={0}
          aria-label={`View ${photo.caption ?? "photo"}${photo.hidden ? " (hidden)" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "group relative h-full w-full touch-pan-y select-none overflow-hidden rounded-5xl bg-muted shadow-md [-webkit-touch-callout:none]",
            tier === "small" && "scale-[0.85]",
            photo.hidden && "opacity-60",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.publicUrl}
            alt={photo.caption ?? "Chapter photo"}
            loading="lazy"
            draggable={false}
            onLoad={handleImageLoad}
            className="absolute inset-0 h-full w-full object-contain"
          />

          {burst && (
            <Heart
              key={burst.key}
              onAnimationEnd={() => setBurst(null)}
              className={cn(
                "pointer-events-none absolute inset-0 m-auto size-16 text-white drop-shadow-lg",
                burst.muted
                  ? "animate-heart-burst-muted fill-white/70"
                  : "animate-heart-burst fill-white",
              )}
            />
          )}

          {confirmPop && (
            <span
              key={confirmPop.key}
              onAnimationEnd={() => setConfirmPop(null)}
              className="animate-heart-burst-muted pointer-events-none absolute right-2 top-2 text-2xl drop-shadow"
            >
              {confirmPop.emoji}
            </span>
          )}

          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3 text-xs text-white/90 opacity-0 transition-opacity duration-200",
              "group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
              overlayOpen && "pointer-events-auto opacity-100",
              "[&_button]:text-white/90 [&_button:hover]:bg-white/15 [&_button:hover]:text-white",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              {photo.caption && <p className="line-clamp-1 font-medium text-white">{photo.caption}</p>}
              <span className="flex shrink-0 items-center gap-1">
                {photo.hidden && <HiddenBadge />}
                {isAdmin && (
                  <HideToggleButton
                    table="photos"
                    id={photo.id}
                    hidden={photo.hidden}
                    redirectTo="/moments"
                  />
                )}
                {isAdmin && photo.hidden && (
                  <DeleteFeedItemButton
                    table="photos"
                    id={photo.id}
                    storagePath={photo.storagePath}
                    redirectTo="/moments"
                    itemLabel={photo.caption ?? "this photo"}
                  />
                )}
                <button
                  type="button"
                  aria-label="View full size"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand();
                  }}
                  className="rounded-full p-1.5 transition-colors hover:bg-white/15"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </span>
            </div>
            <p className="line-clamp-1 text-white/70">
              {photo.uploader?.display_name ?? photo.uploader?.email ?? "Unknown"} ·{" "}
              {new Date(photo.createdAt).toLocaleDateString()}
            </p>
            {photo.tags.length > 0 && (
              <p className="line-clamp-1 text-white/70">
                Featuring: {photo.tags.map((tag) => tag.display_name ?? tag.email).join(", ")}
              </p>
            )}
            {(totalReactions > 0 || photo.comments.length > 0) && (
              <p className="flex items-center gap-2 text-white/70">
                {totalReactions > 0 && best && (
                  <span>
                    {REACTION_META[best].emoji} {totalReactions}
                  </span>
                )}
                {photo.comments.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="size-3" /> {photo.comments.length}
                  </span>
                )}
                <Heart className={cn("size-3", hearted && "fill-white text-white")} />
              </p>
            )}
            {isOwner && (
              <form action={deletePhotoAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="storagePath" value={photo.storagePath} />
                <button
                  type="submit"
                  className="mt-1 w-fit rounded-full bg-destructive/90 px-2.5 py-1 text-white transition-colors hover:bg-destructive"
                >
                  Delete
                </button>
              </form>
            )}
          </div>

          <Popover open={trayOpen} onOpenChange={setTrayOpen} modal={false}>
            <PopoverPortal>
              <PopoverPositioner anchor={bubbleRef} side="top" sideOffset={12} collisionPadding={8}>
                <PopoverPopup>
                  {REACTION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      ref={(el) => {
                        trayButtonRefs.current[type] = el;
                      }}
                      aria-label={REACTION_META[type].label}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full text-lg transition-transform",
                        trayHitEmoji === type && "scale-125 bg-foreground/10",
                      )}
                    >
                      {REACTION_META[type].emoji}
                    </button>
                  ))}
                </PopoverPopup>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
        </div>
      </div>
    </div>
  );
}
