import type { Metadata } from "next";

import { BrowseView } from "@/components/browse/browse-view";
import { getCategoryBySlug } from "@/lib/categories";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  return {
    title: q ? `חיפוש: ${q}` : "חיפוש מודעות",
    description: q
      ? `תוצאות חיפוש עבור "${q}" — מודעות מכל הקטגוריות בכל הארץ.`
      : "חיפוש חוצה קטגוריות בכל מודעות הלוח, עם פילטרים מתקדמים ומיון לפי מרחק.",
    // דפי תוצאות אינם מיועדים לאינדוקס, אך הקישורים מתוכם כן
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const categorySlug = typeof params.category === "string" ? params.category : null;
  const category = categorySlug ? await getCategoryBySlug(categorySlug) : null;

  return (
    <BrowseView
      category={category}
      searchParams={params}
      title={q ? `תוצאות עבור "${q}"` : "חיפוש בכל הלוח"}
      description={
        q
          ? undefined
          : "חיפוש חופשי בכל הקטגוריות. אפשר לצמצם לפי מחיר, מיקום, מרחק ומאפיינים."
      }
    />
  );
}
