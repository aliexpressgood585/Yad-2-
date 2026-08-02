import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { EmptyResults } from "@/components/listing/listing-grid";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn, formatPrice, timeAgo, truncate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ההודעות שלי",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { buyerId: userId, buyerArchived: false },
        { sellerId: userId, sellerArchived: false },
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          images: { orderBy: { order: "asc" }, take: 1 },
        },
      },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold">הודעות</h1>
        <p className="text-sm text-muted-foreground">
          כל השיחות שלך עם קונים ומוכרים, מקובצות לפי מודעה.
        </p>
      </header>

      {conversations.length === 0 ? (
        <EmptyResults
          title="אין עדיין שיחות"
          body="כשתפנו למוכר או שמישהו יתעניין במודעה שלכם — השיחה תופיע כאן."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {conversations.map((c) => {
            const isSeller = c.sellerId === userId;
            const other = isSeller ? c.buyer : c.seller;
            const readAt = isSeller ? c.sellerReadAt : c.buyerReadAt;
            const last = c.messages[0];
            const unread = last ? !readAt || readAt < last.createdAt : false;
            const image = c.listing.images[0];

            return (
              <li key={c.id}>
                <Link
                  href={`/my/messages/${c.id}`}
                  className={cn(
                    "flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/60",
                    unread && "bg-primary-soft/30",
                  )}
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {image ? (
                      <Image
                        src={image.thumbUrl ?? image.url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={(image.thumbUrl ?? image.url).startsWith("/uploads")}
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className={cn("truncate", unread ? "font-bold" : "font-medium")}>
                        {other.name}
                      </p>
                      <Badge variant="muted" className="shrink-0">
                        {isSeller ? "קונה" : "מוכר"}
                      </Badge>
                      {last ? (
                        <time
                          dateTime={last.createdAt.toISOString()}
                          className="ms-auto shrink-0 text-xs text-muted-foreground"
                        >
                          {timeAgo(last.createdAt)}
                        </time>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {truncate(c.listing.title, 45)} ·{" "}
                      <span className="num">{formatPrice(c.listing.price)}</span>
                    </p>
                    {last ? (
                      <p
                        className={cn(
                          "truncate text-sm",
                          unread ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {last.senderId === userId ? "את/ה: " : ""}
                        {truncate(last.body, 70)}
                      </p>
                    ) : null}
                  </div>

                  {unread ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full bg-primary"
                      aria-label="הודעה שלא נקראה"
                    />
                  ) : (
                    <MessageCircle
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
