import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createEvent, setRsvp } from "./actions";

type RsvpStatus = "going" | "maybe" | "not_going";

const STATUS_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "I'm There" },
  { value: "maybe", label: "Maybe (No Promises)" },
  { value: "not_going", label: "Hard Pass" },
];

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  description: string | null;
  created_by: string | null;
  creator: { id: string; display_name: string | null; email: string } | null;
};

type RsvpRow = {
  event_id: string;
  status: RsvpStatus;
  profile_id: string;
  profile: { id: string; display_name: string | null; email: string } | null;
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

  const { data: eventRows } = await supabase
    .from("events")
    .select(
      "id, title, event_date, location, description, created_by, creator:profiles!events_created_by_fkey(id, display_name, email)",
    )
    .order("event_date", { ascending: true })
    .returns<EventRow[]>();

  const { data: rsvpRows } = await supabase
    .from("event_rsvps")
    .select(
      "event_id, status, profile_id, profile:profiles!event_rsvps_profile_id_fkey(id, display_name, email)",
    )
    .returns<RsvpRow[]>();

  const events = eventRows ?? [];
  const rsvps = rsvpRows ?? [];
  const rsvpsByEvent = new Map<string, RsvpRow[]>();
  for (const rsvp of rsvps) {
    const bucket = rsvpsByEvent.get(rsvp.event_id) ?? [];
    bucket.push(rsvp);
    rsvpsByEvent.set(rsvp.event_id, bucket);
  }

  // Server Component: runs once per request, not re-rendered like a client
  // component, so reading the clock here is safe despite the purity lint rule.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcomingEvents = events.filter((event) => new Date(event.event_date).getTime() >= now);
  const pastEvents = events
    .filter((event) => new Date(event.event_date).getTime() < now)
    .reverse();

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="mt-1 text-muted-foreground">
          Mandatory fun, allegedly voluntary attendance.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Throw an Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createEvent} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">What are we calling this</Label>
                <Input id="title" name="title" placeholder="e.g. Formal (Business Casual Enforced)" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eventDate">When</Label>
                <Input id="eventDate" name="eventDate" type="datetime-local" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Where (optional)</Label>
                <Input id="location" name="location" placeholder="e.g. The House, obviously" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Details (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Dress code, cover charge, whatever excuse we're using this time"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Put It On the Calendar
              </Button>
            </form>
          </CardContent>
        </Card>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Upcoming</h2>
        {upcomingEvents.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Nothing on the calendar. The house is suspiciously quiet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                rsvps={rsvpsByEvent.get(event.id) ?? []}
                viewerId={user.id}
                isPast={false}
              />
            ))}
          </div>
        )}

        {pastEvents.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-semibold tracking-tight">History</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {pastEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  rsvps={rsvpsByEvent.get(event.id) ?? []}
                  viewerId={user.id}
                  isPast={true}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EventCard({
  event,
  rsvps,
  viewerId,
  isPast,
}: {
  event: EventRow;
  rsvps: RsvpRow[];
  viewerId: string;
  isPast: boolean;
}) {
  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === "going");
  const maybeCount = rsvps.filter((rsvp) => rsvp.status === "maybe").length;
  const notGoingCount = rsvps.filter((rsvp) => rsvp.status === "not_going").length;
  const viewerStatus = rsvps.find((rsvp) => rsvp.profile_id === viewerId)?.status;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{event.title}</span>
          {isPast && (
            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Past
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">
          {new Date(event.event_date).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {event.location && <p className="text-muted-foreground">📍 {event.location}</p>}
        {event.description && <p className="text-muted-foreground">{event.description}</p>}
        <p className="text-xs text-muted-foreground">
          Hosted by {event.creator?.display_name ?? event.creator?.email ?? "Unknown"}
        </p>

        <p className="text-xs text-muted-foreground">
          {goingRsvps.length} in, {maybeCount} on the fence, {notGoingCount} bailed
        </p>
        {goingRsvps.length > 0 && (
          <p className="text-xs">
            <span className="text-muted-foreground">Locked in: </span>
            {goingRsvps
              .map((rsvp) => rsvp.profile?.display_name ?? rsvp.profile?.email ?? "Unknown")
              .join(", ")}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {STATUS_OPTIONS.map((option) => (
            <form key={option.value} action={setRsvp}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value={option.value} />
              <Button
                type="submit"
                size="sm"
                variant={viewerStatus === option.value ? "default" : "outline"}
                className={cn(
                  option.value === "not_going" &&
                    viewerStatus === option.value &&
                    "bg-destructive/10 text-destructive hover:bg-destructive/20",
                )}
              >
                {option.label}
              </Button>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
