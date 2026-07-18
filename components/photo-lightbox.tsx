"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhotoReactions } from "@/components/photo-reactions";
import { PhotoComments } from "@/components/photo-comments";
import type { MomentPhoto } from "@/components/moments-wall";

type RosterProfile = { id: string; display_name: string | null; email: string; role: string };

const SWIPE_THRESHOLD_PX = 50;

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  roster,
  viewerId,
  isAdmin,
}: {
  photos: MomentPhoto[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  roster: RosterProfile[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const touchStartX = useRef<number | null>(null);
  const open = index !== null;
  const photo = index !== null ? photos[index] : null;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === "ArrowLeft") {
        onNavigate((index - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight") {
        onNavigate((index + 1) % photos.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, index, photos.length, onNavigate]);

  if (!photo || index === null) {
    return null;
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || index === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta > 0) {
      onNavigate((index - 1 + photos.length) % photos.length);
    } else {
      onNavigate((index + 1) % photos.length);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex-col md:flex-row">
        <DialogTitle className="sr-only">
          {photo.caption ?? "Chapter photo"}
        </DialogTitle>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center bg-black"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.publicUrl}
            alt={photo.caption ?? "Chapter photo"}
            className="max-h-full max-w-full object-contain"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => onNavigate((index - 1 + photos.length) % photos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => onNavigate((index + 1) % photos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t bg-background p-4 md:h-full md:w-80 md:border-t-0 md:border-l">
          {photo.caption && <p className="font-medium">{photo.caption}</p>}
          <p className="text-xs text-muted-foreground">
            {photo.uploader?.display_name ?? photo.uploader?.email ?? "Unknown"} ·{" "}
            {new Date(photo.createdAt).toLocaleDateString()}
          </p>
          {photo.tags.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Featuring: {photo.tags.map((tag) => tag.display_name ?? tag.email).join(", ")}
            </p>
          )}

          <PhotoReactions
            photoId={photo.id}
            initialCounts={photo.reactionCounts}
            initialViewerReacted={photo.viewerReactedTypes}
          />

          <PhotoComments
            photoId={photo.id}
            initialComments={photo.comments}
            roster={roster}
            viewerId={viewerId}
            isAdmin={isAdmin}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
