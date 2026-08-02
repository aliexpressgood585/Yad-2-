import type { Metadata } from "next";
import { Suspense } from "react";

import { MapExplorer } from "@/components/map/map-explorer";
import { Skeleton } from "@/components/ui/skeleton";
import { getRootCategories } from "@/lib/categories";

export const metadata: Metadata = {
  title: "מפת המודעות",
  description:
    "כל המודעות הפעילות על גבי מפה, עם קיבוץ אשכולות וסינון לפי קטגוריה ומחיר.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
  const categories = await getRootCategories();

  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full" />}>
      <MapExplorer categories={categories} />
    </Suspense>
  );
}
