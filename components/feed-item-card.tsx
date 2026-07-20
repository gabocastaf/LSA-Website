import Link from "next/link";
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RankName } from "@/components/rank-name";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { DeleteFeedItemButton } from "@/components/delete-feed-item-button";
import type { MomentPhoto } from "@/components/moments-wall";
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
  // Only set for kind "photo". Consecutive photo items are grouped and
  // rendered by components/photo-mosaic-group.tsx instead of this
  // component -- see app/page.tsx's groupConsecutivePhotos. photoEngagement
  // is continuous (0..1, normalized against the max score across all visible
  // photos), computed once in app/page.tsx so every grouped photo's size is
  // consistent with its actual standing across the whole Feed, not just
  // within its own small cluster.
  photoData?: MomentPhoto;
  photoEngagement?: number;
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

// Renders every FeedKind except "photo" -- consecutive photo items are
// grouped and rendered by PhotoMosaicGroup instead (see app/page.tsx).
export function FeedItemCard({ item, isAdmin }: { item: FeedItem; isAdmin: boolean }) {
  const Icon = KIND_ICON[item.kind];

  return (
    <Card className={item.hidden ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <Link href={item.href} className="flex min-w-0 items-center gap-2 hover:underline">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{item.heading}</span>
          </Link>
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
      <CardContent className="space-y-1.5 text-sm">
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
      </CardContent>
    </Card>
  );
}
