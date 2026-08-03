import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, Eye, Heart, MapPin } from "lucide-react";

import { BidiText } from "@/components/bidi-text";
import { Breadcrumbs } from "@/components/browse/breadcrumbs";
import { Gallery } from "@/components/listing/gallery";
import { ContactPanel } from "@/components/listing/contact-panel";
import { PriceDistribution } from "@/components/listing/price-distribution";
import { PriceHistoryNote } from "@/components/listing/price-history-note";
import { ReportDialog } from "@/components/listing/report-dialog";
import { ShareButton } from "@/components/listing/share-button";
import { SellerCard } from "@/components/listing/seller-card";
import { SimilarListings } from "@/components/listing/similar-listings";
import { TrackView } from "@/components/listing/track-view";
import { ListingMap } from "@/components/map/listing-map";
import { FavoriteButton } from "@/components/listing/favorite-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ListingGridSkeleton } from "@/components/listing/listing-grid";
import { auth } from "@/lib/auth";
import { getCategoryPath } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { blurDataUrl } from "@/lib/blur";
import { computeTrust } from "@/lib/trust";
import { decodeSlugParam } from "@/lib/slug";
import { SITE } from "@/lib/site";
import { listingImageTransition } from "@/lib/view-transitions";
import { timeAgo } from "@/lib/utils";
import { formatPrice, formatCount, formatAttributeValue } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/** דפי מודעה נבנים לפי דרישה ונשמרים במטמון לדקה. */
export const revalidate = 60;

async function getListing(rawSlug: string) {
  const slug = decodeSlugParam(rawSlug);
  return prisma.listing.findFirst({
    where: { slug, deletedAt: null },
    include: {
      images: { orderBy: { order: "asc" } },
      category: true,
      priceHistory: { orderBy: { createdAt: "asc" } },
      fraudFlags: true,
      user: {
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
      },
      attributes: {
        include: {
          attribute: true,
          value: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "המודעה לא נמצאה" };

  const price = formatPrice(listing.price, { currency: listing.currency });
  const title = `${listing.title} — ${price}`;
  const description = listing.description.slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/item/${listing.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/item/${listing.slug}`,
      images: [
        {
          url: `/item/${listing.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: listing.title,
        },
      ],
    },
    robots:
      listing.status === "ACTIVE"
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const [listing, session] = await Promise.all([getListing(slug), auth()]);

  if (!listing || listing.status === "BANNED") notFound();

  const isOwner = session?.user?.id === listing.userId;
  const path = await getCategoryPath(listing.categoryId);

  const trust = computeTrust({
    createdAt: listing.user.createdAt,
    verifiedAt: listing.user.verifiedAt,
    ratingAvg: listing.user.ratingAvg,
    ratingCount: listing.user.ratingCount,
    dealsCount: listing.user.dealsCount,
    responseMins: listing.user.responseMins,
    role: listing.user.role,
    activeListings: listing.user._count.listings,
  });

  // שדות דינמיים מקובצים לתצוגת מפרט
  const specs = listing.attributes
    .map((a) => ({
      key: a.attribute.key,
      label: a.attribute.label,
      order: a.attribute.order,
      value: formatAttributeValue(a),
    }))
    .filter((s) => s.value)
    .sort((a, b) => a.order - b.order);

  const publicWarning = listing.fraudFlags
    .filter((f) => f.severity !== "LOW")
    .map((f) =>
      f.code === "PRICE_TOO_LOW"
        ? "המחיר נמוך משמעותית ממחיר השוק בקטגוריה — סימן אזהרה מוכר."
        : f.code === "SUSPICIOUS_TEXT"
          ? "המודעה מכילה ניסוחים שמאפיינים ניסיונות הונאה."
          : "תמונות המודעה מופיעות גם במודעות אחרות באתר.",
    );

  const images = listing.images.map((img) => ({
    url: img.url,
    thumbUrl: img.thumbUrl ?? img.url,
    blurDataURL: img.blurhash ? blurDataUrl(img.blurhash) : null,
    width: img.width ?? 1200,
    height: img.height ?? 900,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description.slice(0, 500),
    image: listing.images.slice(0, 5).map((i) => i.url),
    category: path.map((p) => p.name).join(" > "),
    ...(listing.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: listing.price,
            priceCurrency: listing.currency,
            availability:
              listing.status === "ACTIVE"
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
            url: `${SITE.url}/item/${listing.slug}`,
            itemCondition: "https://schema.org/UsedCondition",
            areaServed: listing.city,
            seller: {
              "@type": listing.user.businessName ? "Organization" : "Person",
              name: listing.user.businessName ?? listing.user.name,
            },
          },
        }
      : {}),
    ...(listing.user.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: listing.user.ratingAvg,
            reviewCount: listing.user.ratingCount,
          },
        }
      : {}),
  };

  const publishedAt = listing.publishedAt ?? listing.createdAt;

  return (
    <div className="container py-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackView listingId={listing.id} />

      <Breadcrumbs path={path} />

      {listing.status !== "ACTIVE" ? (
        <p className="mt-3 rounded-lg bg-warning/15 p-3 text-sm font-medium text-warning-foreground">
          {listing.status === "SOLD"
            ? "המודעה סומנה כנמכרה."
            : listing.status === "EXPIRED"
              ? "תוקף המודעה פג. ייתכן שהפריט כבר לא זמין."
              : "המודעה אינה פעילה כרגע."}
        </p>
      ) : null}

      {publicWarning.length ? (
        <aside
          role="note"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm">
            <p className="font-bold text-destructive">שימו לב לפני שממשיכים</p>
            <p className="mt-0.5 text-foreground/90">{publicWarning.join(" ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              לעולם אל תעבירו כסף לפני שראיתם את הפריט פנים מול פנים.{" "}
              <Link href="/safety" className="underline">
                מדריך בטיחות
              </Link>
            </p>
          </div>
        </aside>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* --- עמודה ראשית --- */}
        <div className="min-w-0 space-y-6">
          <Gallery
            images={images}
            title={listing.title}
            transitionName={listingImageTransition(listing.id)}
          />

          <div>
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="flex-1 font-heading text-2xl font-extrabold sm:text-3xl">
                <BidiText>{listing.title}</BidiText>
              </h1>
              <div className="flex items-center gap-1.5">
                <ShareButton title={listing.title} />
                <FavoriteButton listingId={listing.id} variant="inline" />
              </div>
            </div>

            <p className="mt-2 font-heading text-3xl font-extrabold text-primary">
              <span className="num">
                {formatPrice(listing.price, { currency: listing.currency })}
              </span>
              {listing.isNegotiable ? (
                <span className="ms-2 align-middle text-sm font-medium text-muted-foreground">
                  (מחיר גמיש)
                </span>
              ) : null}
            </p>

            <PriceHistoryNote
              history={listing.priceHistory.map((h) => ({
                price: h.price,
                createdAt: h.createdAt.toISOString(),
              }))}
            />

            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {listing.city}
                {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
              </li>
              <li>
                <time dateTime={publishedAt.toISOString()}>פורסם {timeAgo(publishedAt)}</time>
              </li>
              <li className="flex items-center gap-1">
                <Eye className="size-4" aria-hidden />
                <span className="num">{formatCount(listing.viewCount)}</span> צפיות
              </li>
              {listing.favoriteCount > 0 ? (
                <li className="flex items-center gap-1">
                  <Heart className="size-4" aria-hidden />
                  <span className="num">{listing.favoriteCount}</span> שמירות
                </li>
              ) : null}
              <li>
                <Badge variant="muted">{listing.category.name}</Badge>
              </li>
            </ul>
          </div>

          {/* --- מפרט --- */}
          {specs.length ? (
            <section aria-labelledby="specs-heading">
              <h2 id="specs-heading" className="mb-3 font-heading text-lg font-bold">
                מפרט
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-0 rounded-lg border border-border bg-card p-1 sm:grid-cols-3">
                {specs.map((spec, i) => (
                  <div
                    key={`${spec.key}-${i}`}
                    className="flex flex-col gap-0.5 border-b border-border/60 px-3 py-2.5 last:border-b-0"
                  >
                    <dt className="text-xs text-muted-foreground">{spec.label}</dt>
                    <dd className="num text-sm font-medium">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* --- התפלגות המחיר --- */}
          <Suspense fallback={null}>
            <PriceDistribution
              listingId={listing.id}
              price={listing.price}
              currency={listing.currency}
            />
          </Suspense>

          {/* --- תיאור --- */}
          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="mb-2 font-heading text-lg font-bold">
              תיאור המודעה
            </h2>
            <p className="whitespace-pre-line text-pretty leading-relaxed">
              {listing.description}
            </p>
          </section>

          {/* --- מיקום --- */}
          {listing.displayLat && listing.displayLng ? (
            <section aria-labelledby="location-heading">
              <h2 id="location-heading" className="mb-2 font-heading text-lg font-bold">
                מיקום מקורב
              </h2>
              <ListingMap
                lat={listing.displayLat}
                lng={listing.displayLng}
                label={`${listing.city}${listing.neighborhood ? `, ${listing.neighborhood}` : ""}`}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                מטעמי פרטיות מוצג אזור מקורב בלבד ולא הכתובת המדויקת. הכתובת נמסרת ע&quot;י המוכר
                בתיאום פגישה.
              </p>
            </section>
          ) : null}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              מספר מודעה: <span className="num">{listing.id.slice(-8)}</span>
            </p>
            <ReportDialog listingId={listing.id} />
          </div>
        </div>

        {/* --- עמודה צדדית --- */}
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <ContactPanel
            listingId={listing.id}
            slug={listing.slug}
            title={listing.title}
            contactName={listing.contactName ?? listing.user.name}
            allowChat={listing.allowChat}
            isOwner={isOwner}
            isActive={listing.status === "ACTIVE"}
          />
          <SellerCard
            seller={{
              id: listing.user.id,
              name: listing.user.name,
              avatar: listing.user.avatar,
              bio: listing.user.bio,
              businessName: listing.user.businessName,
              businessSlug: listing.user.businessSlug,
              createdAt: listing.user.createdAt.toISOString(),
              activeListings: listing.user._count.listings,
            }}
            trust={trust}
          />
        </aside>
      </div>

      {/* --- מודעות דומות --- */}
      <Suspense fallback={<ListingGridSkeleton count={4} />}>
        <SimilarListings
          listingId={listing.id}
          categoryId={listing.categoryId}
          city={listing.city}
          price={listing.price}
          title={listing.title}
        />
      </Suspense>
    </div>
  );
}
