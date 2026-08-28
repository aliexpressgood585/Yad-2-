import { SearchX } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import type { ListingCardDto } from "@/lib/listing-dto";
import type { Density } from "@/stores/density";
import { cn } from "@/lib/utils";

/**
 * תוצאות הן טור אחד של שורות קריאה, בשני מצבי הצפיפות.
 *
 * אין כאן `grid-cols`. גריד כרטיסים ירד מהאתר (DECISIONS.md §38) כי הוא
 * שובר את הדבר היחיד שהופך את התוצאות לקריאות — טור מחירים אחד שמתיישר
 * לאורך כל השורות. ההבדל בין המצבים הוא הרווח בין השורות ורוחב לוחית
 * התמונה בתוכן, לא מספר העמודות.
 */
export const FULL_CLASS = "flex flex-col gap-2";
export const COMPACT_CLASS = "flex flex-col gap-px";

export function densityClass(density: Density): string {
  return density === "compact" ? COMPACT_CLASS : FULL_CLASS;
}

export function ListingGrid({
  listings,
  density = "full",
  priorityCount = 4,
  className,
}: {
  listings: ListingCardDto[];
  density?: Density;
  priorityCount?: number;
  className?: string;
}) {
  return (
    <div className={cn(densityClass(density), className)}>
      {listings.map((listing, i) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          density={density}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({
  count = 8,
  density = "full",
}: {
  count?: number;
  density?: Density;
}) {
  return (
    <div className={densityClass(density)}>
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} density={density} />
      ))}
    </div>
  );
}

/**
 * מצב ריק.
 *
 * `action` נועד לכפתור שמסיר את הפילטר שחסם את התוצאות — מצב ריק שרק
 * מודיע "אין תוצאות" משאיר את המשתמש בלי מוצא.
 */
export function EmptyResults({
  title = "לא נמצאו מודעות",
  body = "נסו להרחיב את הפילטרים או לשנות את מילות החיפוש.",
  action,
}: {
  title?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border py-16 text-center">
      <span className="grid size-12 place-items-center border border-border text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <div>
        <h2 className="font-heading text-lg">{title}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
