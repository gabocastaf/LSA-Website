import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HideToggleButton, HiddenBadge } from "@/components/hide-toggle-button";
import { uploadSound, deleteSound } from "./actions";

type SoundRow = {
  id: string;
  storage_path: string;
  title: string;
  created_at: string;
  hidden: boolean;
  uploaded_by: string | null;
  uploader: { id: string; display_name: string | null; email: string } | null;
};

export default async function SoundboardPage({
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

  const { data: soundRows } = await supabase
    .from("sounds")
    .select(
      "id, storage_path, title, created_at, hidden, uploaded_by, uploader:profiles!sounds_uploaded_by_fkey(id, display_name, email)",
    )
    .order("created_at", { ascending: false })
    .returns<SoundRow[]>();

  const sounds = (soundRows ?? []).filter((sound) => isAdmin || !sound.hidden);

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold tracking-tight">Soundboard</h1>
      <p className="mt-1 text-muted-foreground">
        Every regrettable quote, immortalized in low-quality audio.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Add to the Rotation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadSound} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">What do we call this one</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Moan #4"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">Audio Clip</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,audio/x-m4a"
                required
                className="text-sm file:mr-3 file:h-8 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:text-sm file:font-medium file:text-secondary-foreground"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Load It Up
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">The Rotation</h2>
      {sounds.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          No clips yet. Suspiciously quiet in here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sounds.map((sound) => {
            const { data: publicUrlData } = supabase.storage
              .from("sounds")
              .getPublicUrl(sound.storage_path);
            const isOwner = sound.uploaded_by === user.id;

            return (
              <Card key={sound.id} className={sound.hidden ? "opacity-60" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{sound.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {sound.hidden && <HiddenBadge />}
                      {isAdmin && (
                        <HideToggleButton
                          table="sounds"
                          id={sound.id}
                          hidden={sound.hidden}
                          redirectTo="/frat-history/soundboard"
                        />
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <audio controls preload="none" className="w-full" src={publicUrlData.publicUrl}>
                    Your browser doesn&apos;t support audio, which is honestly for the best.
                  </audio>
                  <p className="text-xs text-muted-foreground">
                    {sound.uploader?.display_name ?? sound.uploader?.email ?? "Unknown"} ·{" "}
                    {new Date(sound.created_at).toLocaleDateString()}
                  </p>
                  {isOwner && (
                    <form action={deleteSound}>
                      <input type="hidden" name="soundId" value={sound.id} />
                      <input type="hidden" name="storagePath" value={sound.storage_path} />
                      <Button type="submit" variant="destructive" size="sm">
                        Delete
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
