"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function BusinessTabs({
  canImport,
  canManageTeam,
}: {
  canImport: boolean;
  canManageTeam: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/my/business", label: "ביצועי המלאי", exact: true, show: true },
    { href: "/my/business/import", label: "העלאה מרוכזת", show: canImport },
    { href: "/my/business/feeds", label: "פידים", show: canImport },
    { href: "/my/business/team", label: "צוות", show: canManageTeam },
  ].filter((t) => t.show);

  return (
    <nav aria-label="ניווט בכלים לעסק">
      <ul className="flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
