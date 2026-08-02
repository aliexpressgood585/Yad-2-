import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Flag } from "lucide-react";

import { ModerationActions } from "@/components/admin/moderation-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatPrice, timeAgo, truncate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "תור מודרציה",
  robots: { index: false, follow: false },
};

const REASON_LABELS: Record<string, string> = {
  SPAM: "ספאם",
  FRAUD: "חשד להונאה",
  OFFENSIVE: "תוכן פוגעני",
  DUPLICATE: "מודעה כפולה",
  WRONG_CATEGORY: "קטגוריה שגויה",
  SOLD_ALREADY: "כבר נמכר",
  OTHER: "אחר",
};

export default async function ModerationPage() {
  const [reports, flagged] = await Promise.all([
    prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        author: { select: { id: true, name: true } },
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            price: true,
            status: true,
            fraudScore: true,
            images: { orderBy: { order: "asc" }, take: 1 },
            user: { select: { id: true, name: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.listing.findMany({
      where: { fraudScore: { gte: 30 }, status: "ACTIVE", deletedAt: null },
      orderBy: { fraudScore: "desc" },
      take: 30,
      include: {
        fraudFlags: true,
        images: { orderBy: { order: "asc" }, take: 1 },
        user: { select: { id: true, name: true, createdAt: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="reports-heading">
        <Card>
          <CardHeader>
            <CardTitle id="reports-heading" className="flex items-center gap-2">
              <Flag className="size-5 text-destructive" aria-hidden />
              דיווחי משתמשים
              <Badge variant="destructive" className="num">
                {reports.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                אין דיווחים פתוחים. 👌
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 py-3.5">
                    <ListingThumb
                      url={r.listing.images[0]?.thumbUrl ?? r.listing.images[0]?.url ?? null}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive">{REASON_LABELS[r.reason] ?? r.reason}</Badge>
                        <Link
                          href={`/item/${r.listing.slug}`}
                          className="truncate font-medium hover:underline"
                          target="_blank"
                        >
                          {truncate(r.listing.title, 55)}
                        </Link>
                        <span className="num text-sm text-muted-foreground">
                          {formatPrice(r.listing.price)}
                        </span>
                      </div>
                      {r.details ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          &quot;{truncate(r.details, 160)}&quot;
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        דווח {timeAgo(r.createdAt)} ע&quot;י{" "}
                        {r.author ? (
                          <Link href={`/u/${r.author.id}`} className="hover:underline">
                            {r.author.name}
                          </Link>
                        ) : (
                          "אורח"
                        )}{" "}
                        · מפרסם:{" "}
                        <Link href={`/u/${r.listing.user.id}`} className="hover:underline">
                          {r.listing.user.name}
                        </Link>{" "}
                        (נרשם {timeAgo(r.listing.user.createdAt)})
                        {r.listing.fraudScore > 0 ? (
                          <> · ציון הונאה <span className="num">{r.listing.fraudScore}</span></>
                        ) : null}
                      </p>
                    </div>
                    <ModerationActions
                      reportId={r.id}
                      listingId={r.listing.id}
                      userId={r.listing.user.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="flagged-heading">
        <Card>
          <CardHeader>
            <CardTitle id="flagged-heading" className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" aria-hidden />
              סומן אוטומטית ע&quot;י מנגנון זיהוי ההונאה
              <Badge variant="warning" className="num">
                {flagged.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flagged.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                אין מודעות מסומנות.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {flagged.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-start gap-3 py-3.5">
                    <ListingThumb url={l.images[0]?.thumbUrl ?? l.images[0]?.url ?? null} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={l.fraudScore >= 60 ? "destructive" : "warning"}>
                          ציון <span className="num">{l.fraudScore}</span>
                        </Badge>
                        <Link
                          href={`/item/${l.slug}`}
                          className="truncate font-medium hover:underline"
                          target="_blank"
                        >
                          {truncate(l.title, 55)}
                        </Link>
                        <span className="num text-sm text-muted-foreground">
                          {formatPrice(l.price)}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {l.fraudFlags.map((f) => (
                          <li key={f.id} className="text-xs text-muted-foreground">
                            • {f.message}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-muted-foreground">
                        מפרסם:{" "}
                        <Link href={`/u/${l.user.id}`} className="hover:underline">
                          {l.user.name}
                        </Link>{" "}
                        · נרשם {timeAgo(l.user.createdAt)} · פורסמה{" "}
                        {timeAgo(l.publishedAt ?? l.createdAt)}
                      </p>
                    </div>
                    <ModerationActions listingId={l.id} userId={l.user.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ListingThumb({ url }: { url: string | null }) {
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
          unoptimized={url.startsWith("/uploads")}
        />
      ) : null}
    </div>
  );
}
