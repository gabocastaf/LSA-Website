"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function createEvent(formData: FormData) {
  const title = formData.get("title")?.toString().trim();
  const eventDate = formData.get("eventDate")?.toString();
  const location = formData.get("location")?.toString().trim();
  const description = formData.get("description")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!title || !eventDate) {
    redirect("/events?error=Title+and+date+are+required");
  }

  const parsedDate = new Date(eventDate);
  if (Number.isNaN(parsedDate.getTime())) {
    redirect("/events?error=Invalid+date");
  }

  const { error } = await supabase.from("events").insert({
    title,
    event_date: parsedDate.toISOString(),
    location: location || null,
    description: description || null,
    created_by: user.id,
  });

  if (error) {
    redirect(`/events?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/events");
  redirect("/events");
}

const VALID_STATUSES = ["going", "maybe", "not_going"] as const;

export async function setRsvp(formData: FormData) {
  const eventId = formData.get("eventId")?.toString();
  const status = formData.get("status")?.toString();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!eventId || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    redirect("/events?error=Invalid+RSVP");
  }

  const { error } = await supabase
    .from("event_rsvps")
    .upsert(
      { event_id: eventId, profile_id: user.id, status },
      { onConflict: "event_id,profile_id" },
    );

  if (error) {
    redirect(`/events?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/events");
  redirect("/events");
}
