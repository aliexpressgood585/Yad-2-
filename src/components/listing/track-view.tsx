"use client";

import * as React from "react";

import { useRecentlyViewed } from "@/stores/recently-viewed";

const SESSION_KEY = "shnatot-viewed";

/**
 * רושם צפייה במודעה פעם אחת לכל סשן דפדפן,
 * ומוסיף אותה לרשימת "נצפו לאחרונה" המקומית.
 */
export function TrackView({ listingId }: { listingId: string }) {
  const push = useRecentlyViewed((s) => s.push);

  React.useEffect(() => {
    push(listingId);

    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    } catch {
      seen = [];
    }
    if (seen.includes(listingId)) return;

    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen, listingId].slice(-200)));
    // הצפייה נרשמת ברקע; כישלון כאן לא אמור להפריע לגולש
    void fetch(`/api/listings/${listingId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }, [listingId, push]);

  return null;
}
