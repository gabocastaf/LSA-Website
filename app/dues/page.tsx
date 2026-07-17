import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { logDuesPayment } from "./actions";

type DuesRow = {
  id: string;
  description: string;
  amount: number;
  created_at: string;
  paid_by: string | null;
  payer: { id: string; display_name: string | null; email: string } | null;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function DuesPage({
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

  const { data: duesRows } = await supabase
    .from("dues")
    .select(
      "id, description, amount, created_at, paid_by, payer:profiles!dues_paid_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<DuesRow[]>();

  const dues = duesRows ?? [];
  const totalCollected = dues.reduce((sum, due) => sum + Number(due.amount), 0);

  const totalsByMember = new Map<string, { name: string; total: number }>();
  for (const due of dues) {
    if (!due.paid_by) continue;
    const name = due.payer?.display_name ?? due.payer?.email ?? "Unknown";
    const existing = totalsByMember.get(due.paid_by);
    totalsByMember.set(due.paid_by, {
      name,
      total: (existing?.total ?? 0) + Number(due.amount),
    });
  }
  const memberTotals = Array.from(totalsByMember.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen">
      <SiteNav fratTitle={viewerProfile?.frat_title ?? "Pledge"} role={viewerProfile?.role} />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold tracking-tight">Chapter Dues</h1>
        <p className="mt-1 text-muted-foreground">
          {currency.format(totalCollected)} collected so far. The house doesn&apos;t run on vibes alone.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Log a Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={logDuesPayment} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">What&apos;s this for</Label>
                <Input id="description" name="description" placeholder="e.g. Spring dues, allegedly" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                I Paid It (Trust Me)
              </Button>
            </form>
          </CardContent>
        </Card>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Dues by Member</h2>
        {memberTotals.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nobody has paid anything. Bold strategy.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {memberTotals.map((member) => (
              <Card key={member.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{member.name}</span>
                    <span className="text-sm font-semibold">{currency.format(member.total)}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Recent Payments</h2>
        {dues.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No payments logged yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Paid By</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((due) => (
                  <tr key={due.id} className="border-t">
                    <td className="px-4 py-3">{due.description}</td>
                    <td className="px-4 py-3">
                      {due.payer?.display_name ?? due.payer?.email ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(due.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {currency.format(Number(due.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
