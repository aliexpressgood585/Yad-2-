import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ModerationActions } from "@/components/admin/moderation-actions";
import { AdminSearchForm } from "@/components/admin/admin-search-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { timeAgo, truncate } from "@/lib/utils";
import { formatPrice, formatCount } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "ניהול מודעות",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "פעילה",
  DRAFT: "טיוטה",
  PENDING: "בבדיקה",
  SOLD: "נמכרה",
  EXPIRED: "פג תוקף",
  BANNED: "הוסרה",
};

const PAGE_SIZE = 40;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where: Prisma.ListingWhereInput = {
    deletedAt: null,
    ...(status && status !== "all" ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        category: { select: { name: true } },
        user: { select: { id: true, name: true, isBlocked: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <AdminSearchForm
        placeholder="חיפוש לפי כותרת, עיר או שם מפרסם…"
        statuses={[
          { value: "all", label: "כל הסטטוסים" },
          ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ]}
      />

      <p className="text-sm text-muted-foreground">
        <span className="num font-medium text-foreground">{formatCount(total)}</span>{" "}
        מודעות
      </p>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {listings.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {l.images[0] ? (
                <Image
                  src={l.images[0].thumbUrl ?? l.images[0].url}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized={(l.images[0].thumbUrl ?? l.images[0].url).startsWith("/uploads")}
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/item/${l.slug}`}
                  target="_blank"
                  className="truncate font-medium hover:underline"
                >
                  {truncate(l.title, 50)}
                </Link>
                <Badge variant={l.status === "ACTIVE" ? "success" : l.status === "BANNED" ? "destructive" : "muted"}>
                  {STATUS_LABELS[l.status] ?? l.status}
                </Badge>
                {l._count.reports > 0 ? (
                  <Badge variant="warning" className="num">
                    {l._count.reports} דיווחים
                  </Badge>
                ) : null}
                {l.fraudScore > 0 ? (
                  <Badge variant="outline" className="num">
                    ציון {l.fraudScore}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="num">{formatPrice(l.price)}</span> · {l.category.name} ·{" "}
                {l.city} ·{" "}
                <Link href={`/u/${l.user.id}`} className="hover:underline">
                  {l.user.name}
                </Link>
                {l.user.isBlocked ? " (חסום)" : ""} · {timeAgo(l.createdAt)}
              </p>
            </div>

            <ModerationActions listingId={l.id} userId={l.user.id} />
          </li>
        ))}
        {listings.length === 0 ? (
          <li className="p-8 text-center text-sm text-muted-foreground">
            לא נמצאו מודעות
          </li>
        ) : null}
      </ul>

      {pages > 1 ? (
        <nav aria-label="עימוד" className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={`/admin/listings?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              הקודם
            </Link>
          ) : null}
          <span className="num text-sm text-muted-foreground">
            עמוד {page} מתוך {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/admin/listings?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              הבא
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
