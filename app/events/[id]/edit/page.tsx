import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateEvent } from "../../actions";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string.
function toDatetimeLocal(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
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

  const { data: event } = await supabase
    .from("events")
    .select("id, title, event_date, location, description, attendance, created_by")
    .eq("id", id)
    .single();

  if (!event) {
    redirect("/events?error=Event+not+found");
  }

  const isCreator = event.created_by === user.id;
  const isAdmin = viewerProfile?.role === "admin";
  if (!isCreator && !isAdmin) {
    redirect("/events?error=Not+your+event");
  }

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-lg p-4">
        <h1 className="text-2xl font-bold tracking-tight">Edit Event</h1>
        <p className="mt-1 text-muted-foreground">
          Fix your mistake before anyone notices.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{event.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateEvent} className="flex flex-col gap-3">
              <input type="hidden" name="eventId" value={event.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">What are we calling this</Label>
                <Input id="title" name="title" defaultValue={event.title} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eventDate">When</Label>
                <Input
                  id="eventDate"
                  name="eventDate"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(event.event_date)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Where (optional)</Label>
                <Input id="location" name="location" defaultValue={event.location ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Details (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={event.description ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attendance">Attendance</Label>
                <select
                  id="attendance"
                  name="attendance"
                  defaultValue={event.attendance}
                  className={selectClassName}
                >
                  <option value="optional">Optional</option>
                  <option value="mandatory">Mandatory</option>
                </select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
