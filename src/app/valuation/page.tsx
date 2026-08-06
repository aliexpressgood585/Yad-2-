import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ValuationForm, type ValuationFormValues } from "@/components/valuation/valuation-form";
import { NotEnoughData, ValuationResult } from "@/components/valuation/valuation-result";
import { SpeedCurve } from "@/components/valuation/speed-curve";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatNumber } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { SITE } from "@/lib/site";
import { getCategoryBySlug } from "@/lib/categories";
import { speedCurveFor } from "@/lib/time-to-sale";
import { slugify } from "@/lib/utils";
import {
  DEAL_LABEL,
  medianPricePerSqm,
  neighborhoodMap,
  realEstateCityOptions,
  valueRealEstate,
  valueVehicle,
  vehicleMakeOptions,
  type DealKind,
} from "@/lib/valuation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * הדף תלוי בפרמטרים של המשתמש ובמצב המודעות ברגע זה, ולכן הוא נבנה
 * בכל בקשה. דפי הנחיתה (`/מחירון`, `/מחירים`) הם הצד הנשמר במטמון.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מדד המחירים — כמה זה שווה",
  description:
    "בדיקת שווי לרכב ולדירה לפי מחירי המודעות בלוח ברגע זה: טווח, חציון, התפלגות וגודל המדגם. בלי הערכות ובלי מספרים מומצאים.",
  alternates: { canonical: pricePaths.valuation },
  openGraph: {
    title: "מדד המחירים — כמה זה שווה",
    description: "טווח שווי לרכב ולדירה, מבוסס על מחירי המודעות בלוח.",
    url: pricePaths.valuation,
  },
};

/**
 * ערך יחיד מתוך פרמטר. `any` הוא הערך ש-Radix שולח עבור "לא משנה"
 * (רכיב Select אינו מרשה פריט עם ערך ריק), והוא נקרא כאן כ"לא נבחר".
 */
function one(value: string | string[] | undefined): string {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return raw === "any" ? "" : raw;
}

function num(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function ValuationPage({ searchParams }: Props) {
  const params = await searchParams;

  const type = one(params.type) === "realestate" ? "realestate" : "vehicle";
  const deal: DealKind = one(params.deal) === "rent" ? "rent" : "sale";

  const initial: ValuationFormValues = {
    type,
    manufacturer: one(params.make),
    model: one(params.model),
    year: one(params.year),
    hand: one(params.hand),
    km: one(params.km),
    deal,
    city: one(params.city),
    neighborhood: one(params.hood),
    rooms: one(params.rooms),
    size: one(params.size),
  };

  const [makes, cities, neighborhoods] = await Promise.all([
    vehicleMakeOptions(),
    realEstateCityOptions(),
    neighborhoodMap(),
  ]);

  return (
    <div className="container max-w-4xl py-6">
      <BreadcrumbJsonLd items={[{ name: "מדד המחירים", path: pricePaths.valuation }]} />

      <header className="mb-5">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">כמה זה שווה</h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          תארו מה יש לכם ותקבלו את טווח המחירים של מודעות דומות בלוח ברגע זה — חציון,
          התפלגות וגודל המדגם. אין כאן הערכת שמאי ואין נוסחה: רק מה שאנשים מבקשים בפועל
          על אותו דבר.
        </p>
      </header>

      <ValuationForm
        makes={makes}
        cities={cities}
        neighborhoods={neighborhoods}
        initial={initial}
      />

      <div className="mt-6">
        <Suspense fallback={<ResultSkeleton />}>
          {type === "vehicle" && initial.manufacturer ? (
            <VehicleResult values={initial} />
          ) : type === "realestate" && initial.city ? (
            <RealEstateResult values={initial} />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              בחרו {type === "vehicle" ? "יצרן" : "עיר"} כדי לראות טווח שווי.
            </p>
          )}
        </Suspense>
      </div>

      <PublishCta />
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function VehicleResult({ values }: { values: ValuationFormValues }) {
  const result = await valueVehicle({
    manufacturer: values.manufacturer,
    model: values.model || null,
    year: num(values.year),
    hand: num(values.hand),
    km: num(values.km),
  });

  const requested = [values.manufacturer, values.model].filter(Boolean).join(" ");

  if (!result.summary) {
    return <NotEnoughData sample={result.sample} what={requested} publishHref="/publish" />;
  }

  // הכותרת מתארת את מה שהושווה בפועל. כשההשוואה ויתרה על הדגם, כותרת
  // שמזכירה אותו הייתה סותרת את שורת "התעלמנו מ" שמתחתיה.
  const comparedModel = result.dropped.includes("דגם") ? "" : values.model;
  const compared = [values.manufacturer, comparedModel].filter(Boolean).join(" ");

  const guideHref = values.model
    ? pricePaths.guide(slugify(values.manufacturer), slugify(values.model))
    : null;

  /*
   * עקומת המחיר-מהירות משלימה את הטווח.
   *
   * הטווח אומר "כמה זה שווה"; העקומה אומרת "כמה זמן זה ייקח" — ורק
   * שתיהן יחד מאפשרות למוכר להכריע, כי בלי הזמן אין לו דרך לדעת אם
   * כדאי לו לרדת במחיר.
   *
   * `null` כשאין מספיק מכירות, ואז פשוט לא מוצג דבר.
   */
  const carsCategory = await getCategoryBySlug("private-cars");
  const curve = carsCategory ? await speedCurveFor(carsCategory.id) : null;

  return (
    <ValuationResult
      summary={result.summary}
      criteria={[
        { label: "יצרן", value: values.manufacturer, numeric: false },
        ...result.criteria,
      ]}
      dropped={result.dropped}
      title={`טווח המחירים המבוקש ל${compared}`}
    >
      {curve ? <SpeedCurve curve={curve} price={result.summary.median} /> : null}

      {guideHref ? (
        <p className="text-sm">
          <Link href={guideHref} className="inline-flex items-center gap-1 text-info underline underline-offset-2">
            מחירון {requested} — מגמה שנתית וכל המודעות
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </p>
      ) : null}
    </ValuationResult>
  );
}

async function RealEstateResult({ values }: { values: ValuationFormValues }) {
  const result = await valueRealEstate({
    deal: values.deal,
    city: values.city,
    neighborhood: values.neighborhood || null,
    rooms: num(values.rooms),
    size: num(values.size),
  });

  const describe = (rooms: string) =>
    `דירה ${DEAL_LABEL[values.deal]} ב${values.city}${
      rooms ? `, ${formatNumber(Number(rooms))} חדרים` : ""
    }`;

  if (!result.summary) {
    return (
      <NotEnoughData sample={result.sample} what={describe(values.rooms)} publishHref="/publish" />
    );
  }

  // כמו ברכב: הכותרת מתארת את ההשוואה שרצה, לא את הבקשה
  const compared = describe(result.dropped.includes("חדרים") ? "" : values.rooms);

  return (
    <ValuationResult
      summary={result.summary}
      criteria={[
        { label: "עסקה", value: DEAL_LABEL[values.deal], numeric: false },
        ...result.criteria,
      ]}
      dropped={result.dropped}
      title={`טווח המחירים המבוקש ל${compared}`}
      perSqm={medianPricePerSqm(result.matched)}
    >
      <p className="text-sm">
        <Link
          href={pricePaths.city(slugify(values.city))}
          className="inline-flex items-center gap-1 text-info underline underline-offset-2"
        >
          מחירי הדירות ב{values.city} — לפי מספר חדרים ולאורך השנה
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
      </p>
    </ValuationResult>
  );
}

/* -------------------------------------------------------------------------- */

/** סגירת המעגל: מי שבדק שווי הוא בדיוק מי ששוקל למכור. */
function PublishCta() {
  return (
    <aside className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-heading text-lg font-bold">יש לך כזה למכירה?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          פרסום מודעה ב{SITE.name} חינם, ולוקח כמה דקות.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/publish">פרסם מודעה</Link>
      </Button>
    </aside>
  );
}
