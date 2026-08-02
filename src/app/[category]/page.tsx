import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrowseView } from "@/components/browse/browse-view";
import { getCategoryBySlug } from "@/lib/categories";
import { decodeSlugParam } from "@/lib/slug";
import { SITE } from "@/lib/site";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * דפי הקטגוריות נבנים לפי דרישה ונשמרים במטמון ל-10 דקות (ISR).
 * במכוון אין כאן `generateStaticParams`: כשהנתיב מיוצר מראש,
 * קריאה ל-`notFound()` עבור slug לא מוכר מוגשת עם סטטוס 200 (soft-404).
 * בלי פרה-רנדור, כתובת לא מוכרת מחזירה 404 אמיתי — וההרצה הראשונה
 * ממילא נשמרת במטמון ומוגשת מיידית לכל השאר.
 */
export const revalidate = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(decodeSlugParam(slug));
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
  const category = await getCategoryBySlug(decodeSlugParam(slug));
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
