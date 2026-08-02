"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * תיבת החיפוש הראשית בכותרת. שולחת ל-/search עם פרמטר q.
 * עטופה ב-Suspense (ראה `HeaderSearch`) כי היא קוראת ל-useSearchParams.
 */
function HeaderSearchInner({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = React.useState(params.get("q") ?? "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // שמירה על סנכרון כשמנווטים בין דפי תוצאות
  React.useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  // קיצור מקלדת: "/" ממקד את שדה החיפוש
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn("relative flex items-center", className)}
    >
      <label htmlFor="site-search" className="sr-only">
        חיפוש מודעות
      </label>
      <Search
        className="pointer-events-none absolute start-3 size-4 text-muted-foreground"
        aria-hidden
      />
      <input
        id="site-search"
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="מה מחפשים? רכב, דירה, ספה…"
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-muted/50 ps-9 pe-24 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute end-[4.75rem] rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">ניקוי החיפוש</span>
        </button>
      ) : null}
      <Button type="submit" size="sm" className="absolute end-1 h-8">
        חיפוש
      </Button>
    </form>
  );
}

/** שלד סטטי — מוצג עד שה-Suspense נפתר. */
function HeaderSearchFallback({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center", className)} aria-hidden>
      <Search className="pointer-events-none absolute start-3 size-4 text-muted-foreground" />
      <div className="h-10 w-full rounded-lg border border-input bg-muted/50" />
    </div>
  );
}

export function HeaderSearch({ className }: { className?: string }) {
  return (
    <React.Suspense fallback={<HeaderSearchFallback className={className} />}>
      <HeaderSearchInner className={className} />
    </React.Suspense>
  );
}
