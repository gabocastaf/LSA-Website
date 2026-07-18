"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { REACTION_TYPES } from "@/lib/reactions";

const MAX_COMMENT_LENGTH = 500;

export type PostedComment = {
  id: string;
  photo_id: string;
  body: string;
  created_at: string;
  author_id: string | null;
};

// Returns a result object instead of redirecting, same reasoning as
// app/thread/actions.ts's postMessage: this is invoked directly from a
// client component (PhotoComments) for optimistic UI inside the lightbox,
// not bound as a form `action`.
export async function postComment(
  formData: FormData,
): Promise<{ error?: string; comment?: PostedComment }> {
  const photoId = formData.get("photoId")?.toString();
  const body = formData.get("body")?.toString().trim();

  if (!photoId) {
    return { error: "Missing photo." };
  }
  if (!body) {
    return { error: "Say less." };
  }
  if (body.length > MAX_COMMENT_LENGTH) {
    return { error: "Nobody's reading a novel here." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You got signed out. Log back in." };
  }

  const { data, error } = await supabase
    .from("photo_comments")
    .insert({ photo_id: photoId, author_id: user.id, body })
    .select("id, photo_id, body, created_at, author_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Keeps the server-rendered comment count fresh for the next full page
  // load. Doesn't touch the currently-open lightbox, which is driven by
  // local client state, so there's no realtime subscription to fight here
  // (unlike postMessage's Thread, this isn't a persistent shared room).
  revalidatePath("/moments");

  return { comment: data };
}

export async function deleteComment(formData: FormData): Promise<{ error?: string }> {
  const commentId = formData.get("commentId")?.toString();

  if (!commentId) {
    return { error: "Missing comment." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You got signed out. Log back in." };
  }

  const { data: comment } = await supabase
    .from("photo_comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isOwner = comment?.author_id === user.id;
  const isAdmin = viewer?.role === "admin";

  if (!isOwner && !isAdmin) {
    return { error: "Not your comment." };
  }

  // Owner deletes go through the regular client so photo_comments_delete_own
  // does the enforcing; only the admin-override case (deleting someone
  // else's comment) needs the service-role client to bypass RLS — same split
  // as requireEditAccess in app/events/actions.ts.
  const client = isOwner ? supabase : createAdminClient();

  const { error } = await client.from("photo_comments").delete().eq("id", commentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/moments");

  return {};
}

export async function toggleReaction(
  formData: FormData,
): Promise<{ error?: string; reacted?: boolean }> {
  const photoId = formData.get("photoId")?.toString();
  const reactionType = formData.get("reactionType")?.toString();

  if (!photoId || !(REACTION_TYPES as readonly string[]).includes(reactionType ?? "")) {
    return { error: "Invalid reaction." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You got signed out. Log back in." };
  }

  const { data: existing } = await supabase
    .from("photo_reactions")
    .select("id")
    .eq("photo_id", photoId)
    .eq("profile_id", user.id)
    .eq("reaction_type", reactionType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("photo_reactions").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/moments");
    return { reacted: false };
  }

  const { error } = await supabase
    .from("photo_reactions")
    .insert({ photo_id: photoId, profile_id: user.id, reaction_type: reactionType });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/moments");

  return { reacted: true };
}
