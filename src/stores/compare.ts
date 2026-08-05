"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MAX_COMPARE } from "@/lib/site";

export type CompareItem = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  image: string | null;
  categoryId: string;
};

type CompareState = {
  items: CompareItem[];
  has: (id: string) => boolean;
  /** מוסיף/מסיר. מחזיר סיבת דחייה כשלא ניתן להוסיף. */
  toggle: (item: CompareItem) => "added" | "removed" | "full" | "category-mismatch";
  remove: (id: string) => void;
  clear: () => void;
};

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],

      has: (id) => get().items.some((i) => i.id === id),

      toggle(item) {
        const items = get().items;
        if (items.some((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) });
          return "removed";
        }
        if (items.length >= MAX_COMPARE) return "full";
        // השוואה הגיונית רק בתוך אותה קטגוריה — השדות הדינמיים שונים אחרת
        if (items.length && items[0]!.categoryId !== item.categoryId) {
          return "category-mismatch";
        }
        set({ items: [...items, item] });
        return "added";
      },

      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    { name: "shnatot-compare", version: 1 },
  ),
);
