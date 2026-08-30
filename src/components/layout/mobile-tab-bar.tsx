"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, MessageCircle, PlusCircle, Search } from "lucide-react";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import { cn } from "@/lib/utils";

/*
 * התוויות הן מפתחות ולא טקסט. המערך יושב ברמת המודול ומחושב פעם אחת
 * לתהליך, ולכן טקסט מתורגם בתוכו היה נקבע לפי השפה של הבקשה הראשונה.
 */
const TABS: { href: string; label: MessageKey; icon: typeof Home; exact?: boolean; highlight?: boolean }[] = [
  { href: "/", label: "tabBar.home", icon: Home, exact: true },
  { href: "/search", label: "tabBar.search", icon: Search },
  { href: "/publish", label: "tabBar.publish", icon: PlusCircle, highlight: true },
  { href: "/my/favorites", label: "tabBar.favorites", icon: Heart },
  { href: "/my/messages", label: "tabBar.messages", icon: MessageCircle },
];

/** סרגל ניווט תחתון — מובייל בלבד. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useT();

  // מוסתר במסכים שבהם הוא מפריע (אשף פרסום, צ'אט פתוח)
  if (/^\/(publish|admin)(\/|$)/.test(pathname) || /^\/my\/messages\/./.test(pathname)) {
    return null;
  }

  return (
    <nav
      aria-label={t("tabBar.quickNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", tab.highlight && "size-7 text-primary")}
                  aria-hidden
                />
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
