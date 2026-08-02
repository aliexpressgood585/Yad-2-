import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye, Heart, MessageCircle, Phone } from "lucide-react";

import { StatsChart } from "@/components/my/stats-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { formatPrice, formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "סטטיסטיקות מודעה",
  robots: { index: false, follow: false },
};

const DAYS = 30;

export default async function ListingStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const listing = await prisma.listing.findFirst({
    where: { id, userId: session!.user.id, deletedAt: null },
    include: {
      category: { select: { name: true } },
      _count: { select: { conversations: true, favorites: true } },
    },
  });
  if (!listing) notFound();

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const stats = await prisma.listingDailyStat.findMany({
    where: { listingId: id, day: { gte: since } },
    orderBy: { day: "asc" },
  });

  // השלמת ימים חסרים כדי שהגרף יהיה רציף
  const byDay = new Map(stats.map((s) => [s.day.toISOString().slice(0, 10), s]));
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return {
      day: key,
      label: d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
      views: row?.views ?? 0,
      reveals: row?.reveals ?? 0,
      favorites: row?.favorites ?? 0,
    };
  });

  const periodViews = series.reduce((s, d) => s + d.views, 0);
  const periodReveals = series.reduce((s, d) => s + d.reveals, 0);
  // שיעור המרה: כמה מהצופים ביקשו את מספר הטלפון
  const conversion = periodViews ? (periodReveals / periodViews) * 100 : 0;

  const cards = [
    { label: "צפיות (30 יום)", value: periodViews, icon: Eye },
    { label: "חשיפות טלפון", value: periodReveals, icon: Phone },
    { label: "שמירות במועדפים", value: listing._count.favorites, icon: Heart },
    { label: "שיחות שנפתחו", value: listing._count.conversations, icon: MessageCircle },
  ];

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/my">
          <ArrowRight aria-hidden />
          חזרה למודעות שלי
        </Link>
      </Button>

      <header>
        <h1 className="font-heading text-2xl font-extrabold">{listing.title}</h1>
        <p className="text-sm text-muted-foreground">
          {listing.category.name} · {listing.city} ·{" "}
          <span className="num">{formatPrice(listing.price)}</span> · פורסמה{" "}
          {timeAgo(listing.publishedAt ?? listing.createdAt)}
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Card>
              <CardContent className="p-4">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <c.icon className="size-3.5" aria-hidden />
                  {c.label}
                </span>
                <p className="num mt-1 font-heading text-2xl font-extrabold">
                  {formatCount(c.value)}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle>פעילות ב-30 הימים האחרונים</CardTitle>
        </CardHeader>
        <CardContent>
          <StatsChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>מה אפשר לשפר</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Insight
            good={conversion >= 3}
            text={
              conversion >= 3
                ? `שיעור ההמרה שלך הוא ${conversion.toFixed(1)}% — מעל הממוצע בלוח.`
                : `רק ${conversion.toFixed(1)}% מהצופים ביקשו את מספר הטלפון. תיאור מפורט יותר ותמונות נוספות בדרך כלל מכפילים את המספר.`
            }
          />
          <Insight
            good={periodViews > 100}
            text={
              periodViews > 100
                ? "המודעה מקבלת חשיפה טובה בתוצאות החיפוש."
                : "מעט צפיות יחסית — כדאי לרענן את המודעה או לשקול קידום כדי לעלות לראש הקטגוריה."
            }
          />
          <Insight
            good={listing._count.favorites > 3}
            text={
              listing._count.favorites > 3
                ? "מספר אנשים שמרו את המודעה במועדפים — סימן לעניין אמיתי."
                : "מעט שמירות במועדפים. לעיתים המחיר גבוה מהמקובל בקטגוריה."
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Insight({ good, text }: { good: boolean; text: string }) {
  return (
    <p className="flex items-start gap-2">
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${good ? "bg-success" : "bg-warning"}`}
        aria-hidden
      />
      <span className="text-muted-foreground">{text}</span>
    </p>
  );
}
