import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { submitQuote, adjustDemerits } from "./actions";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

type QuoteRow = {
  id: string;
  quote_text: string;
  created_at: string;
  hidden: boolean;
  attributed: { id: string; display_name: string | null; email: string } | null;
  submitter: { id: string; display_name: string | null; email: string } | null;
};

type MemberRow = {
  id: string;
  display_name: string | null;
  email: string;
  demerits: number;
};

export default async function KangarooCourtPage({
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
    .select("id, display_name, email")
    .order("display_name", { ascending: true });

  const { data: quoteRows } = await supabase
    .from("quotes")
    .select(
      "id, quote_text, created_at, hidden, attributed:profiles!quotes_attributed_to_fkey(id, display_name, email), submitter:profiles!quotes_submitted_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<QuoteRow[]>();

  const roster = members ?? [];
  const quotes = (quoteRows ?? []).filter((quote) => isAdmin || !quote.hidden);

  let allMembers: MemberRow[] = [];
  if (isAdmin) {
    const { data: memberDemerits } = await supabase
      .from("profiles")
      .select("id, display_name, email, demerits")
      .order("demerits", { ascending: false })
      .order("display_name", { ascending: true })
      .returns<MemberRow[]>();
    allMembers = memberDemerits ?? [];
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold tracking-tight">Kangaroo Court</h1>
      <p className="mt-1 text-muted-foreground">
        {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} on the record.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Submit a Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitQuote} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quoteText">The Quote</Label>
              <Textarea id="quoteText" name="quoteText" placeholder="What did they say?" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attributedTo">Attributed To (optional)</Label>
              <select id="attributedTo" name="attributedTo" defaultValue="" className={selectClassName}>
                <option value="">Unknown / doesn&apos;t matter</option>
                {roster.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name ?? profile.email}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Submit to the Record
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">The Quote Book</h2>
      {quotes.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No quotes on the record yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {quotes.map((quote) => (
            <Card key={quote.id} className={quote.hidden ? "opacity-60" : undefined}>
              <CardContent className="space-y-2 pt-6 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-medium italic">&ldquo;{quote.quote_text}&rdquo;</p>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {quote.hidden && <HiddenBadge />}
                    {isAdmin && (
                      <HideToggleButton
                        table="quotes"
                        id={quote.id}
                        hidden={quote.hidden}
                        redirectTo="/frat-history/kangaroo-court"
                      />
                    )}
                  </span>
                </div>
                <p>
                  <span className="text-muted-foreground">— </span>
                  <span className="font-medium">
                    {quote.attributed?.display_name ?? quote.attributed?.email ?? "Unknown"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Submitted by {quote.submitter?.display_name ?? quote.submitter?.email ?? "Unknown"} on{" "}
                  {new Date(quote.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <h2 className="mt-10 text-lg font-semibold tracking-tight">Demerit Court</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set anyone&apos;s demerit count.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {allMembers.map((member) => (
              <Card key={member.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{member.display_name ?? member.email}</span>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        member.demerits > 0 && "text-destructive",
                      )}
                    >
                      {member.demerits}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={adjustDemerits} className="flex items-end gap-2">
                    <input type="hidden" name="profileId" value={member.id} />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor={`demerits-${member.id}`}>Demerits</Label>
                      <Input
                        id={`demerits-${member.id}`}
                        name="demerits"
                        type="number"
                        min={0}
                        defaultValue={member.demerits}
                      />
                    </div>
                    <Button type="submit">Save</Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
