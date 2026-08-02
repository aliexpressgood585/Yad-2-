import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star, Store } from "lucide-react";

import { ListingGrid, EmptyResults } from "@/components/listing/listing-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";
import { computeTrust } from "@/lib/trust";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 300;

async function getSeller(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null, isBlocked: false },
    select: {
      id: true,
      name: true,
      avatar: true,
      bio: true,
      role: true,
      createdAt: true,
      verifiedAt: true,
      ratingAvg: true,
      ratingCount: true,
      dealsCount: true,
      responseMins: true,
      businessName: true,
      businessSlug: true,
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) return { title: "המוכר לא נמצא" };

  const name = seller.businessName ?? seller.name;
  return {
    title: `${name} — כל המודעות`,
    description: `${seller._count.listings} מודעות פעילות של ${name} בלוח. דירוג ${seller.ratingAvg.toFixed(1)} מתוך 5.`,
    alternates: { canonical: `/u/${seller.id}` },
  };
}

export default async function SellerPage({ params }: Props) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  const [listings, reviews] = await Promise.all([
    searchListingCards({ sellerId: seller.id, perPage: 24, sort: "date" }),
    prisma.review.findMany({
      where: { targetId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { author: { select: { id: true, name: true, avatar: true } } },
    }),
  ]);

  const trust = computeTrust({
    createdAt: seller.createdAt,
    verifiedAt: seller.verifiedAt,
    ratingAvg: seller.ratingAvg,
    ratingCount: seller.ratingCount,
    dealsCount: seller.dealsCount,
    responseMins: seller.responseMins,
    role: seller.role,
    activeListings: seller._count.listings,
  });

  const displayName = seller.businessName ?? seller.name;

  return (
    <div className="container py-6">
      <header className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar className="size-20">
          {seller.avatar ? <AvatarImage src={seller.avatar} alt="" /> : null}
          <AvatarFallback className="text-2xl">{displayName.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-extrabold">
            {displayName}
            {seller.verifiedAt ? (
              <BadgeCheck className="size-5 text-primary" aria-label="מוכר מאומת" />
            ) : null}
            <Badge variant="soft">{trust.levelLabel}</Badge>
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            באתר כבר {timeAgo(seller.createdAt).replace("לפני ", "")} ·{" "}
            <span className="num">{seller._count.listings}</span> מודעות פעילות
            {seller.ratingCount > 0 ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-0.5 align-middle">
                  <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                  <span className="num font-medium text-foreground">
                    {seller.ratingAvg.toFixed(1)}
                  </span>
                  <span className="num">({seller.ratingCount})</span>
                </span>
              </>
            ) : null}
          </p>

          {seller.bio ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{seller.bio}</p>
          ) : null}

          <ul className="mt-3 flex flex-wrap gap-2">
            {trust.signals.map((s) => (
              <li
                key={s.label}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  s.positive
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted-foreground",
                )}
              >
                {s.label}: <span className="num font-medium">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {seller.businessSlug ? (
          <Button asChild variant="outline">
            <Link href={`/business/${seller.businessSlug}`}>
              <Store aria-hidden />
              עמוד העסק
            </Link>
          </Button>
        ) : null}
      </header>

      <section aria-labelledby="seller-listings" className="mb-8">
        <h2 id="seller-listings" className="mb-4 font-heading text-xl font-bold">
          המודעות של {displayName}
        </h2>
        {listings.items.length ? (
          <ListingGrid listings={toListingCardDtos(listings.items)} priorityCount={4} />
        ) : (
          <EmptyResults
            title="אין מודעות פעילות"
            body="למוכר הזה אין כרגע מודעות פעילות בלוח."
          />
        )}
      </section>

      {reviews.length ? (
        <section aria-labelledby="seller-reviews">
          <h2 id="seller-reviews" className="mb-4 font-heading text-xl font-bold">
            דירוגים ({seller.ratingCount})
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Avatar className="size-8">
                        {review.author.avatar ? (
                          <AvatarImage src={review.author.avatar} alt="" />
                        ) : null}
                        <AvatarFallback>{review.author.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Link href={`/u/${review.author.id}`} className="hover:underline">
                        {review.author.name}
                      </Link>
                      <span
                        className="ms-auto flex items-center gap-0.5"
                        aria-label={`דירוג ${review.rating} מתוך 5`}
                      >
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "size-3.5",
                              i < review.rating
                                ? "fill-warning text-warning"
                                : "text-muted-foreground/40",
                            )}
                            aria-hidden
                          />
                        ))}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {review.body ? <p className="text-sm">{review.body}</p> : null}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
