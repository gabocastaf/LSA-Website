"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createResendClient } from "@/utils/resend/client";

const EVENTS_FROM_EMAIL = "Ligma Sigma Alpha <no-reply@ligmasigma.com>";

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

  await sendEventBlast(supabase, {
    title,
    eventDate: parsedDate,
    location: location || null,
    description: description || null,
  });

  revalidatePath("/events");
  redirect("/events");
}

// Event fields are member-authored free text with no HTML sanitization on
// input (unlike React's page render, raw string interpolation into email
// HTML has no auto-escaping), so escape before embedding.
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEventBlast(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: { title: string; eventDate: Date; location: string | null; description: string | null },
) {
  const { data: members } = await supabase.from("profiles").select("email");
  const recipients = (members ?? []).map((member) => member.email).filter(Boolean);

  if (recipients.length === 0) return;

  const formattedDate = event.eventDate.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  try {
    const resend = createResendClient();
    await resend.emails.send({
      from: EVENTS_FROM_EMAIL,
      to: EVENTS_FROM_EMAIL,
      bcc: recipients,
      subject: `Mandatory Fun Alert: ${event.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="margin-bottom: 0;">${escapeHtml(event.title)}</h2>
          <p style="color: #666; margin-top: 4px;">Allegedly voluntary attendance.</p>
          <p><strong>When:</strong> ${formattedDate}</p>
          ${event.location ? `<p><strong>Where:</strong> ${escapeHtml(event.location)}</p>` : ""}
          ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
          <p style="margin-top: 24px;">
            <a href="https://www.ligmasigma.com/events">RSVP before the demerits start flying</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Best-effort: a dead Resend key or flaky API shouldn't block the event
    // from actually getting created.
    console.error("Failed to send event blast email", err);
  }
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
