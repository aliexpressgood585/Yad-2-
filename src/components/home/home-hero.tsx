"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryNode } from "@/lib/categories";
import { formatCount } from "@/lib/format";
import type { Inventory } from "@/lib/inventory";
import type { MarketTick } from "@/lib/market-ticks";

const POPULAR = [
  "דירה 3 חדרים",
  "טויוטה קורולה",
  "ספה פינתית",
  "אייפון",
  "מקרר",
  "עגלת תינוק",
];

/** כמה זמן כל קריאה נשארת על המסך. */
const TICK_MS = 5000;

export function HomeHero({
  categories,
  inventory,
  ticks,
}: {
  categories: CategoryNode[];
  inventory: Inventory;
  ticks: MarketTick[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [tick, setTick] = React.useState(0);

  /*
   * ההחלפה נעצרת כשהמשתמש ביקש פחות תנועה. קריאה שמתחלפת לבדה היא
   * בדיוק הדפוס ש-`prefers-reduced-motion` נועד לעצור, ואז נשארת
   * הראשונה — היא לא פחות נכונה מהאחרות.
   */
  React.useEffect(() => {
    if (ticks.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => (t + 1) % ticks.length), TICK_MS);
    return () => clearInterval(id);
  }, [ticks.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (category !== "all") sp.set("category", category);
    router.push(`/search?${sp.toString()}`);
  }

  return (
    <section className="border-b border-border bg-gradient-to-b from-primary-soft/70 to-background">
      <div className="container py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-5xl">
            עכשיו אתה יודע
          </h1>

          {/*
           * קריאות אמיתיות מהמודעות הפעילות ברגע זה, לא סלוגן.
           *
           * `aria-live="off"` בכוונה: זו תצוגה מתחלפת ולא עדכון שדורש
           * הכרזה, והכרזה כל חמש שניות הופכת את הדף לבלתי שמיש בקורא
           * מסך. הגובה קבוע כדי שהחלפה לא תזיז את תיבת החיפוש.
           */}
          {ticks.length ? (
            <p
              aria-live="off"
              className="mx-auto mt-4 flex min-h-[3.25rem] max-w-xl flex-col items-center justify-center gap-0.5 text-pretty sm:min-h-[2.5rem] sm:flex-row sm:gap-2"
            >
              <span className="text-sm text-muted-foreground">{ticks[tick]!.subject}</span>
              <span className="num text-lg font-semibold text-foreground">
                {ticks[tick]!.value}
              </span>
              <span className="text-xs text-muted-foreground">{ticks[tick]!.note}</span>
            </p>
          ) : null}

          {/*
           * המונה מוצג רק כשיש מה למנות.
           *
           * מספר מנופח הוא השקר הראשון שמשתמש תופס, כי הוא סופר בעצמו
           * את מה שעל המסך — ובלוח חדש "42 מודעות" עובד נגדנו גם כשהוא
           * נכון. מתחת לסף נשארת אותה שורה בלי המספר: היא עדיין אומרת
           * מה יש בלוח.
           */}
          <p className="mx-auto mt-2 max-w-xl text-pretty text-sm text-muted-foreground">
            {inventory.counter ? (
              <>
                <span className="num font-semibold text-foreground">
                  {formatCount(inventory.total)}
                </span>{" "}
                מודעות פעילות ברכב, נדל&quot;ן, יד שנייה ועוד — כל אחת עם הקריאה שלה מול השוק.
              </>
            ) : (
              <>רכב, נדל&quot;ן, יד שנייה ועוד — כל מודעה עם הקריאה שלה מול השוק.</>
            )}
          </p>

          {/* נקודת הייחוס שההדר מודד מולה — ראה HeaderSearchSlot */}
          <form
            id="hero-search-anchor"
            role="search"
            onSubmit={submit}
            className="mt-6 flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:flex-row"
          >
            <label htmlFor="hero-search" className="sr-only">
              מה מחפשים?
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="hero-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="מה מחפשים היום?"
                className="h-12 w-full rounded-lg bg-transparent ps-9 pe-3 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 sm:w-48" aria-label="בחירת קטגוריה">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" size="lg" className="h-12 px-8">
              חיפוש
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm">
            <span className="text-muted-foreground">מחפשים עכשיו:</span>
            {POPULAR.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>

        {/* רצועת קטגוריות מהירה — מובייל */}
        <ul className="mt-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:hidden">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${c.slug}`}
                className="flex w-20 flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2 text-center"
              >
                <CategoryIcon name={c.icon} className="size-5 text-primary" />
                <span className="text-[11px] font-medium leading-tight">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
