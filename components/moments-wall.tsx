"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { DeleteFeedItemButton } from "@/components/delete-feed-item-button";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { PhotoComment } from "@/components/photo-comments";
import type { ReactionType } from "@/lib/reactions";
import { REACTION_TYPES, REACTION_META } from "@/lib/reactions";

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

// Grid footprint per tier. "small" shares medium's 1x1 footprint (a finer
// grid to give it its own cell size wasn't worth the complexity) — it reads
// as smaller instead via a scaled-down image within the same cell, below.
const TIER_SPAN: Record<Tier, string> = {
  hero: "col-span-2 row-span-2",
  large: "col-span-2 row-span-1",
  medium: "col-span-1 row-span-1",
  small: "col-span-1 row-span-1",
};

// Staggered entrance delay is capped so a big gallery doesn't turn into a
// multi-second cascade before the last tiles show up.
const MAX_STAGGER_INDEX = 20;
const STAGGER_STEP_MS = 30;

function topReaction(counts: Record<ReactionType, number>) {
  let best: ReactionType | null = null;
  for (const type of REACTION_TYPES) {
    if (counts[type] > 0 && (best === null || counts[type] > counts[best])) {
      best = type;
    }
  }
  return best;
}

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

  if (photos.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground">
        No photos yet. Suspiciously clean record.
      </p>
    );
  }

  const maxScore = Math.max(0, ...photos.map(engagementScore));

  return (
    <>
      <div className="mt-4 grid grid-cols-2 auto-rows-[220px] grid-flow-row-dense gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => {
          const score = engagementScore(photo);
          const tier = tierFor(score, maxScore);
          const totalReactions = REACTION_TYPES.reduce(
            (sum, type) => sum + photo.reactionCounts[type],
            0,
          );
          const best = topReaction(photo.reactionCounts);
          const isOwner = photo.uploadedBy === viewerId;

          return (
            <Card
              key={photo.id}
              style={{ animationDelay: `${Math.min(i, MAX_STAGGER_INDEX) * STAGGER_STEP_MS}ms` }}
              className={cn(
                "flex flex-col overflow-hidden",
                "animate-in fade-in zoom-in-95 duration-300 fill-mode-backwards motion-reduce:animate-none",
                "transition-transform hover:z-10 hover:scale-[1.02] active:scale-[0.97]",
                TIER_SPAN[tier],
                photo.hidden && "opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="relative block min-h-0 flex-1 overflow-hidden"
                aria-label={`View ${photo.caption ?? "photo"} full size`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.publicUrl}
                  alt={photo.caption ?? "Chapter photo"}
                  loading="lazy"
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover",
                    tier === "small" && "scale-[0.82] opacity-90",
                  )}
                />
              </button>
              <CardContent className="shrink-0 space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  {photo.caption && (
                    <p className="line-clamp-1 font-medium">{photo.caption}</p>
                  )}
                  <span className="flex shrink-0 items-center gap-1.5">
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
                  </span>
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {photo.uploader?.display_name ?? photo.uploader?.email ?? "Unknown"} ·{" "}
                  {new Date(photo.createdAt).toLocaleDateString()}
                </p>
                {photo.tags.length > 0 && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    Featuring: {photo.tags.map((tag) => tag.display_name ?? tag.email).join(", ")}
                  </p>
                )}
                {(totalReactions > 0 || photo.comments.length > 0) && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  </p>
                )}
                {isOwner && (
                  <form action={deletePhotoAction}>
                    <input type="hidden" name="photoId" value={photo.id} />
                    <input type="hidden" name="storagePath" value={photo.storagePath} />
                    <Button type="submit" variant="destructive" size="sm">
                      Delete
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
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
