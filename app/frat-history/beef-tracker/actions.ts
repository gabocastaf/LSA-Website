"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function createBeef(formData: FormData) {
  const title = formData.get("title")?.toString().trim();
  const target = formData.get("target")?.toString().trim();
  const reason = formData.get("reason")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!title) {
    redirect("/frat-history/beef-tracker?error=Title+is+required");
  }

  const { error } = await supabase.from("beefs").insert({
    title,
    target: target || null,
    reason: reason || null,
    created_by: user.id,
  });

  if (error) {
    redirect(`/frat-history/beef-tracker?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/frat-history/beef-tracker");
  redirect("/frat-history/beef-tracker");
}

export async function toggleBeefStatus(formData: FormData) {
  const beefId = formData.get("beefId")?.toString();
  const nextStatus = formData.get("nextStatus")?.toString();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!beefId || (nextStatus !== "active" && nextStatus !== "squashed")) {
    redirect("/frat-history/beef-tracker?error=Invalid+request");
  }

  // RLS also enforces created_by = auth.uid() on update, but this table
  // has no self-only select, so filtering here keeps the intent explicit.
  const { error } = await supabase
    .from("beefs")
    .update({ status: nextStatus })
    .eq("id", beefId)
    .eq("created_by", user.id);

  if (error) {
    redirect(`/frat-history/beef-tracker?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/frat-history/beef-tracker");
  redirect("/frat-history/beef-tracker");
}
