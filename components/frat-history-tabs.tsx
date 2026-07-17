"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/frat-history/trophy-room", label: "Trophy Cabinet" },
  { href: "/frat-history/beef-tracker", label: "Beef Tracker" },
  { href: "/frat-history/kangaroo-court", label: "Kangaroo Court" },
  { href: "/frat-history/photo-gallery", label: "Photo Gallery" },
  { href: "/frat-history/soundboard", label: "Soundboard" },
];

export function FratHistoryTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b">
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {TABS.map((tab) => (
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
