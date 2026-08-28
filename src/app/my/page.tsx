import type { Metadata } from "next";
import Link from "next/link";
import { Eye, MessageCircle, Phone, Plus, TrendingUp } from "lucide-react";

import { MyListingRow } from "@/components/my/my-listing-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyResults } from "@/components/listing/listing-grid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paymentsEnabled } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";

export const metadata: Metadata = {
  title: "המודעות שלי",
  robots: { index: false, follow: false },
};

const TABS = [
  { key: "active", label: "פעילות", statuses: ["ACTIVE"] as const },
  { key: "drafts", label: "טיוטות", statuses: ["DRAFT", "PENDING"] as const },
  { key: "sold", label: "נמכרו", statuses: ["SOLD"] as const },
  { key: "expired", label: "פגו / הוסרו", statuses: ["EXPIRED", "BANNED"] as const },
];

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]!;

  const canPay = paymentsEnabled();

  const [listings, counts, totals] = await Promise.all([
    prisma.listing.findMany({
      where: { userId, deletedAt: null, status: { in: [...active.statuses] } },
      orderBy: [{ bumpedAt: "desc" }, { createdAt: "desc" }],
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        category: { select: { name: true } },
        _count: { select: { conversations: true, favorites: true } },
      },
      take: 60,
    }),
    prisma.listing.groupBy({
      by: ["status"],
      where: { userId, deletedAt: null },
      _count: true,
    }),
    prisma.listing.aggregate({
      where: { userId, deletedAt: null },
      _sum: { viewCount: true, contactRevealCount: true, favoriteCount: true },
    }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));
  const tabCount = (statuses: readonly string[]) =>
    statuses.reduce((sum, s) => sum + (countByStatus.get(s as never) ?? 0), 0);

  const stats = [
    {
      label: "צפיות במודעות",
      value: totals._sum.viewCount ?? 0,
      icon: Eye,
    },
    {
      label: "חשיפות טלפון",
      value: totals._sum.contactRevealCount ?? 0,
      icon: Phone,
    },
    {
      label: "שמירות במועדפים",
      value: totals._sum.favoriteCount ?? 0,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">המודעות שלי</h1>
          <p className="text-sm text-muted-foreground">
            ניהול, חידוש וקידום של כל המודעות שפרסמת.
          </p>
        </div>
        <Button asChild>
          <Link href="/publish">
            <Plus aria-hidden />
            פרסום מודעה
          </Link>
        </Button>
      </header>

      <ul className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="num font-heading text-xl font-extrabold">
                    {formatCompact(s.value)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <nav aria-label="סינון לפי סטטוס">
        <ul className="flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
          {TABS.map((t) => {
            const isActive = t.key === active.key;
            const count = tabCount(t.statuses);
            return (
              <li key={t.key}>
                <Link
                  href={t.key === "active" ? "/my" : `/my?tab=${t.key}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="num text-xs opacity-70">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {listings.length === 0 ? (
        <EmptyResults
          title="אין כאן מודעות"
          body={
            active.key === "active"
              ? "עדיין לא פרסמת מודעה פעילה. זה לוקח פחות מדקה."
              : "אין מודעות בסטטוס הזה."
          }
          action={
            <Button asChild>
              <Link href="/publish">פרסום מודעה ראשונה</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <MyListingRow
                listing={{
                  id: listing.id,
                  slug: listing.slug,
                  title: listing.title,
                  price: listing.price,
                  status: listing.status,
                  city: listing.city,
                  categoryName: listing.category.name,
                  imageUrl: listing.images[0]?.thumbUrl ?? listing.images[0]?.url ?? null,
                  viewCount: listing.viewCount,
                  revealCount: listing.contactRevealCount,
                  favoriteCount: listing.favoriteCount,
                  messageCount: listing._count.conversations,
                  isPromoted:
                    listing.isPromoted &&
                    listing.promotedUntil !== null &&
                    listing.promotedUntil > new Date(),
                  expiresAt: listing.expiresAt?.toISOString() ?? null,
                  createdAt: listing.createdAt.toISOString(),
                }}
                paymentsEnabled={canPay}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <MessageCircle className="size-4 shrink-0" aria-hidden />
        מודעה פעילה 45 יום. שבוע לפני התפוגה נשלח תזכורת, ואפשר לחדש בלחיצה אחת.
      </p>
    </div>
  );
}
