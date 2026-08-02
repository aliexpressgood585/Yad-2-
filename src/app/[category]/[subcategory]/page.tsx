import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrowseView } from "@/components/browse/browse-view";
import { getCategoryBySlug } from "@/lib/categories";
import { decodeSlugParam } from "@/lib/slug";
import { SITE } from "@/lib/site";

type Props = {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** ראה הערה ב-`[category]/page.tsx` לגבי היעדר `generateStaticParams`. */
export const revalidate = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: rootSlug, subcategory } = await params;
  const category = await getCategoryBySlug(decodeSlugParam(subcategory));
  if (!category) return {};

  const title = `${category.namePlural ?? category.name} — מודעות מעודכנות`;
  return {
    title,
    description:
      category.description ??
      `מודעות בקטגוריית ${category.name} ב${SITE.name}, עם פילטרים ייעודיים לקטגוריה.`,
    alternates: { canonical: `/${rootSlug}/${category.slug}` },
    openGraph: { title, url: `/${rootSlug}/${category.slug}` },
  };
}

export default async function SubcategoryPage({ params, searchParams }: Props) {
  const { category: rootSlug, subcategory } = await params;
  const [root, category] = await Promise.all([
    getCategoryBySlug(decodeSlugParam(rootSlug)),
    getCategoryBySlug(decodeSlugParam(subcategory)),
  ]);

  // מוודאים שהתת-קטגוריה אכן שייכת לקטגוריית האב שבנתיב
  if (!root || !category || category.parentId !== root.id) notFound();

  return (
    <BrowseView
      category={category}
      searchParams={await searchParams}
      title={category.namePlural ?? category.name}
      description={category.description ?? undefined}
    />
  );
}
