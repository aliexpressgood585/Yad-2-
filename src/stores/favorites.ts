"use client";

import { create } from "zustand";

type FavoritesState = {
  ids: Set<string>;
  loaded: boolean;
  loading: boolean;
  /** טוען פעם אחת את רשימת המועדפים של המשתמש המחובר. */
  load: () => Promise<void>;
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<"added" | "removed" | "unauthenticated">;
};

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,

  async load() {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      if (!res.ok) {
        set({ loaded: true, loading: false });
        return;
      }
      const data = (await res.json()) as { ids: string[] };
      set({ ids: new Set(data.ids), loaded: true, loading: false });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  has(id) {
    return get().ids.has(id);
  },

  async toggle(id) {
    const current = new Set(get().ids);
    const wasFavorite = current.has(id);

    // עדכון אופטימי — הלב מגיב מיד, ומתגלגל אחורה אם השרת דחה
    if (wasFavorite) current.delete(id);
    else current.add(id);
    set({ ids: current });

    try {
      const res = await fetch("/api/favorites", {
        method: wasFavorite ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });

      if (res.status === 401) {
        set({ ids: get().ids.has(id) === wasFavorite ? get().ids : revert(get().ids, id, wasFavorite) });
        return "unauthenticated";
      }
      if (!res.ok) {
        set({ ids: revert(get().ids, id, wasFavorite) });
        return wasFavorite ? "added" : "removed";
      }
      return wasFavorite ? "removed" : "added";
    } catch {
      set({ ids: revert(get().ids, id, wasFavorite) });
      return wasFavorite ? "added" : "removed";
    }
  },
}));

function revert(ids: Set<string>, id: string, wasFavorite: boolean): Set<string> {
  const next = new Set(ids);
  if (wasFavorite) next.add(id);
  else next.delete(id);
  return next;
}
