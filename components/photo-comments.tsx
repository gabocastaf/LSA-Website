"use client";

import { useMemo, useState } from "react";

import { RankName } from "@/components/rank-name";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  postComment,
  deleteComment,
  type PostedComment,
} from "@/app/moments/social-actions";

type CommentAuthor = { display_name: string | null; email: string | null; role: string | null } | null;

type RosterProfile = { id: string; display_name: string | null; email: string; role: string };

export type PhotoComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author: CommentAuthor;
};

export function PhotoComments({
  photoId,
  initialComments,
  roster,
  viewerId,
  isAdmin,
}: {
  photoId: string;
  initialComments: PhotoComment[];
  roster: RosterProfile[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const profileById = useMemo(() => {
    const map = new Map<string, RosterProfile>();
    for (const profile of roster) map.set(profile.id, profile);
    return map;
  }, [roster]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("photoId", photoId);
    formData.set("body", body);
    const result = await postComment(formData);

    setPending(false);

    if (result.error || !result.comment) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }

    appendComment(result.comment);
    setBody("");
  }

  function appendComment(row: PostedComment) {
    setComments((prev) => {
      if (prev.some((c) => c.id === row.id)) return prev;
      const profile = row.author_id ? profileById.get(row.author_id) : undefined;
      const optimistic: PhotoComment = {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author_id: row.author_id,
        author: profile
          ? { display_name: profile.display_name, email: profile.email, role: profile.role }
          : null,
      };
      return [...prev, optimistic];
    });
  }

  async function handleDelete(commentId: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const formData = new FormData();
    formData.set("commentId", commentId);
    const result = await deleteComment(formData);

    if (result.error) {
      setComments(previous);
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Testify.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  <RankName
                    profile={{
                      display_name: comment.author?.display_name ?? null,
                      email: comment.author?.email ?? null,
                      role: comment.author?.role ?? null,
                    }}
                  />
                </span>
                {(comment.author_id === viewerId || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-foreground">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add to the evidence"
          className="min-h-10 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={pending || !body.trim()}>
          Post
        </Button>
      </form>
    </div>
  );
}
