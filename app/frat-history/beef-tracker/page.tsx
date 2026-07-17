import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBeef, toggleBeefStatus } from "./actions";

type BeefRow = {
  id: string;
  title: string;
  target: string | null;
  reason: string | null;
  status: "active" | "squashed";
  created_at: string;
  created_by: string | null;
  creator: { id: string; display_name: string | null; email: string } | null;
};

function StatusBadge({ status }: { status: "active" | "squashed" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active" && "bg-destructive/10 text-destructive",
        status === "squashed" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "active" ? "Active" : "Squashed"}
    </span>
  );
}

export default async function BeefTrackerPage({
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

  const { data: beefRows } = await supabase
    .from("beefs")
    .select(
      "id, title, target, reason, status, created_at, created_by, creator:profiles!beefs_created_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<BeefRow[]>();

  const beefs = beefRows ?? [];
  const activeBeefs = beefs.filter((beef) => beef.status === "active");
  const squashedBeefs = beefs.filter((beef) => beef.status === "squashed");

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold tracking-tight">Beef Tracker</h1>
      <p className="mt-1 text-muted-foreground">
        {activeBeefs.length} active {activeBeefs.length === 1 ? "beef" : "beefs"}, {squashedBeefs.length} squashed.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Start a Beef</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBeef} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">What&apos;s the beef</Label>
              <Input id="title" name="title" placeholder="e.g. He never returns the aux cord" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target">Who or what it&apos;s with (optional)</Label>
              <Input id="target" name="target" placeholder="e.g. the guy from 3B" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Details (optional)</Label>
              <Textarea id="reason" name="reason" placeholder="Give us the full story" />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Start Beef
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Active Beefs</h2>
      {activeBeefs.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No active beefs. Peace in the chapter house.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {activeBeefs.map((beef) => (
            <BeefCard key={beef.id} beef={beef} viewerId={user.id} />
          ))}
        </div>
      )}

      {squashedBeefs.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold tracking-tight">Squashed Beefs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {squashedBeefs.map((beef) => (
              <BeefCard key={beef.id} beef={beef} viewerId={user.id} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function BeefCard({ beef, viewerId }: { beef: BeefRow; viewerId: string }) {
  const isOwner = beef.created_by === viewerId;
  const nextStatus = beef.status === "active" ? "squashed" : "active";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{beef.title}</span>
          <StatusBadge status={beef.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {beef.target && (
          <p>
            <span className="text-muted-foreground">With: </span>
            <span className="font-medium">{beef.target}</span>
          </p>
        )}
        {beef.reason && <p className="text-muted-foreground italic">&ldquo;{beef.reason}&rdquo;</p>}
        <p className="text-xs text-muted-foreground">
          Started by {beef.creator?.display_name ?? beef.creator?.email ?? "Unknown"} on{" "}
          {new Date(beef.created_at).toLocaleDateString()}
        </p>
        {isOwner && (
          <form action={toggleBeefStatus} className="pt-1">
            <input type="hidden" name="beefId" value={beef.id} />
            <input type="hidden" name="nextStatus" value={nextStatus} />
            <Button type="submit" variant={beef.status === "active" ? "secondary" : "outline"} size="sm">
              {beef.status === "active" ? "Squash It" : "Reopen"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
