import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";

import { ListingGrid, EmptyResults } from "@/components/listing/listing-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";
import { SITE } from "@/lib/site";
import { timeAgo } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 600;

async function getBusiness(slug: string) {
  return prisma.user.findFirst({
    where: { businessSlug: slug, deletedAt: null, isBlocked: false },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      verifiedAt: true,
      ratingAvg: true,
      ratingCount: true,
      businessName: true,
      businessSlug: true,
      businessAbout: true,
      businessLogo: true,
      businessCity: true,
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) return { title: "העסק לא נמצא" };

  const name = business.businessName ?? business.name;
  return {
    title: name,
    description:
      business.businessAbout?.slice(0, 155) ??
      `${name} — ${business._count.listings} מודעות פעילות ב${SITE.name}.`,
    alternates: { canonical: `/business/${business.businessSlug}` },
    openGraph: { title: name, url: `/business/${business.businessSlug}` },
  };
}

export default async function BusinessPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();

  const listings = await searchListingCards({
    sellerId: business.id,
    perPage: 24,
    sort: "date",
  });

  const name = business.businessName ?? business.name;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description: business.businessAbout ?? undefined,
    url: `${SITE.url}/business/${business.businessSlug}`,
    ...(business.businessCity
      ? { address: { "@type": "PostalAddress", addressLocality: business.businessCity } }
      : {}),
    ...(business.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: business.ratingAvg,
            reviewCount: business.ratingCount,
          },
        }
      : {}),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="border-b border-border bg-gradient-to-b from-primary-soft/60 to-background">
        <div className="container flex flex-wrap items-center gap-4 py-8">
          <Avatar className="size-20 border-2 border-background shadow-lifted">
            {business.businessLogo || business.avatar ? (
              <AvatarImage src={business.businessLogo ?? business.avatar!} alt="" />
            ) : null}
            <AvatarFallback className="text-2xl">{name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-extrabold sm:text-3xl">
              {name}
              <BadgeCheck className="size-5 text-primary" aria-label="עסק מאומת" />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <Badge variant="soft">עסק</Badge>
              {business.businessCity ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {business.businessCity}
                </span>
              ) : null}
              <span className="num">{business._count.listings} מודעות פעילות</span>
              {business.ratingCount > 0 ? (
                <span className="flex items-center gap-0.5">
                  <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                  <span className="num">
                    {business.ratingAvg.toFixed(1)} ({business.ratingCount})
                  </span>
                </span>
              ) : null}
              <span>פעיל באתר {timeAgo(business.createdAt).replace("לפני ", "")}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {business.businessAbout ? (
          <section aria-labelledby="about-heading" className="mb-8 max-w-3xl">
            <h2 id="about-heading" className="mb-2 font-heading text-lg font-bold">
              על העסק
            </h2>
            <p className="whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {business.businessAbout}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="business-listings">
          <h2 id="business-listings" className="mb-4 font-heading text-xl font-bold">
            המודעות שלנו
          </h2>
          {listings.items.length ? (
            <ListingGrid listings={toListingCardDtos(listings.items)} priorityCount={4} />
          ) : (
            <EmptyResults title="אין מודעות פעילות" body="לעסק הזה אין כרגע מודעות באוויר." />
          )}
        </section>
      </div>
    </div>
  );
}
