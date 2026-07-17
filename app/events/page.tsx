import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { EventCalendar } from "@/components/event-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { createEvent, setRsvp, deleteEvent } from "./actions";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

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
  attendance: "optional" | "mandatory";
  hidden: boolean;
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
  searchParams: Promise<{ error?: string; view?: string; month?: string }>;
}) {
  const { error, view, month } = await searchParams;
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
      "id, title, event_date, location, description, attendance, hidden, created_by, creator:profiles!events_created_by_fkey(id, display_name, email)",
    )
    .order("event_date", { ascending: true })
    .returns<EventRow[]>();

  const { data: rsvpRows } = await supabase
    .from("event_rsvps")
    .select(
      "event_id, status, profile_id, profile:profiles!event_rsvps_profile_id_fkey(id, display_name, email)",
    )
    .returns<RsvpRow[]>();

  const isAdmin = viewerProfile?.role === "admin";

  // Non-admins never see events an admin has hidden (e.g. test data);
  // admins see them dimmed with an unhide control.
  const events = (eventRows ?? []).filter((event) => isAdmin || !event.hidden);
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

  const isCalendarView = view === "calendar";

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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attendance">Attendance</Label>
                <select
                  id="attendance"
                  name="attendance"
                  defaultValue="optional"
                  className={selectClassName}
                >
                  <option value="optional">Optional</option>
                  <option value="mandatory">Mandatory</option>
                </select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Put It On the Calendar
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center gap-2">
          <Link
            href="/events?view=list"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              !isCalendarView ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            List
          </Link>
          <Link
            href="/events?view=calendar"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              isCalendarView ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
            )}
          >
            Calendar
          </Link>
        </div>

        {isCalendarView ? (
          <EventCalendar events={events} month={month} />
        ) : (
          <>
            <h2 className="mt-6 text-lg font-semibold tracking-tight">Upcoming</h2>
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
                    isAdmin={isAdmin}
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
                      isAdmin={isAdmin}
                      isPast={true}
                    />
                  ))}
                </div>
              </>
            )}
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
  isAdmin,
  isPast,
}: {
  event: EventRow;
  rsvps: RsvpRow[];
  viewerId: string;
  isAdmin: boolean;
  isPast: boolean;
}) {
  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === "going");
  const maybeCount = rsvps.filter((rsvp) => rsvp.status === "maybe").length;
  const notGoingCount = rsvps.filter((rsvp) => rsvp.status === "not_going").length;
  const viewerStatus = rsvps.find((rsvp) => rsvp.profile_id === viewerId)?.status;
  const canManage = isAdmin || event.created_by === viewerId;

  return (
    <Card id={`event-${event.id}`} className={event.hidden ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{event.title}</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
                event.attendance === "mandatory"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {event.attendance === "mandatory" ? "Mandatory" : "Optional"}
            </span>
            {isPast && (
              <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Past
              </span>
            )}
            {event.hidden && <HiddenBadge />}
            {isAdmin && (
              <HideToggleButton table="events" id={event.id} hidden={event.hidden} redirectTo="/events" />
            )}
          </span>
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

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-2">
            <Button variant="outline" size="sm" render={<Link href={`/events/${event.id}/edit`} />}>
              Edit
            </Button>
            <form action={deleteEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <Button type="submit" variant="destructive" size="sm">
                Delete
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
