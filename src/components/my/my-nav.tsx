"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageCircle,
  Heart,
  Search,
  Bell,
  UserRound,
};

export type MyNavItem = {
  href: string;
  label: string;
  icon: string;
  count: number;
  exact?: boolean;
};

/** ניווט האזור האישי — עמודה בדסקטופ, רצועה נגללת במובייל. */
export function MyNav({ items }: { items: MyNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="ניווט באזור האישי">
      <ul className="flex gap-1 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.count > 0 ? (
                  <span
                    className={cn(
                      "num rounded-full px-1.5 text-xs",
                      active ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {item.count}
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
