import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, rankBadgeClass } from "@/lib/rank";

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
        rankBadgeClass(role),
      )}
    >
      {ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}
    </span>
  );
}

export default async function RosterPage() {
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, pledge_class, frat_title, role, demerits")
    .order("pledge_class", { ascending: true })
    .order("display_name", { ascending: true });

  const roster = profiles ?? [];

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Frat Roster</h1>
        <p className="mt-1 text-muted-foreground">
          {roster.length} {roster.length === 1 ? "brother" : "brothers"} in the chapter.
        </p>

        {/* Mobile: stacked cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:hidden">
          {roster.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{profile.display_name ?? profile.email}</span>
                  <RoleBadge role={profile.role} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frat Title</span>
                  <span className="font-medium">{profile.frat_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pledge Class</span>
                  <span className="font-medium">{profile.pledge_class ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Demerits</span>
                  <span
                    className={cn(
                      "font-medium",
                      profile.demerits > 0 && "text-destructive",
                    )}
                  >
                    {profile.demerits}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-6 hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Frat Title</th>
                <th className="px-4 py-3 font-medium">Pledge Class</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Demerits</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((profile) => (
                <tr key={profile.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {profile.display_name ?? profile.email}
                  </td>
                  <td className="px-4 py-3">{profile.frat_title}</td>
                  <td className="px-4 py-3">{profile.pledge_class ?? "—"}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={profile.role} />
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium",
                      profile.demerits > 0 && "text-destructive",
                    )}
                  >
                    {profile.demerits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {roster.length === 0 && (
          <p className="mt-6 text-muted-foreground">No brothers found.</p>
        )}
      </main>
    </div>
  );
}
