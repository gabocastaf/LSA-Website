"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function submitQuote(formData: FormData) {
  const quoteText = formData.get("quoteText")?.toString().trim();
  const attributedTo = formData.get("attributedTo")?.toString();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!quoteText) {
    redirect("/frat-history/kangaroo-court?error=Quote+text+is+required");
  }

  const { error } = await supabase.from("quotes").insert({
    quote_text: quoteText,
    attributed_to: attributedTo || null,
    submitted_by: user.id,
  });

  if (error) {
    redirect(`/frat-history/kangaroo-court?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/frat-history/kangaroo-court");
  redirect("/frat-history/kangaroo-court");
}

export async function adjustDemerits(formData: FormData) {
  const profileId = formData.get("profileId")?.toString();
  const demeritsRaw = formData.get("demerits")?.toString();
  const demerits = demeritsRaw ? Number.parseInt(demeritsRaw, 10) : NaN;

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

  if (!profileId || Number.isNaN(demerits) || demerits < 0) {
    redirect("/frat-history/kangaroo-court?error=Invalid+demerit+count");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ demerits })
    .eq("id", profileId);

  if (error) {
    redirect(`/frat-history/kangaroo-court?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/frat-history/kangaroo-court");
  revalidatePath("/roster");
  revalidatePath("/");
  redirect("/frat-history/kangaroo-court");
}
