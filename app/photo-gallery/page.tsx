import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadPhoto, deletePhoto } from "./actions";

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader: { id: string; display_name: string | null; email: string } | null;
};

export default async function PhotoGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("frat_title, role")
    .eq("id", user.id)
    .single();

  const { data: photoRows } = await supabase
    .from("photos")
    .select(
      "id, storage_path, caption, created_at, uploaded_by, uploader:profiles!photos_uploaded_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<PhotoRow[]>();

  const photos = photoRows ?? [];

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Photo Gallery</h1>
        <p className="mt-1 text-muted-foreground">
          The evidence room. Deny everything.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Submit Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={uploadPhoto} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">Photo</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  required
                  className="text-sm file:mr-3 file:h-8 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:text-sm file:font-medium file:text-secondary-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="caption">Caption (optional, but recommended for context)</Label>
                <Input id="caption" name="caption" placeholder="e.g. Nobody remembers how this happened" />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Add to the Gallery
              </Button>
            </form>
          </CardContent>
        </Card>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">The Archive</h2>
        {photos.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            No photos yet. Suspiciously clean record.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {photos.map((photo) => {
              const { data: publicUrlData } = supabase.storage
                .from("photos")
                .getPublicUrl(photo.storage_path);
              const isOwner = photo.uploaded_by === user.id;

              return (
                <Card key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrlData.publicUrl}
                    alt={photo.caption ?? "Chapter photo"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <CardContent className="space-y-1 text-sm">
                    {photo.caption && <p className="font-medium">{photo.caption}</p>}
                    <p className="text-xs text-muted-foreground">
                      {photo.uploader?.display_name ?? photo.uploader?.email ?? "Unknown"} ·{" "}
                      {new Date(photo.created_at).toLocaleDateString()}
                    </p>
                    {isOwner && (
                      <form action={deletePhoto}>
                        <input type="hidden" name="photoId" value={photo.id} />
                        <input type="hidden" name="storagePath" value={photo.storage_path} />
                        <Button type="submit" variant="destructive" size="sm">
                          Delete
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
