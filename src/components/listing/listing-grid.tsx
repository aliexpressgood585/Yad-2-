import { SearchX } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import type { ListingCardDto } from "@/lib/listing-dto";
import { cn } from "@/lib/utils";

export const GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export function ListingGrid({
  listings,
  layout = "grid",
  priorityCount = 4,
  className,
}: {
  listings: ListingCardDto[];
  layout?: "grid" | "row";
  priorityCount?: number;
  className?: string;
}) {
  return (
    <div className={cn(layout === "grid" ? GRID_CLASS : "flex flex-col gap-3", className)}>
      {listings.map((listing, i) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          layout={layout}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}

export function ListingGridSkeleton({
  count = 8,
  layout = "grid",
}: {
  count?: number;
  layout?: "grid" | "row";
}) {
  return (
    <div className={layout === "grid" ? GRID_CLASS : "flex flex-col gap-3"}>
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} layout={layout} />
      ))}
    </div>
  );
}

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
        <p className="mt-1 mx-auto max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
