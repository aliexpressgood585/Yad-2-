import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BulkImport } from "@/components/business/bulk-import";
import { auth } from "@/lib/auth";
import { activeMembership, permissionsFor } from "@/lib/business";
import { getAttributesForCategory, getCategoryTree, type CategoryNode } from "@/lib/categories";

export const metadata: Metadata = {
  title: "העלאה מרוכזת",
  robots: { index: false, follow: false },
};

/** עלים בלבד — מודעה נכנסת לתת-קטגוריה ולא לקטגוריית אב. */
function leaves(nodes: CategoryNode[], prefix = ""): { id: string; name: string; path: string }[] {
  return nodes.flatMap((node) => {
    const path = prefix ? `${prefix} › ${node.name}` : node.name;
    return node.children.length
      ? leaves(node.children, path)
      : [{ id: node.id, name: node.name, path }];
  });
}

export default async function BulkImportPage() {
  const session = await auth();
  const membership = await activeMembership(session!.user.id);
  if (!membership || !permissionsFor(membership.role).importInventory) {
    redirect("/my/business");
  }

  const tree = await getCategoryTree();
  const categories = leaves(tree);

  /*
   * השדות של כל הקטגוריות נטענים מראש, כדי שהחלפת קטגוריה במסך תעדכן
   * את טבלת המיפוי בלי סבב נוסף לשרת. 49 קטגוריות עם 114 שדות הן
   * מטען קטן, וכל אחת מהן ממילא נשלפת ממטמון.
   */
  const attributesByCategory = Object.fromEntries(
    await Promise.all(
      categories.map(async (c) => [
        c.id,
        (await getAttributesForCategory(c.id)).map((a) => ({
          key: a.key,
          label: a.label,
          isRequired: a.isRequired,
        })),
      ]),
    ),
  );

  return (
    <BulkImport categories={categories} attributesByCategory={attributesByCategory} />
  );
}
