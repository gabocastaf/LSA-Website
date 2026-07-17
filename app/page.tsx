import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, frat_title, pledge_class, role, demerits")
    .eq("id", user.id)
    .single();

  const fratTitle = profile?.frat_title ?? "Pledge";
  const displayName = profile?.display_name ?? user.email;

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={fratTitle} role={profile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {displayName}</h1>
        <p className="mt-1 text-muted-foreground">
          {profile?.role === "pledge"
            ? "You're still a Pledge. An Active member needs to vouch for you before you get full access to the chapter house."
            : "You have full Active access to the chapter house."}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Frat Title</CardTitle>
              <CardDescription>Your current standing</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{fratTitle}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pledge Class</CardTitle>
              <CardDescription>When you joined the ranks</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {profile?.pledge_class ?? "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Demerits</CardTitle>
              <CardDescription>Kangaroo Court is watching</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {profile?.demerits ?? 0}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
