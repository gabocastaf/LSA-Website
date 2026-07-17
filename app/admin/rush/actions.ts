"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const VALID_ROLES = ["pledge", "active", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

function isValidRole(value: string | undefined): value is Role {
  return !!value && (VALID_ROLES as readonly string[]).includes(value);
}

export async function updateMember(formData: FormData) {
  const profileId = formData.get("profileId")?.toString();
  const fratTitle = formData.get("frat_title")?.toString().trim();
  const role = formData.get("role")?.toString();

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

  if (!profileId) {
    redirect("/admin/rush?error=Missing+profile");
  }

  // Prevent the acting admin from changing their own role — a mis-click
  // here would lock them out of /admin/rush with no UI path back in.
  const isSelf = profileId === user.id;
  if (!isSelf && !isValidRole(role)) {
    redirect("/admin/rush?error=Invalid+role");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      ...(isSelf ? {} : { role }),
      ...(fratTitle ? { frat_title: fratTitle } : {}),
    })
    .eq("id", profileId);

  if (error) {
    redirect(`/admin/rush?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/rush");
  revalidatePath("/roster");
  revalidatePath("/");
  redirect("/admin/rush");
}
