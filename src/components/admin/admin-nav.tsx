"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminNav({
  openReports,
  flagged,
}: {
  openReports: number;
  flagged: number;
}) {
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: "סקירה", exact: true, badge: 0 },
    { href: "/admin/metrics", label: "מדידה", badge: 0 },
    { href: "/admin/moderation", label: "תור מודרציה", badge: openReports + flagged },
    { href: "/admin/listings", label: "מודעות", badge: 0 },
    { href: "/admin/users", label: "משתמשים", badge: 0 },
    { href: "/admin/logs", label: "יומן פעולות", badge: 0 },
  ];

  return (
    <nav aria-label="ניווט בפאנל הניהול">
      <ul className="flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.badge > 0 ? (
                  <span className="num rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
