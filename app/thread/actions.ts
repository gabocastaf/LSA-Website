"use server";

import { createClient } from "@/utils/supabase/server";

const MAX_BODY_LENGTH = 2000;

export type PostedMessage = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
};

// Returns a result object instead of redirecting: this action is invoked
// directly from a client component (ThreadFeed), not bound as a form
// `action`, since the message list is realtime-driven — a revalidatePath
// here would fight that client state and cause a visible refetch on every
// post. Returns the inserted row so the caller can append it optimistically
// instead of depending entirely on the Realtime round-trip: if the
// publication isn't live for any reason, the message still shows up for its
// own author, and the existing id-based dedup in ThreadFeed drops the
// realtime echo when it does arrive.
export async function postMessage(
  formData: FormData,
): Promise<{ error?: string; message?: PostedMessage }> {
  const body = formData.get("body")?.toString().trim();

  if (!body) {
    return { error: "Say something first." };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { error: "That's a lot of words. Trim it down." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You got signed out. Log back in." };
  }

  const { data, error } = await supabase
    .from("thread_messages")
    .insert({ body, author_id: user.id })
    .select("id, body, created_at, author_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { message: data };
}
