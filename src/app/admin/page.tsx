import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Flag,
  MessageCircle,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatCompact, timeAgo, truncate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "פאנל ניהול",
  robots: { index: false, follow: false },
};

export default async function AdminDashboard() {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    totalListings,
    activeListings,
    newListings,
    totalUsers,
    newUsers,
    openReports,
    flaggedListings,
    messagesWeek,
    topCategories,
    recentFlags,
  ] = await Promise.all([
    prisma.listing.count({ where: { deletedAt: null } }),
    prisma.listing.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.listing.count({ where: { createdAt: { gte: dayAgo }, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.listing.count({
      where: { fraudScore: { gte: 30 }, status: "ACTIVE", deletedAt: null },
    }),
    prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.listing.groupBy({
      by: ["categoryId"],
      where: { status: "ACTIVE", deletedAt: null },
      _count: true,
      orderBy: { _count: { categoryId: "desc" } },
      take: 6,
    }),
    prisma.fraudFlag.findMany({
      where: { severity: { in: ["HIGH", "MEDIUM"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { listing: { select: { id: true, slug: true, title: true } } },
    }),
  ]);

  const categoryNames = await prisma.category.findMany({
    where: { id: { in: topCategories.map((c) => c.categoryId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(categoryNames.map((c) => [c.id, c.name]));

  const stats = [
    { label: "מודעות פעילות", value: activeListings, sub: `מתוך ${totalListings} סה"כ`, icon: FileText },
    { label: "מודעות חדשות (24 שעות)", value: newListings, sub: "", icon: TrendingUp },
    { label: "משתמשים", value: totalUsers, sub: `${newUsers} חדשים השבוע`, icon: Users },
    { label: "הודעות (7 ימים)", value: messagesWeek, sub: "", icon: MessageCircle },
    { label: "דיווחים פתוחים", value: openReports, sub: "ממתינים לטיפול", icon: Flag },
    { label: "מודעות מסומנות", value: flaggedListings, sub: "ציון הונאה 30+", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="num font-heading text-2xl font-extrabold">
                    {formatCompact(s.value)}
                  </p>
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.sub ? (
                    <p className="num text-xs text-muted-foreground">{s.sub}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>קטגוריות מובילות</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topCategories.map((c) => {
                const pct = activeListings ? (c._count / activeListings) * 100 : 0;
                return (
                  <li key={c.categoryId} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{nameById.get(c.categoryId) ?? "—"}</span>
                      <span className="num text-muted-foreground">{c._count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>סימוני הונאה אחרונים</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFlags.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין סימונים פתוחים.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentFlags.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <Badge variant={f.severity === "HIGH" ? "destructive" : "warning"}>
                      {f.severity === "HIGH" ? "גבוה" : "בינוני"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/item/${f.listing.slug}`}
                        className="truncate font-medium hover:underline"
                      >
                        {truncate(f.listing.title, 40)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{f.message}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(f.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
