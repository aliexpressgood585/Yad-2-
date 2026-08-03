import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { HeaderSearchSlot } from "@/components/layout/header-search-slot";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { getRootCategories } from "@/lib/categories";
import { Plus } from "lucide-react";

export async function SiteHeader() {
  const roots = await getRootCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-14 items-center gap-3">
        <MobileNav categories={roots} />
        <Logo />

        <HeaderSearchSlot className="hidden flex-1 md:block" inputId="site-search" />

        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <ThemeToggle />
          <HeaderUserMenu />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/publish">
              <Plus aria-hidden />
              פרסום מודעה
            </Link>
          </Button>
        </div>
      </div>

      {/* רצועת קטגוריות ראשיות — דסקטופ */}
      <nav
        aria-label="קטגוריות ראשיות"
        className="hidden border-t border-border/60 md:block"
      >
        <div className="container flex h-11 items-center gap-1 overflow-x-auto no-scrollbar">
          {roots.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href="/map"
            className="ms-auto whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            תצוגת מפה
          </Link>
        </div>
      </nav>

      {/* חיפוש במובייל */}
      <HeaderSearchSlot className="container pb-3 md:hidden" inputId="site-search-mobile" />
    </header>
  );
}
