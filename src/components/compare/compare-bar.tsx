"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCompare } from "@/stores/compare";
import { MAX_COMPARE } from "@/lib/site";

/** רצועה צפה שמופיעה כשנבחרו מודעות להשוואה. */
export function CompareBar() {
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // בדף ההשוואה עצמו הרצועה מיותרת
  if (!mounted || !items.length || pathname === "/compare") return null;

  return (
    <div className="fixed inset-x-0 bottom-14 z-30 md:bottom-4">
      <div className="container">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <Scale className="size-5 shrink-0 text-primary" aria-hidden />

          <ul className="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
            {items.map((item) => (
              <li key={item.id} className="relative shrink-0">
                <div className="relative size-12 overflow-hidden rounded-md bg-muted">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized={item.image.startsWith("/uploads")}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`הסרת ${item.title} מההשוואה`}
                  className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <span className="num hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {items.length}/{MAX_COMPARE}
          </span>

          <Button asChild size="sm" className="shrink-0">
            <Link href="/compare">להשוואה</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            aria-label="ניקוי ההשוואה"
            className="shrink-0"
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
