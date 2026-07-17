"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { RankName } from "@/components/rank-name";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { postMessage } from "@/app/thread/actions";

type Profile = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
};

type ThreadMessage = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  hidden: boolean;
  author: { display_name: string | null; email: string | null; role: string | null } | null;
};

type ThreadMessageRealtimeRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
};

export function ThreadFeed({
  initialMessages,
  profiles,
  viewerId,
  isAdmin,
}: {
  initialMessages: ThreadMessage[];
  profiles: Profile[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of profiles) map.set(profile.id, profile);
    return map;
  }, [profiles]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("thread_messages_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "thread_messages" },
        (payload: RealtimePostgresInsertPayload<ThreadMessageRealtimeRow>) => {
          const row = payload.new;
          const profile = row.author_id ? profileById.get(row.author_id) : undefined;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next: ThreadMessage = {
              id: row.id,
              body: row.body,
              created_at: row.created_at,
              author_id: row.author_id,
              hidden: false,
              author: profile
                ? { display_name: profile.display_name, email: profile.email, role: profile.role }
                : null,
            };
            return [...prev, next].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileById]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("body", body);
    const result = await postMessage(formData);

    setPending(false);

    if (result.error || !result.message) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }

    // Append immediately rather than waiting on the Realtime round-trip —
    // the existing id-based dedup below drops the realtime echo of this
    // same message when (if) it arrives.
    const row = result.message;
    const profile = row.author_id ? profileById.get(row.author_id) : undefined;
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) return prev;
      const next: ThreadMessage = {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author_id: row.author_id,
        hidden: false,
        author: profile
          ? { display_name: profile.display_name, email: profile.email, role: profile.role }
          : null,
      };
      return [...prev, next].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });

    setBody("");
  }

  return (
    <div className="mt-6 flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 rounded-xl bg-muted/30 p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">
            Total silence. Somebody say something.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg px-2 py-1 text-sm",
                message.author_id === viewerId && "bg-background",
                message.hidden && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">
                    <RankName
                      profile={{
                        display_name: message.author?.display_name ?? null,
                        email: message.author?.email ?? null,
                        role: message.author?.role ?? null,
                      }}
                    />
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {(message.hidden || isAdmin) && (
                  <span className="flex shrink-0 items-center gap-1">
                    {message.hidden && <HiddenBadge />}
                    {isAdmin && (
                      <HideToggleButton
                        table="thread_messages"
                        id={message.id}
                        hidden={message.hidden}
                        redirectTo="/thread"
                      />
                    )}
                  </span>
                )}
              </div>
              <p className="text-foreground">{message.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Say something to the chapter"
          className="min-h-10 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={pending || !body.trim()}>
          Send It
        </Button>
      </form>
    </div>
  );
}
