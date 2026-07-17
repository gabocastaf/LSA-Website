import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { cn } from "@/lib/utils";
import { updateMember, kickMember, deleteMember } from "./actions";

const ROLE_OPTIONS = ["pledge", "active", "admin"] as const;
const ROLE_LABEL: Record<string, string> = {
  pledge: "Pledge",
  active: "Active",
  admin: "Admin",
};

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export default async function RushPipelinePage({
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
    .select("role, frat_title")
    .eq("id", user.id)
    .single();

  if (viewerProfile?.role !== "admin") {
    redirect("/");
  }

  const { data: pledges } = await supabase
    .from("profiles")
    .select("id, display_name, email, pledge_class")
    .eq("role", "pledge")
    .order("pledge_class", { ascending: true })
    .order("display_name", { ascending: true });

  const { data: allMembers } = await supabase
    .from("profiles")
    .select("id, display_name, email, frat_title, role, kicked")
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });

  const pledgeRoster = pledges ?? [];
  const memberRoster = allMembers ?? [];

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile.frat_title} role={viewerProfile.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Rush Pipeline</h1>
        <p className="mt-1 text-muted-foreground">
          Promote pledges to Active and assign their frat title.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold tracking-tight">
          Pledges Awaiting Promotion
        </h2>
        {pledgeRoster.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No pledges left to promote.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {pledgeRoster.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <CardTitle>{profile.display_name ?? profile.email}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={updateMember} className="flex flex-col gap-3">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="role" value="active" />
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`frat_title-${profile.id}`}>Frat Title</Label>
                      <Input
                        id={`frat_title-${profile.id}`}
                        name="frat_title"
                        placeholder="e.g. Grand Vizier of Vibes"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pledge Class: {profile.pledge_class ?? "—"}
                    </p>
                    <Button type="submit" className="w-full">
                      Promote to Active
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mt-10 text-lg font-semibold tracking-tight">
          Chapter Hierarchy
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Change anyone&apos;s rank or frat title on the fly.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {memberRoster.map((profile) => {
            const isSelf = profile.id === user.id;
            return (
              <Card key={profile.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>{profile.display_name ?? profile.email}</span>
                    {isSelf && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    )}
                    {profile.kicked && (
                      <span className="inline-flex w-fit items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Excommunicated
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <form action={updateMember} className="flex flex-col gap-3">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`frat_title-all-${profile.id}`}>Frat Title</Label>
                      <Input
                        id={`frat_title-all-${profile.id}`}
                        name="frat_title"
                        defaultValue={profile.frat_title}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`role-${profile.id}`}>Role</Label>
                      {isSelf ? (
                        <p className="text-sm text-muted-foreground">
                          {ROLE_LABEL[profile.role] ?? profile.role} — change your own
                          role in Supabase directly to avoid locking yourself out.
                        </p>
                      ) : (
                        <select
                          id={`role-${profile.id}`}
                          name="role"
                          defaultValue={profile.role}
                          className={selectClassName}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Button type="submit" className="w-full">
                      Save
                    </Button>
                  </form>

                  {isSelf ? (
                    <p className="text-xs text-muted-foreground">
                      Kicking and account deletion aren&apos;t available on your own
                      account, for the same reason — use Supabase directly if you ever
                      need to.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 border-t pt-3">
                      <form action={kickMember}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <input
                          type="hidden"
                          name="kicked"
                          value={(!profile.kicked).toString()}
                        />
                        <Button
                          type="submit"
                          variant={profile.kicked ? "secondary" : "outline"}
                          size="sm"
                          className={cn(
                            "w-full",
                            !profile.kicked &&
                              "border-destructive/40 text-destructive hover:bg-destructive/10",
                          )}
                        >
                          {profile.kicked ? "Let Them Back In" : "Kick to the Curb"}
                        </Button>
                      </form>
                      <form action={deleteMember} className="[&>*]:w-full">
                        <input type="hidden" name="profileId" value={profile.id} />
                        <DeleteAccountButton
                          name={profile.display_name ?? profile.email}
                        />
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
