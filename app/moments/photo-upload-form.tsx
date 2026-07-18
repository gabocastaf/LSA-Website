"use client";

import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPhoto } from "./actions";

type Member = { id: string; display_name: string | null; email: string };

const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 0.85;

function isHeic(file: File) {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

async function convertToJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Conversion failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

function extractImageFile(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

export function PhotoUploadForm({ roster }: { roster: Member[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pasteBoxRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "converting" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);

  const acceptFileRef = useRef<(file: File) => void>(() => {});

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }

  async function acceptFile(file: File) {
    setError(null);

    let finalFile = file;
    if (isHeic(file)) {
      setStatus("converting");
      try {
        finalFile = await convertToJpeg(file);
      } catch {
        clearSelection();
        setStatus("idle");
        setError(
          "Couldn't read this photo format. Try again, or take a screenshot of it and upload that instead.",
        );
        return;
      }
    }

    if (inputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(finalFile);
      inputRef.current.files = dataTransfer.files;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(finalFile);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setStatus("ready");
  }

  useEffect(() => {
    acceptFileRef.current = acceptFile;
  });

  // Desktop convenience: Cmd/Ctrl+V anywhere on the page. Skip when the
  // paste box itself is the target -- its own onPaste already handles it,
  // and both firing would convert/preview the same file twice.
  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent) {
      if (pasteBoxRef.current?.contains(event.target as Node)) return;

      const file = extractImageFile(event.clipboardData?.items);
      if (file) {
        event.preventDefault();
        void acceptFileRef.current(file);
      }
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // iOS Safari only offers "Paste" from the long-press menu on a focusable,
  // editable element -- a plain `input[type=file]` or a window listener
  // never triggers it. This box exists so phones have something to long-press.
  function handleBoxPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = extractImageFile(event.clipboardData?.items);
    if (file) void acceptFile(file);
  }

  return (
    <form action={uploadPhoto} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">Photo</Label>
        <input
          ref={inputRef}
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void acceptFile(file);
          }}
          className="text-sm file:mr-3 file:h-8 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />

        <div
          ref={pasteBoxRef}
          contentEditable
          suppressContentEditableWarning
          role="button"
          aria-label="Paste a copied photo here"
          tabIndex={0}
          onPaste={handleBoxPaste}
          onBeforeInput={(event) => event.preventDefault()}
          className="relative h-14 rounded-lg border border-dashed border-input outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            contentEditable={false}
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground"
          >
            Or tap here, then paste (press and hold → Paste, or Cmd/Ctrl+V)
          </span>
        </div>

        {status === "converting" && (
          <p className="text-xs text-muted-foreground">Converting photo…</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="mt-1 h-32 w-32 rounded-lg border border-border object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="caption">Caption (optional, but recommended for context)</Label>
        <Input id="caption" name="caption" placeholder="e.g. Pedro's next AI masterclass" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Who&apos;s in this? (optional)</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {roster.map((profile) => (
            <label
              key={profile.id}
              className="flex items-center gap-1.5 text-sm font-normal"
            >
              <input type="checkbox" name="taggedProfileIds" value={profile.id} />
              {profile.display_name ?? profile.email}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full sm:w-auto" disabled={status === "converting"}>
        Add to the Gallery
      </Button>
    </form>
  );
}
