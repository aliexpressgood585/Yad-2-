import type { Metadata } from "next";

import { SavedSearchList } from "@/components/my/saved-search-list";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "חיפושים שמורים",
  robots: { index: false, follow: false },
};

export default async function SavedSearchesPage() {
  const session = await auth();

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold">חיפושים שמורים</h1>
        <p className="text-sm text-muted-foreground">
          נעדכן אתכם ברגע שמתפרסמת מודעה שמתאימה לחיפוש — לפני כולם.
        </p>
      </header>

      <SavedSearchList
        searches={searches.map((s) => ({
          id: s.id,
          name: s.name,
          filters: s.filters as Record<string, string>,
          frequency: s.frequency,
          createdAt: s.createdAt.toISOString(),
          lastNotified: s.lastNotified?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
