import type { Metadata } from "next";

import { CompareTable } from "@/components/compare/compare-table";

export const metadata: Metadata = {
  title: "השוואת מודעות",
  description: "השוואה של עד 4 מודעות זו לצד זו, לפי מחיר ומפרט מלא.",
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return (
    <div className="container py-6">
      <header className="mb-5">
        <h1 className="font-heading text-2xl font-extrabold">השוואת מודעות</h1>
        <p className="text-sm text-muted-foreground">
          עד 4 מודעות מאותה קטגוריה, זו לצד זו. הבדלים בין המודעות מודגשים.
        </p>
      </header>

      <CompareTable />
    </div>
  );
}
