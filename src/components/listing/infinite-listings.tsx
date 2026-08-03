"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import { densityClass } from "@/components/listing/listing-grid";
import { useDensity } from "@/stores/density";
import { Button } from "@/components/ui/button";
import type { ListingCardDto } from "@/lib/listing-dto";
import { formatCount } from "@/lib/format";

type Props = {
  /** העמוד הראשון, מרונדר בשרת */
  initialItems: ListingCardDto[];
  initialHasMore: boolean;
  total: number;
  /** slug של הקטגוריה לצמצום החיפוש (אם קיים) */
  categorySlug?: string;
};

/**
 * גלילה אינסופית מעל התוצאות שרונדרו בשרת.
 * העמוד הראשון מגיע כ-HTML (טוב ל-LCP ול-SEO), והבאים נטענים ב-fetch.
 */
export function InfiniteListings({
  initialItems,
  initialHasMore,
  total,
  categorySlug,
}: Props) {
  // הצפיפות נקראת כאן ולא מגיעה כ-prop: היא העדפה של המשתמש ולא של
  // המסך, והרכיב הזה ממילא רץ בלקוח. ה-slug נמסר כדי שההעדפה שנלמדה
  // לקטגוריה הזו תגבר על הגלובלית.
  const { density } = useDensity(categorySlug);
  const searchParams = useSearchParams();
  const key = searchParams.toString();

  const [items, setItems] = React.useState(initialItems);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);

  // כשמשתנים הפילטרים, השרת מספק עמוד ראשון חדש — מאתחלים את המצב
  React.useEffect(() => {
    setItems(initialItems);
    setPage(1);
    setHasMore(initialHasMore);
    setError(false);
  }, [initialItems, initialHasMore, key]);

  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const sp = new URLSearchParams(key);
      sp.set("page", String(page + 1));
      if (categorySlug) sp.set("category", categorySlug);

      const res = await fetch(`/api/search?${sp.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        items: ListingCardDto[];
        hasMore: boolean;
      };

      setItems((prev) => {
        // הגנה מפני כפילויות כשמודעה חדשה נוספת בין הבקשות
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, key, page, categorySlug]);

  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <>
      <div className={densityClass(density)}>
        {items.map((listing, i) => (
          <ListingCard key={listing.id} listing={listing} density={density} priority={i < 4} />
        ))}
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <ListingCardSkeleton key={`sk-${i}`} density={density} />
            ))
          : null}
      </div>

      <div ref={sentinel} className="h-px" aria-hidden />

      <div
        className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            טוען עוד מודעות…
          </span>
        ) : error ? (
          <>
            <p>טעינת המודעות הנוספות נכשלה.</p>
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              ניסיון נוסף
            </Button>
          </>
        ) : hasMore ? (
          <Button variant="outline" onClick={() => void loadMore()}>
            טעינת מודעות נוספות
          </Button>
        ) : items.length ? (
          <p>
            הוצגו כל <span className="num">{formatCount(total)}</span> התוצאות
          </p>
        ) : null}
      </div>
    </>
  );
}
