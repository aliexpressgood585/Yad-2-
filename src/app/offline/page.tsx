import Link from "next/link";
import type { Metadata } from "next";
import { Heart, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "אין חיבור לאינטרנט",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-8" aria-hidden />
      </span>
      <div>
        <h1 className="font-heading text-2xl font-extrabold">אין חיבור לאינטרנט</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          נראה שאתם לא מחוברים לרשת כרגע. הדפים שכבר ביקרתם בהם והמועדפים שלכם עדיין
          זמינים.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/my/favorites">
            <Heart aria-hidden />
            המועדפים שלי
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">לדף הבית</Link>
        </Button>
      </div>
    </div>
  );
}
