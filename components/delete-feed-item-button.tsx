"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteFeedItem } from "@/app/actions";

// Only rendered by callers once an item is already hidden — the server
// action re-checks that itself, so this is a UI convenience, not the guard.
export function DeleteFeedItemButton({
  table,
  id,
  storagePath,
  redirectTo,
  itemLabel,
}: {
  table: string;
  id: string;
  storagePath?: string | null;
  redirectTo: string;
  itemLabel: string;
}) {
  return (
    <form action={deleteFeedItem}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      {storagePath && <input type="hidden" name="storagePath" value={storagePath} />}
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        type="submit"
        variant="destructive"
        size="icon-sm"
        aria-label="Delete permanently"
        onClick={(e) => {
          if (
            !window.confirm(`Permanently delete ${itemLabel}? This can't be undone.`)
          ) {
            e.preventDefault();
          }
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}
