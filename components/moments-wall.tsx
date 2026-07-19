"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PhotoBubble } from "@/components/photo-bubble";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { PhotoComment } from "@/components/photo-comments";
import type { ReactionType } from "@/lib/reactions";
import { engagementScore, tierFor, type EngagementTier } from "@/lib/engagement";

type RosterProfile = { id: string; display_name: string | null; email: string; role: string };

export type MomentPhoto = {
  id: string;
  publicUrl: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
  hidden: boolean;
  pinned: boolean;
  uploadedBy: string | null;
  uploader: { display_name: string | null; email: string; role: string | null } | null;
  tags: { id: string; display_name: string | null; email: string }[];
  comments: PhotoComment[];
  reactionCounts: Record<ReactionType, number>;
  viewerReactedTypes: ReactionType[];
};

// Column span per tier — how many grid columns a bubble's footprint claims.
// Row span is not tier-driven: PhotoBubble derives it from the photo's real
// aspect ratio (see computeRowSpan there). "small" shares medium's 1-column
// footprint and instead reads as smaller via a scale transform on the whole
// bubble (applied in PhotoBubble) — a finer column grid just for "small"
// wasn't worth the complexity.
const TIER_COL_SPAN: Record<EngagementTier, number> = {
  hero: 2,
  large: 2,
  medium: 1,
  small: 1,
};

// Staggered entrance delay is capped so a big gallery doesn't turn into a
// multi-second cascade before the last tiles show up.
const MAX_STAGGER_INDEX = 20;
const STAGGER_STEP_MS = 30;

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
    const maxScore = Math.max(
      0,
      ...photos.map((photo) => engagementScore(photo.reactionCounts, photo.comments.length)),
    );
    return photos.map((photo) => {
      const tier = tierFor(
        engagementScore(photo.reactionCounts, photo.comments.length),
        maxScore,
      );
      return { photo, tier, colSpan: TIER_COL_SPAN[tier] };
    });
  }, [photos]);

  // Real per-column pixel width, read off the grid's own computed
  // grid-template-columns rather than duplicating the sm:/lg: breakpoint
  // logic in JS. Feeds PhotoBubble's aspect-ratio-driven row-span calc.
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
          <PhotoBubble
            key={photo.id}
            photo={photo}
            tier={tier}
            sizing={{ mode: "grid", colSpan, colWidth }}
            index={i}
            entranceDelayMs={Math.min(i, MAX_STAGGER_INDEX) * STAGGER_STEP_MS}
            isAdmin={isAdmin}
            isOwner={photo.uploadedBy === viewerId}
            deletePhotoAction={deletePhotoAction}
            redirectTo="/moments"
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
