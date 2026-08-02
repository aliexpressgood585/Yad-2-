"use client";

import * as React from "react";
import { History } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import { Button } from "@/components/ui/button";
import type { ListingCardDto } from "@/lib/listing-dto";
import { useRecentlyViewed } from "@/stores/recently-viewed";

/**
 * "נצפו לאחרונה" — המזהים נשמרים ב-localStorage בלבד,
 * והפרטים נטענים מהשרת רק בעת התצוגה.
 */
export function RecentlyViewed() {
  const ids = useRecentlyViewed((s) => s.ids);
  const clear = useRecentlyViewed((s) => s.clear);
  const [items, setItems] = React.useState<ListingCardDto[] | null>(null);

  React.useEffect(() => {
    if (!ids.length) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/listings/by-ids?ids=${ids.slice(0, 8).join(",")}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: ListingCardDto[] };
        if (!cancelled) setItems(data.items);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (items !== null && items.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="recent-heading" className="flex items-center gap-2 font-heading text-xl font-bold">
          <History className="size-5 text-muted-foreground" aria-hidden />
          נצפו לאחרונה
        </h2>
        <Button variant="ghost" size="sm" onClick={clear}>
          ניקוי
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items === null
          ? Array.from({ length: 4 }, (_, i) => <ListingCardSkeleton key={i} />)
          : items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} showCompare={false} />
            ))}
      </div>
    </section>
  );
}
