"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function giveAward(formData: FormData) {
  const recipientId = formData.get("recipientId")?.toString();
  const title = formData.get("title")?.toString().trim();
  const reason = formData.get("reason")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!recipientId || !title) {
    redirect("/trophy-room?error=Recipient+and+title+are+required");
  }

  const { error } = await supabase.from("awards").insert({
    recipient_id: recipientId,
    title,
    reason: reason || null,
    given_by: user.id,
  });

  if (error) {
    redirect(`/trophy-room?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trophy-room");
  redirect("/trophy-room");
}
