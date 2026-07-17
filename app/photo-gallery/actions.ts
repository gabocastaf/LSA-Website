"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadPhoto(formData: FormData) {
  const file = formData.get("file");
  const caption = formData.get("caption")?.toString().trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect("/photo-gallery?error=Pick+a+photo+first");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    redirect("/photo-gallery?error=JPEG%2C+PNG%2C+WebP%2C+or+GIF+only");
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect("/photo-gallery?error=Photo+too+large+(8MB+max)");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    redirect(`/photo-gallery?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error: insertError } = await supabase.from("photos").insert({
    storage_path: storagePath,
    caption: caption || null,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("photos").remove([storagePath]);
    redirect(`/photo-gallery?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/photo-gallery");
  redirect("/photo-gallery");
}

export async function deletePhoto(formData: FormData) {
  const photoId = formData.get("photoId")?.toString();
  const storagePath = formData.get("storagePath")?.toString();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!photoId || !storagePath) {
    redirect("/photo-gallery?error=Invalid+request");
  }

  const { error: deleteRowError } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("uploaded_by", user.id);

  if (deleteRowError) {
    redirect(`/photo-gallery?error=${encodeURIComponent(deleteRowError.message)}`);
  }

  // Best-effort: the DB row is the source of truth for what's "in" the
  // gallery, so an orphaned storage object here isn't worth failing the
  // request over.
  await supabase.storage.from("photos").remove([storagePath]);

  revalidatePath("/photo-gallery");
  redirect("/photo-gallery");
}
