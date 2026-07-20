import type { createClient } from "@/utils/supabase/server";
import type { MomentPhoto } from "@/components/moments-wall";
import type { ReactionType } from "@/lib/reactions";

type ProfileRef = { id: string; display_name: string | null; email: string } | null;
type UploaderRef = { id: string; display_name: string | null; email: string; role: string | null } | null;

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  hidden: boolean;
  pinned: boolean;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  uploader: UploaderRef;
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

// Shared by Moments (the full gallery view) and the home Feed (which shows
// photo items inline in the mixed activity list) so both render from
// identical data/engagement numbers instead of two independently-drifting
// queries. Each caller still applies its own hidden-item visibility policy
// after this returns — that split is deliberate, not duplicated by accident.
export async function fetchMomentPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
): Promise<MomentPhoto[]> {
  const { data: photoRows } = await supabase
    .from("photos")
    .select(
      "id, storage_path, caption, created_at, hidden, pinned, width, height, uploaded_by, uploader:profiles!photos_uploaded_by_fkey(id, display_name, email, role), tags:photo_tags(profile:profiles(id, display_name, email)), comments:photo_comments(id, body, created_at, author_id, author:profiles(id, display_name, email, role)), reactions:photo_reactions(profile_id, reaction_type)",
    )
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "photo_comments", ascending: true })
    .returns<PhotoRow[]>();

  return (photoRows ?? []).map((photo) => {
    const { data: publicUrlData } = supabase.storage
      .from("photos")
      .getPublicUrl(photo.storage_path);

    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    const viewerReactedTypes: ReactionType[] = [];
    for (const reaction of photo.reactions) {
      reactionCounts[reaction.reaction_type] += 1;
      if (reaction.profile_id === viewerId) {
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
      pinned: photo.pinned,
      width: photo.width,
      height: photo.height,
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
}
