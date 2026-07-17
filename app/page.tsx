import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { EventCountdown } from "@/components/event-countdown";
import { FeedItemCard, type FeedItem } from "@/components/feed-item-card";

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
  creator: AuthorRow | null;
};

type AwardRow = {
  id: string;
  title: string;
  reason: string | null;
  created_at: string;
  pinned: boolean;
  recipient: AuthorRow | null;
  giver: AuthorRow | null;
};

type QuoteRow = {
  id: string;
  quote_text: string;
  created_at: string;
  pinned: boolean;
  attributed: AuthorRow | null;
  submitter: AuthorRow | null;
};

type BeefRow = {
  id: string;
  title: string;
  target: string | null;
  created_at: string;
  pinned: boolean;
  creator: AuthorRow | null;
};

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  pinned: boolean;
  uploader: AuthorRow | null;
};

type SoundRow = {
  id: string;
  storage_path: string;
  title: string;
  created_at: string;
  pinned: boolean;
  uploader: AuthorRow | null;
};

type ThreadRow = {
  id: string;
  body: string;
  created_at: string;
  pinned: boolean;
  author: AuthorRow | null;
};

const NO_AUTHOR = { display_name: null, email: null, role: null };

function toAuthor(row: AuthorRow | null) {
  return row ? { display_name: row.display_name, email: row.email, role: row.role } : NO_AUTHOR;
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
    { data: awardRows },
    { data: quoteRows },
    { data: beefRows },
    { data: photoRows },
    { data: soundRows },
    { data: threadRows },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, event_date, created_at, pinned, creator:profiles!events_created_by_fkey(id, display_name, email, role)",
      )
      .order("event_date", { ascending: true })
      .returns<EventRow[]>(),
    supabase
      .from("awards")
      .select(
        "id, title, reason, created_at, pinned, recipient:profiles!awards_recipient_id_fkey(id, display_name, email, role), giver:profiles!awards_given_by_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<AwardRow[]>(),
    supabase
      .from("quotes")
      .select(
        "id, quote_text, created_at, pinned, attributed:profiles!quotes_attributed_to_fkey(id, display_name, email, role), submitter:profiles!quotes_submitted_by_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<QuoteRow[]>(),
    supabase
      .from("beefs")
      .select(
        "id, title, target, created_at, pinned, creator:profiles!beefs_created_by_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<BeefRow[]>(),
    supabase
      .from("photos")
      .select(
        "id, storage_path, caption, created_at, pinned, uploader:profiles!photos_uploaded_by_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<PhotoRow[]>(),
    supabase
      .from("sounds")
      .select(
        "id, storage_path, title, created_at, pinned, uploader:profiles!sounds_uploaded_by_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .returns<SoundRow[]>(),
    supabase
      .from("thread_messages")
      .select(
        "id, body, created_at, pinned, author:profiles!thread_messages_author_id_fkey(id, display_name, email, role)",
      )
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ThreadRow[]>(),
  ]);

  const events = eventRows ?? [];

  // Server Component: runs once per request, not re-rendered like a client
  // component, so reading the clock here is safe despite the purity lint rule.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const nextEvent = events.find((event) => new Date(event.event_date).getTime() >= now) ?? null;

  const eventItems: FeedItem[] = events.map((event) => ({
    id: event.id,
    kind: "event",
    table: "events",
    createdAt: event.created_at,
    pinned: event.pinned,
    author: toAuthor(event.creator),
    heading: "New Event",
    title: event.title,
    detail: new Date(event.event_date).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    href: "/events",
  }));

  const awardItems: FeedItem[] = (awardRows ?? []).map((award) => ({
    id: award.id,
    kind: "award",
    table: "awards",
    createdAt: award.created_at,
    pinned: award.pinned,
    author: toAuthor(award.giver),
    heading: "New Trophy",
    title: `${award.title} — ${award.recipient?.display_name ?? award.recipient?.email ?? "Unknown"}`,
    detail: award.reason,
    href: "/frat-history/trophy-room",
  }));

  const quoteItems: FeedItem[] = (quoteRows ?? []).map((quote) => ({
    id: quote.id,
    kind: "quote",
    table: "quotes",
    createdAt: quote.created_at,
    pinned: quote.pinned,
    author: toAuthor(quote.submitter),
    heading: "New Quote",
    title: `“${quote.quote_text}”`,
    detail: `— ${quote.attributed?.display_name ?? quote.attributed?.email ?? "Unknown"}`,
    href: "/frat-history/kangaroo-court",
  }));

  const beefItems: FeedItem[] = (beefRows ?? []).map((beef) => ({
    id: beef.id,
    kind: "beef",
    table: "beefs",
    createdAt: beef.created_at,
    pinned: beef.pinned,
    author: toAuthor(beef.creator),
    heading: "New Beef",
    title: beef.title,
    detail: beef.target ? `With: ${beef.target}` : null,
    href: "/frat-history/beef-tracker",
  }));

  const photoItems: FeedItem[] = (photoRows ?? []).map((photo) => {
    const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(photo.storage_path);
    return {
      id: photo.id,
      kind: "photo",
      table: "photos",
      createdAt: photo.created_at,
      pinned: photo.pinned,
      author: toAuthor(photo.uploader),
      heading: "New Photo",
      title: photo.caption ?? "Untitled evidence",
      href: "/frat-history/photo-gallery",
      media: { type: "image", url: publicUrlData.publicUrl },
    };
  });

  const soundItems: FeedItem[] = (soundRows ?? []).map((sound) => {
    const { data: publicUrlData } = supabase.storage.from("sounds").getPublicUrl(sound.storage_path);
    return {
      id: sound.id,
      kind: "sound",
      table: "sounds",
      createdAt: sound.created_at,
      pinned: sound.pinned,
      author: toAuthor(sound.uploader),
      heading: "New Sound",
      title: sound.title,
      href: "/frat-history/soundboard",
      media: { type: "audio", url: publicUrlData.publicUrl },
    };
  });

  const threadItems: FeedItem[] = (threadRows ?? []).map((message) => ({
    id: message.id,
    kind: "thread",
    table: "thread_messages",
    createdAt: message.created_at,
    pinned: message.pinned,
    author: toAuthor(message.author),
    heading: "New Banter",
    title: message.body,
    href: "/thread",
  }));

  const allItems = [
    ...eventItems,
    ...awardItems,
    ...quoteItems,
    ...beefItems,
    ...photoItems,
    ...soundItems,
    ...threadItems,
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pinnedItems = allItems.filter((item) => item.pinned);
  const streamItems = allItems.filter((item) => !item.pinned);

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
              {pinnedItems.map((item) => (
                <FeedItemCard key={`${item.table}-${item.id}`} item={item} isAdmin={isAdmin} />
              ))}
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
            {streamItems.map((item) => (
              <FeedItemCard key={`${item.table}-${item.id}`} item={item} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
