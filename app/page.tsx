import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { EventCountdown } from "@/components/event-countdown";
import { FeedItemCard, type FeedItem } from "@/components/feed-item-card";
import { PhotoMosaicGroup } from "@/components/photo-mosaic-group";
import { ROLE_LABEL, type Role } from "@/lib/rank";
import { fetchMomentPhotos } from "@/lib/fetch-moment-photos";
import { engagementScore, normalizedEngagement } from "@/lib/engagement";

type AuthorRow = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
};

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  created_at: string;
  pinned: boolean;
  hidden: boolean;
  attendance: "optional" | "mandatory";
  creator: AuthorRow | null;
};

type ThreadRow = {
  id: string;
  body: string;
  created_at: string;
  pinned: boolean;
  hidden: boolean;
  author: AuthorRow | null;
};

type JoinedProfileRow = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  created_at: string;
};

type MembershipEventRow = {
  id: string;
  subject_label: string;
  type: "promoted" | "demoted" | "retitled" | "kicked" | "reinstated";
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  pinned: boolean;
  hidden: boolean;
  actor: AuthorRow | null;
};

const NO_AUTHOR = { display_name: null, email: null, role: null };

function toAuthor(row: AuthorRow | null) {
  return row ? { display_name: row.display_name, email: row.email, role: row.role } : NO_AUTHOR;
}

// This app has no multi-photo-post concept -- every photo is its own
// independent chronological feed entry -- so "mosaic on the Feed" means
// grouping whichever photo items happen to land next to each other in the
// sorted stream (e.g. two uploads posted close together with nothing else
// in between) into one tight PhotoMosaicGroup instead of one Card each. A
// run of length 1 just renders as a single full-width photo, same code
// path, no special-casing.
function groupConsecutivePhotos(items: FeedItem[]): (FeedItem | FeedItem[])[] {
  const groups: (FeedItem | FeedItem[])[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.kind === "photo" && Array.isArray(last)) {
      last.push(item);
    } else if (item.kind === "photo") {
      groups.push([item]);
    } else {
      groups.push(item);
    }
  }
  return groups;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("frat_title, role")
    .eq("id", user.id)
    .single();

  const isAdmin = viewerProfile?.role === "admin";

  const [
    { data: eventRows },
    allPhotos,
    { data: threadRows },
    { data: joinedRows },
    { data: membershipEventRows },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, event_date, created_at, pinned, hidden, attendance, creator:profiles!events_created_by_fkey(id, display_name, email, role)",
      )
      .order("event_date", { ascending: true })
      .returns<EventRow[]>(),
    fetchMomentPhotos(supabase, user.id),
    supabase
      .from("thread_messages")
      .select(
        "id, body, created_at, pinned, hidden, author:profiles!thread_messages_author_id_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ThreadRow[]>(),
    supabase
      .from("profiles")
      .select("id, display_name, email, role, created_at")
      .returns<JoinedProfileRow[]>(),
    supabase
      .from("membership_events")
      .select(
        "id, subject_label, type, from_value, to_value, created_at, pinned, hidden, actor:profiles!membership_events_actor_id_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<MembershipEventRow[]>(),
  ]);

  const events = eventRows ?? [];

  // Server Component: runs once per request, not re-rendered like a client
  // component, so reading the clock here is safe despite the purity lint rule.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  // A hidden event (e.g. test data) shouldn't drive the countdown banner for
  // anyone, admin or not — unlike the isAdmin-aware visibleItems filter below,
  // which still surfaces hidden events as dimmed feed cards for admins.
  const nextEvent =
    events.find((event) => !event.hidden && new Date(event.event_date).getTime() >= now) ?? null;

  const eventItems: FeedItem[] = events.map((event) => ({
    id: event.id,
    kind: "event",
    table: "events",
    createdAt: event.created_at,
    pinned: event.pinned,
    hidden: event.hidden,
    author: toAuthor(event.creator),
    heading: "New Event",
    title: event.title,
    detail:
      new Date(event.event_date).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }) + (event.attendance === "mandatory" ? " · Mandatory" : ""),
    href: "/events",
  }));

  // Same visibility policy as app/moments/page.tsx (filter before tiering,
  // not after) so a hidden photo a non-admin will never see doesn't skew the
  // max score everyone else's tiers are computed against.
  const visiblePhotos = allPhotos.filter((photo) => isAdmin || !photo.hidden);

  // Same engagement data/tiering Moments uses (via the shared fetch +
  // scoring libs), so a photo's size in the Feed matches its size in the
  // gallery — max score is taken across just the photo subset, same as
  // moments-wall.tsx does for its own grid.
  const maxPhotoScore = Math.max(
    0,
    ...visiblePhotos.map((photo) => engagementScore(photo.reactionCounts, photo.comments.length)),
  );

  const photoItems: FeedItem[] = visiblePhotos.map((photo) => ({
    id: photo.id,
    kind: "photo",
    table: "photos",
    createdAt: photo.createdAt,
    pinned: photo.pinned,
    hidden: photo.hidden,
    storagePath: photo.storagePath,
    author: {
      display_name: photo.uploader?.display_name ?? null,
      email: photo.uploader?.email ?? null,
      role: photo.uploader?.role ?? null,
    },
    heading: "New Photo",
    title: photo.caption ?? "Untitled evidence",
    href: "/moments",
    photoData: photo,
    photoEngagement: normalizedEngagement(
      engagementScore(photo.reactionCounts, photo.comments.length),
      maxPhotoScore,
    ),
  }));

  const threadItems: FeedItem[] = (threadRows ?? []).map((message) => ({
    id: message.id,
    kind: "thread",
    table: "thread_messages",
    createdAt: message.created_at,
    pinned: message.pinned,
    hidden: message.hidden,
    author: toAuthor(message.author),
    heading: "New Banter",
    title: message.body,
    href: "/thread",
  }));

  const joinedItems: FeedItem[] = (joinedRows ?? []).map((profile) => ({
    id: profile.id,
    kind: "joined",
    table: null,
    createdAt: profile.created_at,
    pinned: false,
    hidden: false,
    author: toAuthor(profile),
    heading: "New Member",
    title: `${profile.display_name ?? profile.email} pledged. God help them.`,
    href: "/frat-history/roster",
  }));

  function roleLabel(value: string | null) {
    return value ? (ROLE_LABEL[value as Role] ?? value) : "";
  }

  const membershipItems: FeedItem[] = (membershipEventRows ?? []).map((event) => {
    const base = {
      id: event.id,
      table: "membership_events" as const,
      createdAt: event.created_at,
      pinned: event.pinned,
      hidden: event.hidden,
      author: toAuthor(event.actor),
      href: "/frat-history/roster",
    };

    switch (event.type) {
      case "promoted":
        return {
          ...base,
          kind: "promoted",
          heading: "Promotion",
          title: `${event.subject_label} got promoted to ${roleLabel(event.to_value)}. Try not to let it go to their head.`,
        };
      case "demoted":
        return {
          ...base,
          kind: "demoted",
          heading: "Demotion",
          title: `${event.subject_label} got busted down to ${roleLabel(event.to_value)}.`,
        };
      case "retitled":
        return {
          ...base,
          kind: "retitled",
          heading: "New Title",
          title: `${event.subject_label} is now officially "${event.to_value}".`,
        };
      case "kicked":
        return {
          ...base,
          kind: "kicked",
          heading: "Kicked",
          title: `${event.subject_label} got the boot.`,
        };
      case "reinstated":
        return {
          ...base,
          kind: "reinstated",
          heading: "Reinstated",
          title: `${event.subject_label} weaseled their way back in.`,
        };
    }
  });

  const allItems = [
    ...eventItems,
    ...photoItems,
    ...threadItems,
    ...joinedItems,
    ...membershipItems,
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Non-admins never see hidden items; admins see them inline (dimmed, with a
  // Hidden badge and unhide control) so test data or moderated posts can
  // still be found and reversed.
  const visibleItems = isAdmin ? allItems : allItems.filter((item) => !item.hidden);
  const pinnedItems = visibleItems.filter((item) => item.pinned);
  const streamItems = visibleItems.filter((item) => !item.pinned);

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">The Feed</h1>
        <p className="mt-1 text-muted-foreground">
          Everything happening in the chapter, whether you asked or not.
        </p>

        <div className="mt-6">
          <EventCountdown
            nextEvent={nextEvent ? { title: nextEvent.title, eventDate: nextEvent.event_date } : null}
          />
        </div>

        {pinnedItems.length > 0 && (
          <>
            <h2 className="mt-8 text-lg font-semibold tracking-tight">📌 Pinned</h2>
            <div className="mt-4 space-y-4">
              {groupConsecutivePhotos(pinnedItems).map((entry) =>
                Array.isArray(entry) ? (
                  <PhotoMosaicGroup
                    key={`group-${entry[0].id}`}
                    items={entry}
                    viewerId={user.id}
                    isAdmin={isAdmin}
                  />
                ) : (
                  <FeedItemCard key={`${entry.table}-${entry.id}`} item={entry} isAdmin={isAdmin} />
                ),
              )}
            </div>
          </>
        )}

        <h2 className="mt-8 text-lg font-semibold tracking-tight">Activity</h2>
        {streamItems.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Nothing&apos;s happened yet. Riveting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groupConsecutivePhotos(streamItems).map((entry) =>
              Array.isArray(entry) ? (
                <PhotoMosaicGroup
                  key={`group-${entry[0].id}`}
                  items={entry}
                  viewerId={user.id}
                  isAdmin={isAdmin}
                />
              ) : (
                <FeedItemCard key={`${entry.table}-${entry.id}`} item={entry} isAdmin={isAdmin} />
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
