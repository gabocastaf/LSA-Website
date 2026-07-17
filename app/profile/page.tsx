import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateDisplayName } from "./actions";

type NamedProfile = { display_name: string | null; email: string | null } | null;

function name(profile: NamedProfile) {
  return profile?.display_name ?? profile?.email ?? "Unknown";
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mt-10 flex items-baseline justify-between">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
        View all →
      </Link>
    </div>
  );
}

type BeefRow = {
  id: string;
  title: string;
  status: "active" | "squashed";
  created_at: string;
  creator: NamedProfile;
};

type AwardRow = {
  id: string;
  title: string;
  reason: string | null;
  created_at: string;
  giver: NamedProfile;
};

type QuoteRow = {
  id: string;
  quote_text: string;
  created_at: string;
  submitter: NamedProfile;
};

type PhotoTagRow = {
  id: string;
  photo: { id: string; storage_path: string; caption: string | null } | null;
};

export default async function ProfilePage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, frat_title, role, pledge_class")
    .eq("id", user.id)
    .single();

  const [
    { data: nemesisRows },
    { data: awardRows },
    { data: quoteRows },
    { data: photoTagRows },
  ] = await Promise.all([
    supabase
      .from("beefs")
      .select(
        "id, title, status, created_at, creator:profiles!beefs_created_by_fkey(display_name, email)",
      )
      .eq("target_profile_id", user.id)
      .order("created_at", { ascending: false })
      .returns<BeefRow[]>(),
    supabase
      .from("awards")
      .select(
        "id, title, reason, created_at, giver:profiles!awards_given_by_fkey(display_name, email)",
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .returns<AwardRow[]>(),
    supabase
      .from("quotes")
      .select(
        "id, quote_text, created_at, submitter:profiles!quotes_submitted_by_fkey(display_name, email)",
      )
      .eq("attributed_to", user.id)
      .order("created_at", { ascending: false })
      .returns<QuoteRow[]>(),
    supabase
      .from("photo_tags")
      .select("id, photo:photos(id, storage_path, caption)")
      .eq("profile_id", user.id)
      .returns<PhotoTagRow[]>(),
  ]);

  const nemeses = nemesisRows ?? [];
  const awards = awardRows ?? [];
  const quotes = quoteRows ?? [];
  const photoTags = (photoTagRows ?? []).filter((tag) => tag.photo !== null);

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={profile?.frat_title ?? "Pledge"} role={profile?.role} />
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Change what everyone else has to call you.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Display Name</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateDisplayName} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="display_name">Name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={profile?.display_name ?? ""}
                  placeholder="What do we call you"
                  maxLength={40}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This is what shows up on the Roster, the feed, and the Thread —
                  everywhere except official punishment records.
                </p>
              </div>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Everything Else</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{profile?.email ?? user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frat Title</span>
              <span className="font-medium">{profile?.frat_title ?? "Pledge"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pledge Class</span>
              <span className="font-medium">{profile?.pledge_class ?? "—"}</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Only an admin can change these — bribe accordingly.
            </p>
          </CardContent>
        </Card>

        <SectionHeading title="My Nemeses" href="/frat-history/beef-tracker" />
        {nemeses.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            No beef. Suspiciously well-liked.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {nemeses.map((beef) => (
              <Card key={beef.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{beef.title}</span>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        beef.status === "active"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {beef.status === "active" ? "Active" : "Squashed"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Started by {name(beef.creator)} on{" "}
                  {new Date(beef.created_at).toLocaleDateString()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <SectionHeading title="Trophies I've Won" href="/frat-history/trophy-room" />
        {awards.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Nobody&apos;s given you a trophy. Ouch.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {awards.map((award) => (
              <Card key={award.id}>
                <CardHeader>
                  <CardTitle>{award.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {award.reason && (
                    <p className="text-muted-foreground italic">&ldquo;{award.reason}&rdquo;</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Awarded by {name(award.giver)} on{" "}
                    {new Date(award.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <SectionHeading title="Quotes Attributed to Me" href="/frat-history/kangaroo-court" />
        {quotes.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Nothing on the record. Keep it that way.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {quotes.map((quote) => (
              <Card key={quote.id}>
                <CardContent className="space-y-1 pt-6 text-sm">
                  <p className="font-medium italic">&ldquo;{quote.quote_text}&rdquo;</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by {name(quote.submitter)} on{" "}
                    {new Date(quote.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <SectionHeading title="Photos I'm In" href="/frat-history/photo-gallery" />
        {photoTags.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            No photographic evidence. Keep it that way.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photoTags.map((tag) => {
              const photo = tag.photo!;
              const { data: publicUrlData } = supabase.storage
                .from("photos")
                .getPublicUrl(photo.storage_path);
              return (
                <Card key={tag.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrlData.publicUrl}
                    alt={photo.caption ?? "Chapter photo"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
