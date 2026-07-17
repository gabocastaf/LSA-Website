"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  "audio/x-m4a",
];

export async function uploadSound(formData: FormData) {
  const file = formData.get("file");
  const title = formData.get("title")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!title) {
    redirect("/soundboard?error=Give+the+clip+a+name");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect("/soundboard?error=Pick+an+audio+file+first");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    redirect("/soundboard?error=MP3%2C+WAV%2C+OGG%2C+or+M4A+only");
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect("/soundboard?error=Clip+too+large+(5MB+max)");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("sounds")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    redirect(`/soundboard?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error: insertError } = await supabase.from("sounds").insert({
    storage_path: storagePath,
    title,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("sounds").remove([storagePath]);
    redirect(`/soundboard?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/soundboard");
  redirect("/soundboard");
}

export async function deleteSound(formData: FormData) {
  const soundId = formData.get("soundId")?.toString();
  const storagePath = formData.get("storagePath")?.toString();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!soundId || !storagePath) {
    redirect("/soundboard?error=Invalid+request");
  }

  const { error: deleteRowError } = await supabase
    .from("sounds")
    .delete()
    .eq("id", soundId)
    .eq("uploaded_by", user.id);

  if (deleteRowError) {
    redirect(`/soundboard?error=${encodeURIComponent(deleteRowError.message)}`);
  }

  // Best-effort: the DB row is the source of truth for what's "in" the
  // rotation, so an orphaned storage object here isn't worth failing the
  // request over.
  await supabase.storage.from("sounds").remove([storagePath]);

  revalidatePath("/soundboard");
  redirect("/soundboard");
}
