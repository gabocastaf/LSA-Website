"use client";

import { Button } from "@/components/ui/button";

// One of a small set of irreversible actions in the app (see also
// deleteFeedItem in app/actions.ts, gated to already-hidden feed items).
// Uses a native confirm() like those do, deliberately scoped to just this
// button.
export function DeleteAccountButton({ name }: { name: string }) {
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      onClick={(e) => {
        if (
          !window.confirm(
            `Permanently delete ${name}'s account? Their trophies, quotes, and everything else they made stay — just their login goes.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Delete Account
    </Button>
  );
}
