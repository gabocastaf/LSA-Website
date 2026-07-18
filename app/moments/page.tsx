import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MomentsWall, type MomentPhoto } from "@/components/moments-wall";
import type { ReactionType } from "@/lib/reactions";
import { deletePhoto } from "./actions";
import { PhotoUploadForm } from "./photo-upload-form";

type ProfileRef = { id: string; display_name: string | null; email: string } | null;

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  hidden: boolean;
  uploaded_by: string | null;
  uploader: ProfileRef;
  tags: { profile: ProfileRef }[];
  comments: {
    id: string;
    body: string;
    created_at: string;
    author_id: string | null;
    author: { display_name: string | null; email: string | null; role: string | null } | null;
  }[];
  reactions: { profile_id: string; reaction_type: ReactionType }[];
};

const EMPTY_REACTION_COUNTS: Record<ReactionType, number> = {
  fire: 0,
  heart: 0,
  laugh: 0,
  skull: 0,
};

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

  const { data: photoRows } = await supabase
    .from("photos")
    .select(
      "id, storage_path, caption, created_at, hidden, uploaded_by, uploader:profiles!photos_uploaded_by_fkey(id, display_name, email), tags:photo_tags(profile:profiles(id, display_name, email)), comments:photo_comments(id, body, created_at, author_id, author:profiles(id, display_name, email, role)), reactions:photo_reactions(profile_id, reaction_type)",
    )
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "photo_comments", ascending: true })
    .returns<PhotoRow[]>();

  const roster = members ?? [];

  const photos: MomentPhoto[] = (photoRows ?? [])
    .filter((photo) => isAdmin || !photo.hidden)
    .map((photo) => {
      const { data: publicUrlData } = supabase.storage
        .from("photos")
        .getPublicUrl(photo.storage_path);

      const reactionCounts = { ...EMPTY_REACTION_COUNTS };
      const viewerReactedTypes: ReactionType[] = [];
      for (const reaction of photo.reactions) {
        reactionCounts[reaction.reaction_type] += 1;
        if (reaction.profile_id === user.id) {
          viewerReactedTypes.push(reaction.reaction_type);
        }
      }

      return {
        id: photo.id,
        publicUrl: publicUrlData.publicUrl,
        storagePath: photo.storage_path,
        caption: photo.caption,
        createdAt: photo.created_at,
        hidden: photo.hidden,
        uploadedBy: photo.uploaded_by,
        uploader: photo.uploader,
        tags: photo.tags
          .map((tag) => tag.profile)
          .filter((profile): profile is NonNullable<typeof profile> => profile !== null),
        comments: photo.comments,
        reactionCounts,
        viewerReactedTypes,
      };
    });

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
