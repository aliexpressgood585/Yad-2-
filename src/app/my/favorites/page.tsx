import type { Metadata } from "next";
import Link from "next/link";

import { ListingGrid, EmptyResults } from "@/components/listing/listing-grid";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toListingCardDtos } from "@/lib/listing-dto";
import { fetchListingCards } from "@/lib/listings";
import { priceMetersFor } from "@/lib/price-meter";

export const metadata: Metadata = {
  title: "המועדפים שלי",
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const session = await auth();

  const favorites = await prisma.favorite.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: { listingId: true },
    take: 200,
  });

  const listings = await fetchListingCards(favorites.map((f) => f.listingId));
  // מודעות שנמחקו או נחסמו לא מוצגות, אבל נשארות במועדפים
  const visible = listings.filter((l) => l.status !== "BANNED");
  const meters = await priceMetersFor(visible.map((l) => l.id));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold">המועדפים שלי</h1>
        <p className="text-sm text-muted-foreground">
          <span className="num">{visible.length}</span> מודעות שמורות. הרשימה זמינה גם
          במצב לא מקוון.
        </p>
      </header>

      {visible.length === 0 ? (
        <EmptyResults
          title="עדיין לא שמרת מודעות"
          body="לחצו על הלב בכל מודעה כדי לשמור אותה כאן ולעקוב אחרי שינויי מחיר."
          action={
            <Button asChild>
              <Link href="/">התחלת חיפוש</Link>
            </Button>
          }
        />
      ) : (
        <ListingGrid listings={toListingCardDtos(visible, meters)} priorityCount={4} />
      )}
    </div>
  );
}
