"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_ITEMS = 12;

type RecentlyViewedState = {
  ids: string[];
  push: (id: string) => void;
  clear: () => void;
};

/** שומר את המודעות שנצפו לאחרונה בדפדפן בלבד — לא נשלח לשרת. */
export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      ids: [],
      push(id) {
        const next = [id, ...get().ids.filter((x) => x !== id)].slice(0, MAX_ITEMS);
        set({ ids: next });
      },
      clear: () => set({ ids: [] }),
    }),
    { name: "metzia-recent", version: 1 },
  ),
);
