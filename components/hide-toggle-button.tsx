import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleHide } from "@/app/actions";

// Admin-only reversible show/hide toggle, reused across the dashboard feed
// and every dedicated page (Events, Photo Gallery, etc.) that has its own
// query over one of the feed tables.
export function HideToggleButton({
  table,
  id,
  hidden,
  redirectTo,
}: {
  table: string;
  id: string;
  hidden: boolean;
  redirectTo: string;
}) {
  return (
    <form action={toggleHide}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hidden" value={(!hidden).toString()} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={hidden ? "Unhide" : "Hide"}
      >
        {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </Button>
    </form>
  );
}

export function HiddenBadge() {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Hidden
    </span>
  );
}
