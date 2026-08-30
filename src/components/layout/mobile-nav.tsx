"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  SheetContent,
} from "@/components/ui/dialog";
import { CategoryIcon } from "@/components/category-icon";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";

type NavCategory = { id: string; slug: string; name: string; icon: string };

const SECONDARY_LINKS: { href: string; label: MessageKey }[] = [
  { href: "/map", label: "chrome.mapView" },
  { href: "/search", label: "nav.advancedSearch" },
  { href: "/my/favorites", label: "nav.favorites" },
  { href: "/my/searches", label: "nav.savedSearches" },
  { href: "/compare", label: "nav.compare" },
  { href: "/help", label: "nav.helpAndSafety" },
];

export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { t } = useT();

  // סגירת התפריט בכל ניווט
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.openMenu")}>
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <SheetContent side="start" className="overflow-y-auto">
        <DialogTitle asChild>
          <div className="pb-1">
            <Logo href={null} />
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">{t("nav.mainMenu")}</DialogDescription>

        <nav aria-label={t("chrome.categories")} className="flex flex-col gap-0.5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <CategoryIcon name={c.icon} className="size-5 text-primary" />
              {c.name}
            </Link>
          ))}
        </nav>

        <Separator />

        <nav aria-label={t("nav.moreLinks")} className="flex flex-col gap-0.5">
          {SECONDARY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>

        <Button asChild className="mt-auto" size="lg">
          <Link href="/publish">{t("nav.publishFree")}</Link>
        </Button>
      </SheetContent>
    </Dialog>
  );
}
