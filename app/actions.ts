"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Hardcoded allowlist, checked at runtime with .includes() below — these
// actions write through the service-role client (bypasses RLS), so an
// unvalidated table name from form data would be an arbitrary-table-write
// primitive. A TS type alone isn't a guard here since types don't exist after
// compilation. Shared by togglePin and toggleHide since both flip a boolean
// flag on the same set of feed tables.
const FEED_TABLES = [
  "events",
  "awards",
  "quotes",
  "beefs",
  "photos",
  "sounds",
  "thread_messages",
  "membership_events",
] as const;
type FeedTable = (typeof FEED_TABLES)[number];

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (viewer?.role !== "admin") {
    redirect("/");
  }
}

export async function togglePin(formData: FormData) {
  const table = formData.get("table")?.toString();
  const id = formData.get("id")?.toString();
  const nextPinned = formData.get("pinned")?.toString() === "true";

  await requireAdmin();

  if (!table || !(FEED_TABLES as readonly string[]).includes(table) || !id) {
    redirect("/");
  }

  const admin = createAdminClient();
  await admin
    .from(table as FeedTable)
    .update({ pinned: nextPinned })
    .eq("id", id);

  revalidatePath("/");
  redirect("/");
}

// Reversible admin moderation: hides an item from the dashboard feed and its
// own page (Events, Photo Gallery, etc.) without deleting the row, so test
// data or outlandish community submissions can be pulled from view and later
// undone. redirectTo lets this be called from any of those pages, not just
// the dashboard.
export async function toggleHide(formData: FormData) {
  const table = formData.get("table")?.toString();
  const id = formData.get("id")?.toString();
  const nextHidden = formData.get("hidden")?.toString() === "true";
  const redirectTo = formData.get("redirectTo")?.toString() || "/";

  await requireAdmin();

  if (!table || !(FEED_TABLES as readonly string[]).includes(table) || !id) {
    redirect(redirectTo);
  }

  const admin = createAdminClient();
  await admin
    .from(table as FeedTable)
    .update({ hidden: nextHidden })
    .eq("id", id);

  revalidatePath(redirectTo);
  redirect(redirectTo);
}

// Only photos and sounds have a backing storage object to clean up alongside
// the row.
const STORAGE_BUCKET_BY_TABLE: Partial<Record<FeedTable, string>> = {
  photos: "photos",
  sounds: "sounds",
};

// Permanent delete for admins — deliberately gated to already-hidden rows
// (checked server-side, not just by hiding the button in the UI) so this
// stays a two-step "hide, confirm it's junk, then delete" flow rather than a
// one-click way to permanently remove live content.
export async function deleteFeedItem(formData: FormData) {
  const table = formData.get("table")?.toString();
  const id = formData.get("id")?.toString();
  const storagePath = formData.get("storagePath")?.toString();
  const redirectTo = formData.get("redirectTo")?.toString() || "/";

  await requireAdmin();

  if (!table || !(FEED_TABLES as readonly string[]).includes(table) || !id) {
    redirect(redirectTo);
  }

  const admin = createAdminClient();

  const { data: row } = await admin
    .from(table as FeedTable)
    .select("hidden")
    .eq("id", id)
    .single();

  if (!row?.hidden) {
    redirect(redirectTo);
  }

  await admin.from(table as FeedTable).delete().eq("id", id);

  const bucket = STORAGE_BUCKET_BY_TABLE[table as FeedTable];
  if (bucket && storagePath) {
    // Best-effort, same reasoning as deletePhoto/deleteSound: the DB row is
    // the source of truth for what's "in" the gallery/soundboard, so a
    // leftover storage object here isn't worth failing the request over.
    await admin.storage.from(bucket).remove([storagePath]);
  }

  revalidatePath(redirectTo);
  redirect(redirectTo);
}
