"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/app/actions";

// Events page doesn't exist yet — this is a structural placeholder
// for the next build phase and will 404 until built.
const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/roster", label: "Roster" },
  { href: "/events", label: "Events" },
  { href: "/trophy-room", label: "Trophy Cabinet" },
];

export function SiteNav({
  fratTitle,
  role,
}: {
  fratTitle: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const navLinks =
    role === "admin"
      ? [...NAV_LINKS, { href: "/admin/rush", label: "Rush" }]
      : NAV_LINKS;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="font-heading font-semibold tracking-tight">
          Ligma Sigma Alpha
        </span>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <span className="text-sm text-muted-foreground">{fratTitle}</span>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </nav>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Ligma Sigma Alpha</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                <span className="text-sm text-muted-foreground">{fratTitle}</span>
                <form action={signOut}>
                  <Button variant="outline" size="sm" type="submit" className="w-full">
                    Sign Out
                  </Button>
                </form>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
