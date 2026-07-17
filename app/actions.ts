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

// Hardcoded allowlist, checked at runtime with .includes() below — this action
// writes through the service-role client (bypasses RLS), so an unvalidated
// table name from form data would be an arbitrary-table-write primitive. A TS
// type alone isn't a guard here since types don't exist after compilation.
const PINNABLE_TABLES = [
  "events",
  "awards",
  "quotes",
  "beefs",
  "photos",
  "sounds",
  "thread_messages",
  "membership_events",
] as const;
type PinnableTable = (typeof PINNABLE_TABLES)[number];

export async function togglePin(formData: FormData) {
  const table = formData.get("table")?.toString();
  const id = formData.get("id")?.toString();
  const nextPinned = formData.get("pinned")?.toString() === "true";

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

  if (!table || !(PINNABLE_TABLES as readonly string[]).includes(table) || !id) {
    redirect("/");
  }

  const admin = createAdminClient();
  await admin
    .from(table as PinnableTable)
    .update({ pinned: nextPinned })
    .eq("id", id);

  revalidatePath("/");
  redirect("/");
}
