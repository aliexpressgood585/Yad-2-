import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrowseView } from "@/components/browse/browse-view";
import { getCategoryBySlug, getCategoryTree } from "@/lib/categories";
import { SITE } from "@/lib/site";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** דפי הקטגוריות הראשיות מיוצרים מראש ומתרעננים כל 10 דקות (ISR). */
export const revalidate = 600;

export async function generateStaticParams() {
  const tree = await getCategoryTree();
  return tree.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};

  const title = `${category.namePlural ?? category.name} — מודעות חדשות מכל הארץ`;
  return {
    title,
    description:
      category.description ??
      `כל המודעות בקטגוריית ${category.name} ב${SITE.name}. חיפוש חכם, פילטרים מדויקים ובלי עומס פרסומות.`,
    alternates: { canonical: `/${category.slug}` },
    openGraph: {
      title,
      description: category.description ?? SITE.description,
      url: `/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  // רק קטגוריות שורש נגישות בנתיב בעל מקטע אחד
  if (!category || category.parentId) notFound();

  return (
    <BrowseView
      category={category}
      searchParams={await searchParams}
      title={category.namePlural ?? category.name}
      description={category.description ?? undefined}
    />
  );
}
