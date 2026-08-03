"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import {
  FilterPanel,
  type CityFacet,
  type ValueFacets,
} from "@/components/filters/filter-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  SheetContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ResolvedAttribute } from "@/lib/categories";
import { countActiveFilters, parseFilters } from "@/lib/filters";
import { formatCount } from "@/lib/format";

type Props = {
  attributes: ResolvedAttribute[];
  cityFacets: CityFacet[];
  priceRange: { min: number; max: number; median: number } | null;
  priceLabel?: string;
  categorySlug?: string;
  valueFacets?: ValueFacets;
  /** מספר התוצאות ההתחלתי, מהשרת */
  initialTotal: number;
};

/** פאנל הסינון במובייל, עם ספירת תוצאות חיה בכפתור התחתון. */
export function MobileFilterSheet({
  attributes,
  cityFacets,
  priceRange,
  priceLabel,
  categorySlug,
  valueFacets,
  initialTotal,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const key = searchParams.toString();

  const [total, setTotal] = React.useState(initialTotal);
  const [counting, setCounting] = React.useState(false);
  const activeCount = countActiveFilters(parseFilters(Object.fromEntries(searchParams)));

  // ספירה חיה — מתעדכנת בכל שינוי פילטר בזמן שהמגירה פתוחה
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCounting(true);
      try {
        const sp = new URLSearchParams(key);
        sp.set("countOnly", "1");
        if (categorySlug) sp.set("category", categorySlug);
        const res = await fetch(`/api/search?${sp.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { total: number };
          setTotal(data.total);
        }
      } catch {
        // ביטול בקשה בעקבות שינוי מהיר — לא שגיאה אמיתית
      } finally {
        setCounting(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, open, categorySlug]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal aria-hidden />
          סינון
          {activeCount > 0 ? (
            <Badge variant="default" className="num">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>

      <SheetContent side="bottom" className="h-[88dvh]">
        <DialogTitle>סינון תוצאות</DialogTitle>
        <DialogDescription className="sr-only">
          בחרו פילטרים לצמצום התוצאות. התוצאות מתעדכנות מיד.
        </DialogDescription>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <FilterPanel
            attributes={attributes}
            cityFacets={cityFacets}
            priceRange={priceRange}
            priceLabel={priceLabel}
            valueFacets={valueFacets}
          />
        </div>

        <Button size="lg" className="w-full" onClick={() => setOpen(false)} loading={counting}>
          הצגת <span className="num">{formatCount(total)}</span> תוצאות
        </Button>
      </SheetContent>
    </Dialog>
  );
}
