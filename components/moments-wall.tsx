"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MomentBubbleCard } from "@/components/moment-bubble-card";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { PhotoComment } from "@/components/photo-comments";
import type { ReactionType } from "@/lib/reactions";
import { REACTION_TYPES } from "@/lib/reactions";

type RosterProfile = { id: string; display_name: string | null; email: string; role: string };

export type MomentPhoto = {
  id: string;
  publicUrl: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
  hidden: boolean;
  uploadedBy: string | null;
  uploader: { display_name: string | null; email: string } | null;
  tags: { id: string; display_name: string | null; email: string }[];
  comments: PhotoComment[];
  reactionCounts: Record<ReactionType, number>;
  viewerReactedTypes: ReactionType[];
};

type Tier = "hero" | "large" | "medium" | "small";

// Column span per tier — how many grid columns a bubble's footprint claims.
// Row span is no longer tier-driven: MomentBubbleCard derives it from the
// photo's real aspect ratio (see computeRowSpan there). "small" shares
// medium's 1-column footprint and instead reads as smaller via a scale
// transform on the whole bubble (applied in MomentBubbleCard) — a finer
// column grid just for "small" wasn't worth the complexity.
const TIER_COL_SPAN: Record<Tier, number> = {
  hero: 2,
  large: 2,
  medium: 1,
  small: 1,
};

// Staggered entrance delay is capped so a big gallery doesn't turn into a
// multi-second cascade before the last tiles show up.
const MAX_STAGGER_INDEX = 20;
const STAGGER_STEP_MS = 30;

function engagementScore(photo: MomentPhoto) {
  const reactions = REACTION_TYPES.reduce((sum, type) => sum + photo.reactionCounts[type], 0);
  return reactions + photo.comments.length;
}

// Ratio-relative-to-max means one standout photo pops even in a mostly-zero-
// engagement gallery (the common case early on) without needing a stats
// library. maxScore === 0 (nobody's reacted to anything yet) falls back to a
// uniform "medium" so the wall doesn't look broken before it has any data.
function tierFor(score: number, maxScore: number): Tier {
  if (maxScore === 0) return "medium";
  const ratio = score / maxScore;
  if (ratio >= 0.75) return "hero";
  if (ratio >= 0.4) return "large";
  if (ratio >= 0.15) return "medium";
  return "small";
}

export function MomentsWall({
  photos,
  roster,
  viewerId,
  isAdmin,
  deletePhotoAction,
}: {
  photos: MomentPhoto[];
  roster: RosterProfile[];
  viewerId: string;
  isAdmin: boolean;
  deletePhotoAction: (formData: FormData) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(0);

  // Tiering is memoized off the `photos` prop alone — which only changes on
  // a server-revalidated re-render — so a card's own optimistic like/reaction
  // state never feeds back into it. Otherwise liking a bubble mid-tap could
  // resize and reflow the whole grid underneath the gesture that triggered it.
  const tieredPhotos = useMemo(() => {
    const maxScore = Math.max(0, ...photos.map(engagementScore));
    return photos.map((photo) => {
      const tier = tierFor(engagementScore(photo), maxScore);
      return { photo, tier, colSpan: TIER_COL_SPAN[tier] };
    });
  }, [photos]);

  // Real per-column pixel width, read off the grid's own computed
  // grid-template-columns rather than duplicating the sm:/lg: breakpoint
  // logic in JS. Feeds MomentBubbleCard's aspect-ratio-driven row-span calc.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    function measure() {
      const columns = getComputedStyle(el as HTMLDivElement)
        .gridTemplateColumns.split(" ")
        .filter(Boolean);
      if (columns.length > 0) {
        setColWidth(parseFloat(columns[0]));
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (photos.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground">
        No photos yet. Suspiciously clean record.
      </p>
    );
  }

  return (
    <>
      <div
        ref={gridRef}
        className="mt-4 grid grid-cols-2 auto-rows-[8px] grid-flow-row-dense gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {tieredPhotos.map(({ photo, tier, colSpan }, i) => (
          <MomentBubbleCard
            key={photo.id}
            photo={photo}
            tier={tier}
            colSpan={colSpan}
            colWidth={colWidth}
            index={i}
            entranceDelayMs={Math.min(i, MAX_STAGGER_INDEX) * STAGGER_STEP_MS}
            isAdmin={isAdmin}
            isOwner={photo.uploadedBy === viewerId}
            deletePhotoAction={deletePhotoAction}
            onExpand={() => setOpenIndex(i)}
          />
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
        roster={roster}
        viewerId={viewerId}
        isAdmin={isAdmin}
      />
    </>
  );
}
