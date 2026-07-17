import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { giveAward } from "./actions";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

type AwardRow = {
  id: string;
  title: string;
  reason: string | null;
  created_at: string;
  hidden: boolean;
  recipient: { id: string; display_name: string | null; email: string } | null;
  giver: { id: string; display_name: string | null; email: string } | null;
};

export default async function TrophyRoomPage({
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
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = viewerProfile?.role === "admin";

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .order("display_name", { ascending: true });

  const { data: awardRows } = await supabase
    .from("awards")
    .select(
      "id, title, reason, created_at, hidden, recipient:profiles!awards_recipient_id_fkey(id, display_name, email), giver:profiles!awards_given_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<AwardRow[]>();

  const roster = members ?? [];
  const awards = (awardRows ?? []).filter((award) => isAdmin || !award.hidden);

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold tracking-tight">Trophy Cabinet</h1>
      <p className="mt-1 text-muted-foreground">
        {awards.length} {awards.length === 1 ? "trophy" : "trophies"} awarded so far.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Give an Award</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={giveAward} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipientId">Recipient</Label>
              <select
                id="recipientId"
                name="recipientId"
                defaultValue=""
                required
                className={selectClassName}
              >
                <option value="" disabled>
                  Choose a brother
                </option>
                {roster.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name ?? profile.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Award Title</Label>
              <Input id="title" name="title" placeholder="e.g. Most Likely to Get Us Sued" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" name="reason" placeholder="What did they do to earn this?" />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Award It
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">The Cabinet</h2>
      {awards.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No trophies awarded yet. Be the first.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {awards.map((award) => (
            <Card key={award.id} className={award.hidden ? "opacity-60" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{award.title}</span>
                  <span className="flex items-center gap-1.5">
                    {award.hidden && <HiddenBadge />}
                    {isAdmin && (
                      <HideToggleButton
                        table="awards"
                        id={award.id}
                        hidden={award.hidden}
                        redirectTo="/frat-history/trophy-room"
                      />
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">
                  {award.recipient?.display_name ?? award.recipient?.email ?? "Unknown"}
                </p>
                {award.reason && (
                  <p className="text-muted-foreground italic">&ldquo;{award.reason}&rdquo;</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Awarded by {award.giver?.display_name ?? award.giver?.email ?? "Unknown"} on{" "}
                  {new Date(award.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
