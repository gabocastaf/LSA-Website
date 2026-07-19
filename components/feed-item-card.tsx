"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  CalendarDays,
  MessageCircle,
  Pin,
  PinOff,
  UserPlus,
  ArrowUpCircle,
  ArrowDownCircle,
  Tag,
  UserX,
  UserCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RankName } from "@/components/rank-name";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { DeleteFeedItemButton } from "@/components/delete-feed-item-button";
import { PhotoBubble } from "@/components/photo-bubble";
import type { MomentPhoto } from "@/components/moments-wall";
import type { EngagementTier } from "@/lib/engagement";
import { togglePin } from "@/app/actions";

export type FeedKind =
  | "event"
  | "photo"
  | "thread"
  | "joined"
  | "promoted"
  | "demoted"
  | "retitled"
  | "kicked"
  | "reinstated";

export type PinnableTable =
  | "events"
  | "photos"
  | "thread_messages"
  | "membership_events";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  table: PinnableTable | null;
  createdAt: string;
  pinned: boolean;
  hidden: boolean;
  storagePath?: string | null;
  author: {
    display_name: string | null;
    email: string | null;
    role: string | null;
  };
  heading: string;
  title: string;
  detail?: string | null;
  href: string;
  // Only set for kind "photo" — the full Moments-shaped payload, so photo
  // items get the same real-aspect-ratio, engagement-sized bubble treatment
  // here as on the Moments gallery instead of the old cropped thumbnail.
  photoData?: MomentPhoto;
  photoTier?: EngagementTier;
};

const KIND_ICON: Record<FeedKind, React.ComponentType<{ className?: string }>> = {
  event: CalendarDays,
  photo: ImageIcon,
  thread: MessageCircle,
  joined: UserPlus,
  promoted: ArrowUpCircle,
  demoted: ArrowDownCircle,
  retitled: Tag,
  kicked: UserX,
  reinstated: UserCheck,
};

// Flow-mode sizing for photo bubbles embedded in the single-column Feed
// (distinct from Moments' grid colSpan/rowSpan units — this is a different
// layout mechanism entirely). Deliberately a tighter spread than Moments'
// own tiers: the Feed is a quick-scroll chronological list, not the mosaic
// gallery, so a hero photo should still visibly pop without derailing scroll
// cadence the way an 480px-vs-120px swing next to text cards would. Smaller
// tiers also get a narrower width cap so tier differences still read for
// landscape photos, where height alone often doesn't bind before hero/large
// converge.
const FEED_TIER_SIZE: Record<EngagementTier, { maxHeightPx: number; maxWidthPercent: number }> = {
  hero: { maxHeightPx: 380, maxWidthPercent: 100 },
  large: { maxHeightPx: 330, maxWidthPercent: 100 },
  medium: { maxHeightPx: 280, maxWidthPercent: 90 },
  small: { maxHeightPx: 240, maxWidthPercent: 75 },
};

export function FeedItemCard({ item, isAdmin }: { item: FeedItem; isAdmin: boolean }) {
  const Icon = KIND_ICON[item.kind];
  const router = useRouter();
  const isPhoto = item.kind === "photo" && item.photoData;

  // A photo bubble is self-evidently a photo, and its own hover/tap overlay
  // already carries the uploader + date — repeating a "New Photo" heading
  // above it and a name/date line below it (both needed for every other
  // item kind, which has no image to speak for itself) would just be the
  // same information three times. For non-admins there's nothing left in
  // the header once the heading is dropped, so it's skipped entirely rather
  // than rendering an empty bar; admins still get it for the moderation
  // controls.
  const showHeader = !isPhoto || isAdmin;

  return (
    <Card className={item.hidden ? "opacity-60" : undefined}>
      {showHeader && (
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isPhoto ? "justify-end" : "justify-between")}>
            {!isPhoto && (
              <Link href={item.href} className="flex min-w-0 items-center gap-2 hover:underline">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.heading}</span>
              </Link>
            )}
            {isAdmin && item.table && (
              <span className="flex shrink-0 items-center gap-1">
                {item.hidden && <HiddenBadge />}
                <HideToggleButton table={item.table} id={item.id} hidden={item.hidden} redirectTo="/" />
                {item.hidden && (
                  <DeleteFeedItemButton
                    table={item.table}
                    id={item.id}
                    storagePath={item.storagePath}
                    redirectTo="/"
                    itemLabel={item.title}
                  />
                )}
                <form action={togglePin}>
                  <input type="hidden" name="table" value={item.table} />
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="pinned" value={(!item.pinned).toString()} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={item.pinned ? "Unpin" : "Pin to top"}
                  >
                    {item.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </Button>
                </form>
              </span>
            )}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-1.5 text-sm">
        {isPhoto && item.photoData ? (
          // isAdmin/isOwner are deliberately left at their defaults (false)
          // here: the CardHeader above already renders this item's real
          // admin hide/delete controls, so PhotoBubble's own internal
          // admin/owner rows would just duplicate them.
          <PhotoBubble
            photo={item.photoData}
            tier={item.photoTier ?? "medium"}
            sizing={{ mode: "flow", ...FEED_TIER_SIZE[item.photoTier ?? "medium"] }}
            index={0}
            entranceDelayMs={0}
            onExpand={() => router.push("/moments")}
          />
        ) : (
          <>
            <Link href={item.href} className="block">
              <p className="font-medium">{item.title}</p>
              {item.detail && <p className="text-muted-foreground">{item.detail}</p>}
            </Link>
            <p className="text-xs text-muted-foreground">
              <RankName profile={item.author} /> ·{" "}
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
