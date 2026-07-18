"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { REACTION_TYPES, REACTION_META, type ReactionType } from "@/lib/reactions";
import { toggleReaction } from "@/app/moments/social-actions";

export function PhotoReactions({
  photoId,
  initialCounts,
  initialViewerReacted,
}: {
  photoId: string;
  initialCounts: Record<ReactionType, number>;
  initialViewerReacted: ReactionType[];
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [viewerReacted, setViewerReacted] = useState(new Set(initialViewerReacted));
  const [pending, setPending] = useState<ReactionType | null>(null);

  async function handleClick(type: ReactionType) {
    if (pending) return;

    const wasReacted = viewerReacted.has(type);

    // Optimistic flip, reverted on error below.
    setViewerReacted((prev) => {
      const next = new Set(prev);
      if (wasReacted) next.delete(type);
      else next.add(type);
      return next;
    });
    setCounts((prev) => ({ ...prev, [type]: prev[type] + (wasReacted ? -1 : 1) }));
    setPending(type);

    const formData = new FormData();
    formData.set("photoId", photoId);
    formData.set("reactionType", type);
    const result = await toggleReaction(formData);

    setPending(null);

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

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTION_TYPES.map((type) => {
        const meta = REACTION_META[type];
        const active = viewerReacted.has(type);
        return (
          <button
            key={type}
            type="button"
            title={meta.label}
            aria-label={meta.label}
            aria-pressed={active}
            disabled={pending === type}
            onClick={() => handleClick(type)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
              active
                ? "border-foreground/40 bg-foreground/10"
                : "border-input hover:bg-muted/50",
            )}
          >
            <span>{meta.emoji}</span>
            <span className="text-xs text-muted-foreground">{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
