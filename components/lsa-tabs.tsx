"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const BASE_TABS = [
  { href: "/frat-history/roster", label: "Roster" },
  { href: "/frat-history/dues", label: "Dues" },
];

const ADMIN_TAB = { href: "/frat-history/admin", label: "Admin" };

export function LsaTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <div className="border-b">
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === tab.href
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
