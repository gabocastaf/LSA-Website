import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { ThreadFeed } from "@/components/thread-feed";

type AuthorRow = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
};

type ThreadMessageRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author: AuthorRow | null;
};

export default async function ThreadPage() {
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

  const { data: messageRows } = await supabase
    .from("thread_messages")
    .select(
      "id, body, created_at, author_id, author:profiles!thread_messages_author_id_fkey(id, display_name, email, role)",
    )
    .order("created_at", { ascending: true })
    .returns<ThreadMessageRow[]>();

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, email, role");

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto flex max-w-2xl flex-col p-4">
        <h1 className="text-2xl font-bold tracking-tight">The Thread</h1>
        <p className="mt-1 text-muted-foreground">
          The chapter group chat. Say something stupid.
        </p>

        <ThreadFeed
          initialMessages={messageRows ?? []}
          profiles={profileRows ?? []}
          viewerId={user.id}
        />
      </main>
    </div>
  );
}
