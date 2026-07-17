"use client";

import { Button } from "@/components/ui/button";

// The one destructive, irreversible action in the app — everything else
// (photo delete, beef squash, kick) is either instantly undoable or just a
// status flip. This is also the only native confirm() in the codebase,
// deliberately scoped to just this button.
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
