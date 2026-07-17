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
