"use client";

import { useMemo, useState } from "react";

import { PhotoBubble } from "@/components/photo-bubble";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { PhotoComment } from "@/components/photo-comments";
import type { ReactionType } from "@/lib/reactions";
import { engagementScore, normalizedEngagement } from "@/lib/engagement";
import { layoutSkyline, photoAspect } from "@/lib/mosaic-layout";
import { useMeasuredWidth } from "@/lib/use-measured-width";

type RosterProfile = { id: string; display_name: string | null; email: string; role: string };

export type MomentPhoto = {
  id: string;
  publicUrl: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
  hidden: boolean;
  pinned: boolean;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  uploader: { display_name: string | null; email: string; role: string | null } | null;
  tags: { id: string; display_name: string | null; email: string }[];
  comments: PhotoComment[];
  reactionCounts: Record<ReactionType, number>;
  viewerReactedTypes: ReactionType[];
};

// Staggered entrance delay is capped so a big gallery doesn't turn into a
// multi-second cascade before the last tiles show up.
const MAX_STAGGER_INDEX = 20;
const STAGGER_STEP_MS = 30;

const GAP_PX = 4;

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
  const { ref: containerRef, width } = useMeasuredWidth<HTMLDivElement>();

  // Layout inputs are memoized off `photos` + `width` alone -- never off a
  // PhotoBubble's own local optimistic reaction state -- so liking a bubble
  // mid-tap can't reflow the whole mosaic underneath the gesture that
  // triggered it.
  const { positions, height } = useMemo(() => {
    if (width === 0 || photos.length === 0) return { positions: [], height: 0 };

    const maxScore = Math.max(
      0,
      ...photos.map((photo) => engagementScore(photo.reactionCounts, photo.comments.length)),
    );
    const items = photos.map((photo) => ({
      id: photo.id,
      aspect: photoAspect(photo.width, photo.height),
      engagement: normalizedEngagement(
        engagementScore(photo.reactionCounts, photo.comments.length),
        maxScore,
      ),
    }));

    const baseArea = ((width * 220) / items.length) * 1.15;
    return layoutSkyline(items, width, GAP_PX, baseArea);
  }, [photos, width]);

  if (photos.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground">
        No photos yet. Suspiciously clean record.
      </p>
    );
  }

  return (
    <>
      <div ref={containerRef} className="relative mt-4" style={{ height }}>
        {photos.map((photo, i) => {
          const pos = positions[i];
          if (!pos) return null;
          return (
            <PhotoBubble
              key={photo.id}
              photo={photo}
              geometry={{ x: pos.x, y: pos.y, w: pos.w, h: pos.h }}
              entranceDelayMs={Math.min(i, MAX_STAGGER_INDEX) * STAGGER_STEP_MS}
              isAdmin={isAdmin}
              isOwner={photo.uploadedBy === viewerId}
              deletePhotoAction={deletePhotoAction}
              redirectTo="/moments"
              onExpand={() => setOpenIndex(i)}
            />
          );
        })}
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
