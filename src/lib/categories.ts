import { cache } from "react";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  namePlural: string | null;
  icon: string;
  description: string | null;
  parentId: string | null;
  order: number;
  priceLabel: string;
  children: CategoryNode[];
};

export type ResolvedAttribute = {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "MULTISELECT" | "BOOLEAN";
  unit: string | null;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  isFilter: boolean;
  isHighlight: boolean;
  min: number | null;
  max: number | null;
  step: number | null;
  order: number;
  dependsOn: string | null;
  values: {
    id: string;
    value: string;
    label: string;
    order: number;
    parentValue: string | null;
  }[];
};

/**
 * עץ הקטגוריות המלא. נשמר במטמון — הוא כמעט לא משתנה
 * ונדרש כמעט בכל דף באתר.
 */
export const getCategoryTree = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        namePlural: true,
        icon: true,
        description: true,
        parentId: true,
        order: true,
        priceLabel: true,
      },
    });

    const byId = new Map<string, CategoryNode>();
    for (const r of rows) byId.set(r.id, { ...r, children: [] });

    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId) {
        byId.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  },
  ["category-tree"],
  { revalidate: 3600, tags: ["categories"] },
);

/** קטגוריות ראשיות בלבד (ללא ילדים). */
export const getRootCategories = cache(async () => {
  const tree = await getCategoryTree();
  return tree.map(({ children: _children, ...c }) => c);
});

/** שיטוח העץ לרשימה. */
export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export const getFlatCategories = cache(async () => flattenTree(await getCategoryTree()));

/** מאתר קטגוריה לפי slug. */
export const getCategoryBySlug = cache(async (slug: string) => {
  const all = await getFlatCategories();
  return all.find((c) => c.slug === slug) ?? null;
});

export const getCategoryById = cache(async (id: string) => {
  const all = await getFlatCategories();
  return all.find((c) => c.id === id) ?? null;
});

/** שרשרת האבות מהשורש ועד הקטגוריה עצמה (עבור פירורי לחם). */
export const getCategoryPath = cache(async (id: string): Promise<CategoryNode[]> => {
  const all = await getFlatCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const path: CategoryNode[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
});

/** כל מזהי הקטגוריה וצאצאיה — לסינון מודעות בקטגוריית-אב. */
export const getCategoryIdsWithDescendants = cache(
  async (id: string): Promise<string[]> => {
    const all = await getFlatCategories();
    const childrenOf = new Map<string, string[]>();
    for (const c of all) {
      if (!c.parentId) continue;
      const arr = childrenOf.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parentId, arr);
    }
    const out: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      out.push(cur);
      stack.push(...(childrenOf.get(cur) ?? []));
    }
    return out;
  },
);

const loadAttributes = unstable_cache(
  async (categoryIds: string[]): Promise<ResolvedAttribute[]> => {
    const rows = await prisma.attribute.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: [{ order: "asc" }],
      include: {
        values: {
          orderBy: [{ order: "asc" }, { label: "asc" }],
          select: {
            id: true,
            value: true,
            label: true,
            order: true,
            parentValue: true,
          },
        },
      },
    });
    return rows as ResolvedAttribute[];
  },
  ["category-attributes"],
  { revalidate: 3600, tags: ["categories"] },
);

/**
 * כל השדות הדינמיים החלים על קטגוריה — כולל שדות שיורשים מקטגוריות-אב.
 * למשל "יצרן" מוגדר על "רכב" וחל גם על "רכב פרטי".
 * שדה שמוגדר מחדש בקטגוריה-בת דורס את זה של האב (לפי `key`).
 */
export const getAttributesForCategory = cache(
  async (categoryId: string): Promise<ResolvedAttribute[]> => {
    const path = await getCategoryPath(categoryId);
    if (path.length === 0) return [];

    const attrs = await loadAttributes(path.map((c) => c.id));
    const depth = new Map(path.map((c, i) => [c.id, i]));

    const byKey = new Map<string, ResolvedAttribute>();
    for (const a of attrs) {
      const existing = byKey.get(a.key);
      const d = depth.get(a.categoryId) ?? -1;
      const existingD = existing ? (depth.get(existing.categoryId) ?? -1) : -1;
      if (!existing || d > existingD) byKey.set(a.key, a);
    }

    return [...byKey.values()].sort((a, b) => a.order - b.order);
  },
);
