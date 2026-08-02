import { ListingGridSkeleton } from "@/components/listing/listing-grid";
import { Skeleton } from "@/components/ui/skeleton";

/** שלד עמוד קטגוריה — מוצג בזמן ה-streaming של התוצאות. */
export default function CategoryLoading() {
  return (
    <div className="container py-5">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-3 h-9 w-64" />

      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="hidden w-64 shrink-0 space-y-3 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 w-44" />
          </div>
          <ListingGridSkeleton count={12} />
        </div>
      </div>
    </div>
  );
}
