"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadPhoto(formData: FormData) {
  const file = formData.get("file");
  const caption = formData.get("caption")?.toString().trim();
  const taggedProfileIds = formData.getAll("taggedProfileIds").map((id) => id.toString());

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect("/moments?error=Pick+a+photo+first");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    redirect("/moments?error=JPEG%2C+PNG%2C+WebP%2C+or+GIF+only");
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect("/moments?error=Photo+too+large+(8MB+max)");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    redirect(`/moments?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data: photo, error: insertError } = await supabase
    .from("photos")
    .insert({
      storage_path: storagePath,
      caption: caption || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !photo) {
    await supabase.storage.from("photos").remove([storagePath]);
    redirect(
      `/moments?error=${encodeURIComponent(insertError?.message ?? "Upload failed")}`,
    );
  }

  if (taggedProfileIds.length > 0) {
    // Best-effort, same as the storage cleanup above: the photo itself
    // already uploaded successfully, so a tagging hiccup shouldn't fail
    // the whole request.
    await supabase.from("photo_tags").insert(
      taggedProfileIds.map((profileId) => ({
        photo_id: photo.id,
        profile_id: profileId,
      })),
    );
  }

  revalidatePath("/moments");
  redirect("/moments");
}

export async function deletePhoto(formData: FormData) {
  const photoId = formData.get("photoId")?.toString();
  const storagePath = formData.get("storagePath")?.toString();
  // Defaults to /moments so the original Moments call site (which doesn't
  // send this field) keeps working unmodified — same pattern as
  // toggleHide/deleteFeedItem in app/actions.ts, needed now that the owner
  // delete form is also reachable from the home Feed via PhotoBubble.
  const redirectTo = formData.get("redirectTo")?.toString() || "/moments";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!photoId || !storagePath) {
    redirect(`${redirectTo}?error=Invalid+request`);
  }

  const { error: deleteRowError } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("uploaded_by", user.id);

  if (deleteRowError) {
    redirect(`${redirectTo}?error=${encodeURIComponent(deleteRowError.message)}`);
  }

  // Best-effort: the DB row is the source of truth for what's "in" the
  // gallery, so an orphaned storage object here isn't worth failing the
  // request over.
  await supabase.storage.from("photos").remove([storagePath]);

  revalidatePath(redirectTo);
  redirect(redirectTo);
}
