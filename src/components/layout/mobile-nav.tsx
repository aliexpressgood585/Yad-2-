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

type NavCategory = { id: string; slug: string; name: string; icon: string };

const SECONDARY_LINKS = [
  { href: "/map", label: "תצוגת מפה" },
  { href: "/search", label: "חיפוש מתקדם" },
  { href: "/my/favorites", label: "מועדפים" },
  { href: "/my/searches", label: "חיפושים שמורים" },
  { href: "/compare", label: "השוואת מודעות" },
  { href: "/help", label: "עזרה ובטיחות" },
];

export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // סגירת התפריט בכל ניווט
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="פתיחת התפריט">
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <SheetContent side="start" className="overflow-y-auto">
        <DialogTitle asChild>
          <div className="pb-1">
            <Logo href={null} />
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">תפריט ניווט ראשי</DialogDescription>

        <nav aria-label="קטגוריות" className="flex flex-col gap-0.5">
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

        <nav aria-label="קישורים נוספים" className="flex flex-col gap-0.5">
          {SECONDARY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Button asChild className="mt-auto" size="lg">
          <Link href="/publish">פרסום מודעה חינם</Link>
        </Button>
      </SheetContent>
    </Dialog>
  );
}
