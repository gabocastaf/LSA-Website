"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { roleRank } from "@/lib/rank";

const VALID_ROLES = ["pledge", "active", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

function isValidRole(value: string | undefined): value is Role {
  return !!value && (VALID_ROLES as readonly string[]).includes(value);
}

export async function updateMember(formData: FormData) {
  const profileId = formData.get("profileId")?.toString();
  const fratTitle = formData.get("frat_title")?.toString().trim();
  const role = formData.get("role")?.toString();

  const user = await requireActingAdmin();

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

  // Read before write so the membership_events log below can diff old vs
  // new and snapshot a name for the feed.
  const { data: target } = await admin
    .from("profiles")
    .select("display_name, email, role, frat_title")
    .eq("id", profileId)
    .single();

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

  if (target) {
    const subjectLabel = target.display_name ?? target.email;
    const events: {
      profile_id: string;
      subject_label: string;
      actor_id: string;
      type: "promoted" | "demoted" | "retitled";
      from_value: string;
      to_value: string;
    }[] = [];

    if (!isSelf && isValidRole(role) && role !== target.role) {
      events.push({
        profile_id: profileId,
        subject_label: subjectLabel,
        actor_id: user.id,
        type: roleRank(role) > roleRank(target.role) ? "promoted" : "demoted",
        from_value: target.role,
        to_value: role,
      });
    }

    if (fratTitle && fratTitle !== target.frat_title) {
      events.push({
        profile_id: profileId,
        subject_label: subjectLabel,
        actor_id: user.id,
        type: "retitled",
        from_value: target.frat_title,
        to_value: fratTitle,
      });
    }

    if (events.length > 0) {
      await admin.from("membership_events").insert(events);
    }
  }

  revalidatePath("/admin/rush");
  revalidatePath("/roster");
  revalidatePath("/");
  redirect("/admin/rush");
}

async function requireActingAdmin() {
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

  return user;
}

export async function kickMember(formData: FormData) {
  const profileId = formData.get("profileId")?.toString();
  const nextKicked = formData.get("kicked")?.toString() === "true";

  const user = await requireActingAdmin();

  if (!profileId) {
    redirect("/admin/rush?error=Missing+profile");
  }

  // A mis-click here would lock the acting admin out with no UI path back
  // in — same reasoning as blocking self-role-changes above.
  if (profileId === user.id) {
    redirect("/admin/rush?error=Can%27t+kick+yourself");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", profileId)
    .single();

  // Bans (or lifts the ban on) the auth user so a kicked member can't get a
  // fresh session either — the middleware check only tears down an existing
  // session. "876000h" is ~100 years, i.e. effectively permanent until
  // reinstated.
  await admin.auth.admin.updateUserById(profileId, {
    ban_duration: nextKicked ? "876000h" : "none",
  });

  const { error } = await admin
    .from("profiles")
    .update({ kicked: nextKicked })
    .eq("id", profileId);

  if (error) {
    redirect(`/admin/rush?error=${encodeURIComponent(error.message)}`);
  }

  if (target) {
    await admin.from("membership_events").insert({
      profile_id: profileId,
      subject_label: target.display_name ?? target.email,
      actor_id: user.id,
      type: nextKicked ? "kicked" : "reinstated",
    });
  }

  revalidatePath("/admin/rush");
  revalidatePath("/roster");
  revalidatePath("/");
  redirect("/admin/rush");
}

export async function deleteMember(formData: FormData) {
  const profileId = formData.get("profileId")?.toString();

  const user = await requireActingAdmin();

  if (!profileId) {
    redirect("/admin/rush?error=Missing+profile");
  }

  if (profileId === user.id) {
    redirect("/admin/rush?error=Can%27t+delete+your+own+account");
  }

  const admin = createAdminClient();

  // Cascades the profiles row via profiles.id -> auth.users(id) on delete
  // cascade. Every content table's author FK is on delete set null, so
  // trophies/quotes/beefs/photos/sounds/events/thread messages this member
  // created (or received) survive with an "Unknown" author.
  const { error } = await admin.auth.admin.deleteUser(profileId);

  if (error) {
    redirect(`/admin/rush?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/rush");
  revalidatePath("/roster");
  revalidatePath("/");
  redirect("/admin/rush");
}
