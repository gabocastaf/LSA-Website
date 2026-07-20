"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { PhotoBubble } from "@/components/photo-bubble";
import { layoutJustifiedRows, photoAspect } from "@/lib/mosaic-layout";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { deletePhoto } from "@/app/moments/actions";
import type { FeedItem } from "@/components/feed-item-card";
import type { MomentPhoto } from "@/components/moments-wall";

const GAP_PX = 4;
const TARGET_ROW_HEIGHT = 200;

// Renders a run of consecutive "photo" FeedItems from the home Feed's
// chronological stream as one tight, unboxed mosaic block instead of one
// Card per photo -- see app/page.tsx's groupConsecutivePhotos. A run of
// length 1 degrades trivially to a single full-width row at the photo's
// native aspect ratio, no special-casing needed (same justified-rows
// algorithm either way).
export function PhotoMosaicGroup({
  items,
  viewerId,
  isAdmin,
}: {
  items: FeedItem[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { ref: containerRef, width } = useMeasuredWidth<HTMLDivElement>();

  // Filtering `items` down to photo entries and reading `.photoData` off
  // that same filtered array (rather than filtering photos and items
  // separately) keeps the two arrays aligned by construction -- no risk of
  // an index-based zip desyncing if some item unexpectedly lacks photoData.
  const photoItems = useMemo(
    () => items.filter((item): item is FeedItem & { photoData: MomentPhoto } => !!item.photoData),
    [items],
  );

  const { positions, height } = useMemo(() => {
    if (width === 0 || photoItems.length === 0) return { positions: [], height: 0 };
    const mosaicItems = photoItems.map((item) => ({
      id: item.photoData.id,
      aspect: photoAspect(item.photoData.width, item.photoData.height),
      engagement: item.photoEngagement ?? 0,
    }));
    return layoutJustifiedRows(mosaicItems, width, TARGET_ROW_HEIGHT, GAP_PX);
  }, [photoItems, width]);

  if (photoItems.length === 0) return null;

  return (
    <div ref={containerRef} className="relative" style={{ height }}>
      {photoItems.map(({ photoData: photo }, i) => {
        const pos = positions[i];
        if (!pos) return null;
        return (
          <PhotoBubble
            key={photo.id}
            photo={photo}
            geometry={{ x: pos.x, y: pos.y, w: pos.w, h: pos.h }}
            entranceDelayMs={0}
            isAdmin={isAdmin}
            isOwner={photo.uploadedBy === viewerId}
            deletePhotoAction={deletePhoto}
            redirectTo="/"
            onExpand={() => router.push("/moments")}
          />
        );
      })}
    </div>
  );
}
