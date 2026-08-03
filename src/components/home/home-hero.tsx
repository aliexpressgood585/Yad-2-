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

const POPULAR = [
  "דירה 3 חדרים",
  "טויוטה קורולה",
  "ספה פינתית",
  "אייפון",
  "מקרר",
  "עגלת תינוק",
];

export function HomeHero({
  categories,
  totalListings,
}: {
  categories: CategoryNode[];
  totalListings: number;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");

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
            כל מה שצריך, במקום אחד נקי
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            <span className="num font-semibold text-foreground">
              {formatCount(totalListings)}
            </span>{" "}
            מודעות פעילות ברכב, נדל&quot;ן, יד שנייה ועוד — בלי באנרים מהבהבים ובלי לחכות לטעינה.
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
