import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MomentsWall } from "@/components/moments-wall";
import { fetchMomentPhotos } from "@/lib/fetch-moment-photos";
import { deletePhoto } from "./actions";
import { PhotoUploadForm } from "./photo-upload-form";

export default async function MomentsPage({
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

  const isAdmin = viewerProfile?.role === "admin";

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, email, role")
    .order("display_name", { ascending: true });

  const roster = members ?? [];

  const allPhotos = await fetchMomentPhotos(supabase, user.id);
  const photos = allPhotos.filter((photo) => isAdmin || !photo.hidden);

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Moments</h1>
        <p className="mt-1 text-muted-foreground">
          The evidence room. Deny everything. Bigger photos got more of a reaction out of the chapter.
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
            <PhotoUploadForm roster={roster} />
          </CardContent>
        </Card>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">The Archive</h2>
        <MomentsWall
          photos={photos}
          roster={roster}
          viewerId={user.id}
          isAdmin={isAdmin}
          deletePhotoAction={deletePhoto}
        />
      </main>
    </div>
  );
}
