import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, Store } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrustScore } from "@/lib/trust";
import { cn, timeAgo } from "@/lib/utils";

type Seller = {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  businessName: string | null;
  businessSlug: string | null;
  createdAt: string;
  activeListings: number;
};

/*
 * תגית רמת האמון מסומנת בקו ובטקסט, לא במילוי.
 *
 * תגית ענבר מלאה בדף מודעה מתחרה ב"הצגת מספר הטלפון" שהוא הפעולה
 * היחידה של המסך, והעין קופצת לשתיהן. הציון הוא מידע ולא פעולה.
 */
const LEVEL_STYLES: Record<TrustScore["level"], string> = {
  excellent: "border border-info text-info",
  good: "border border-primary text-primary",
  fair: "border border-warning text-warning",
  new: "border border-border text-muted-foreground",
};

/** כרטיס מוכר עם ציון אמינות והאותות שממנו הוא מחושב. */
export function SellerCard({ seller, trust }: { seller: Seller; trust: TrustScore }) {
  const displayName = seller.businessName ?? seller.name;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            {seller.avatar ? <AvatarImage src={seller.avatar} alt="" /> : null}
            <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-heading font-bold">
              <span className="truncate">{displayName}</span>
              {seller.businessName ? (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(seller.createdAt).replace("לפני", "באתר כבר")} ·{" "}
              <span className="num">{seller.activeListings}</span> מודעות פעילות
            </p>
          </div>
        </div>

        {seller.bio ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{seller.bio}</p>
        ) : null}

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">ציון אמינות</span>
            {/* בטווח הביניים אין תג — עדיף בלי אמירה מאשר אמירה שלילית */}
            {trust.levelLabel ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  LEVEL_STYLES[trust.level],
                )}
              >
                {trust.levelLabel}
              </span>
            ) : null}
          </div>

          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="meter"
            aria-valuenow={trust.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ציון אמינות המוכר"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                trust.level === "excellent"
                  ? "bg-success"
                  : trust.level === "good"
                    ? "bg-primary"
                    : trust.level === "fair"
                      ? "bg-warning"
                      : "bg-muted-foreground",
              )}
              style={{ width: `${trust.score}%` }}
            />
          </div>

          <ul className="mt-3 space-y-1.5">
            {trust.signals.map((signal) => (
              <li key={signal.label} className="flex items-start gap-2 text-xs">
                {/*
                  * הישג מקבל וי ירוק; נתון רגיל מקבל נקודה אפורה.
                  * X שמור לאזהרה אמיתית בלבד — הוא נקרא כפגם, ודירוג
                  * 3.6 מתוך 60 דירוגים אינו פגם.
                  */}
                {signal.tone === "strong" ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                ) : signal.tone === "warning" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                ) : (
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border"
                    aria-hidden
                  />
                )}
                <span className="text-muted-foreground">
                  {signal.label}:{" "}
                  <span className="num font-medium text-foreground">{signal.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/u/${seller.id}`}>כל המודעות שלו</Link>
          </Button>
          {seller.businessSlug ? (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={`/business/${seller.businessSlug}`}>
                <Store aria-hidden />
                עמוד העסק
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
