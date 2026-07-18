"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const MAX_NAME_LENGTH = 40;

export async function updateDisplayName(formData: FormData) {
  const displayName = formData.get("display_name")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!displayName) {
    redirect("/profile?error=Name+can%27t+be+blank");
  }
  if (displayName.length > MAX_NAME_LENGTH) {
    redirect("/profile?error=That%27s+too+long");
  }

  // Goes through the service-role client but only ever touches
  // display_name — profiles has no client-side update policy on purpose
  // (see supabase/schema.sql) so this self-service path can't be used to
  // also change role/frat_title/demerits.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/frat-history/roster");
  revalidatePath("/frat-history/admin");
  revalidatePath("/thread");
  revalidatePath("/");
  redirect("/profile");
}
