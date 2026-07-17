import Link from "next/link";
import {
  Trophy,
  Swords,
  Quote,
  Image as ImageIcon,
  Music,
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
import { togglePin } from "@/app/actions";

export type FeedKind =
  | "event"
  | "award"
  | "quote"
  | "beef"
  | "photo"
  | "sound"
  | "thread"
  | "joined"
  | "promoted"
  | "demoted"
  | "retitled"
  | "kicked"
  | "reinstated";

export type PinnableTable =
  | "events"
  | "awards"
  | "quotes"
  | "beefs"
  | "photos"
  | "sounds"
  | "thread_messages"
  | "membership_events";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  table: PinnableTable | null;
  createdAt: string;
  pinned: boolean;
  author: {
    display_name: string | null;
    email: string | null;
    role: string | null;
  };
  heading: string;
  title: string;
  detail?: string | null;
  href: string;
  media?: { type: "image" | "audio"; url: string } | null;
};

const KIND_ICON: Record<FeedKind, React.ComponentType<{ className?: string }>> = {
  event: CalendarDays,
  award: Trophy,
  quote: Quote,
  beef: Swords,
  photo: ImageIcon,
  sound: Music,
  thread: MessageCircle,
  joined: UserPlus,
  promoted: ArrowUpCircle,
  demoted: ArrowDownCircle,
  retitled: Tag,
  kicked: UserX,
  reinstated: UserCheck,
};

export function FeedItemCard({ item, isAdmin }: { item: FeedItem; isAdmin: boolean }) {
  const Icon = KIND_ICON[item.kind];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <Link href={item.href} className="flex min-w-0 items-center gap-2 hover:underline">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{item.heading}</span>
          </Link>
          {isAdmin && item.table && (
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
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {item.media?.type === "image" && (
          <Link href={item.href} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.media.url}
              alt={item.title}
              loading="lazy"
              className="aspect-video w-full rounded-lg object-cover"
            />
          </Link>
        )}
        {item.media?.type === "audio" && (
          <audio controls preload="none" className="w-full" src={item.media.url}>
            Your browser doesn&apos;t support audio, which is honestly for the best.
          </audio>
        )}
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
