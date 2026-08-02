import { SearchX } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import type { ListingCardDto } from "@/lib/listing-dto";
import type { Density } from "@/stores/density";
import { cn } from "@/lib/utils";

/** שתי עמודות בנייד — צפיפות שמאפשרת לראות מודעה שלמה בלי גלילה. */
export const GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
export const LIST_CLASS = "flex flex-col gap-2";

export function densityClass(density: Density): string {
  return density === "grid" ? GRID_CLASS : LIST_CLASS;
}

export function ListingGrid({
  listings,
  density = "grid",
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
  density = "grid",
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
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <div>
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
