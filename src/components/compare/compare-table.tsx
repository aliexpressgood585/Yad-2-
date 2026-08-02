"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Scale, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyResults } from "@/components/listing/listing-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompare } from "@/stores/compare";
import { cn, timeAgo } from "@/lib/utils";
import { formatPrice, formatCount } from "@/lib/format";

type CompareListing = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  currency: string;
  city: string;
  neighborhood: string | null;
  categoryName: string;
  date: string;
  viewCount: number;
  imageUrl: string | null;
  seller: {
    id: string;
    name: string;
    ratingAvg: number;
    ratingCount: number;
    verified: boolean;
  };
  specs: Record<string, { label: string; value: string; order: number }>;
};

export function CompareTable() {
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

  const [data, setData] = React.useState<CompareListing[] | null>(null);
  const ids = items.map((i) => i.id).join(",");

  React.useEffect(() => {
    if (!ids) {
      setData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setData(null);
      try {
        const res = await fetch(`/api/listings/compare?ids=${ids}`);
        if (!res.ok) return;
        const json = (await res.json()) as { items: CompareListing[] };
        if (!cancelled) setData(json.items);
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (data === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <Skeleton key={i.id} className="h-96" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <EmptyResults
        title="לא נבחרו מודעות להשוואה"
        body="בכל כרטיס מודעה יש כפתור השוואה (סמל המאזניים). בחרו עד 4 מודעות מאותה קטגוריה."
        action={
          <Button asChild>
            <Link href="/">לעיון במודעות</Link>
          </Button>
        }
      />
    );
  }

  // איחוד כל מפתחות המפרט לשורות הטבלה, לפי סדר ההגדרה בקטגוריה
  const specKeys = Array.from(
    new Map(
      data
        .flatMap((l) => Object.entries(l.specs))
        .map(([key, spec]) => [key, spec] as const),
    ).entries(),
  ).sort((a, b) => a[1].order - b[1].order);

  /** שורה שבה כל הערכים זהים אינה מסייעת להשוואה — נסמן רק את השונות. */
  const isDifferent = (key: string) => {
    const values = data.map((l) => l.specs[key]?.value ?? "—");
    return new Set(values).size > 1;
  };

  const cheapest = Math.min(...data.filter((l) => l.price !== null).map((l) => l.price!));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="size-4" aria-hidden />
          <span className="num">{data.length}</span> מודעות בהשוואה
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          ניקוי ההשוואה
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">טבלת השוואה בין המודעות שנבחרו</caption>
          <thead>
            <tr>
              <th scope="col" className="w-32 border-b border-border bg-muted/50 p-3 text-start">
                <span className="sr-only">מאפיין</span>
              </th>
              {data.map((l) => (
                <th
                  key={l.id}
                  scope="col"
                  className="border-b border-s border-border p-3 text-start align-top"
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      aria-label={`הסרת ${l.title} מההשוואה`}
                      className="absolute end-0 top-0 grid size-6 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>

                    <Link href={`/item/${l.slug}`} className="block">
                      <div className="relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                        {l.imageUrl ? (
                          <Image
                            src={l.imageUrl}
                            alt=""
                            fill
                            sizes="200px"
                            className="object-cover"
                            unoptimized={l.imageUrl.startsWith("/uploads")}
                          />
                        ) : null}
                      </div>
                      <p className="line-clamp-2-fixed font-medium leading-tight hover:underline">
                        {l.title}
                      </p>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Row label="מחיר" highlight>
              {data.map((l) => (
                <Cell key={l.id}>
                  <span
                    className={cn(
                      "num font-heading text-lg font-bold",
                      l.price === cheapest ? "text-success" : "text-foreground",
                    )}
                  >
                    {formatPrice(l.price, { currency: l.currency })}
                  </span>
                  {l.price === cheapest && data.length > 1 ? (
                    <span className="block text-xs font-medium text-success">הזול ביותר</span>
                  ) : null}
                </Cell>
              ))}
            </Row>

            <Row label="מיקום">
              {data.map((l) => (
                <Cell key={l.id}>
                  {l.city}
                  {l.neighborhood ? `, ${l.neighborhood}` : ""}
                </Cell>
              ))}
            </Row>

            <Row label="פורסמה">
              {data.map((l) => (
                <Cell key={l.id}>{timeAgo(l.date)}</Cell>
              ))}
            </Row>

            <Row label="צפיות">
              {data.map((l) => (
                <Cell key={l.id}>
                  <span className="num">{formatCount(l.viewCount)}</span>
                </Cell>
              ))}
            </Row>

            <Row label="מוכר">
              {data.map((l) => (
                <Cell key={l.id}>
                  <Link href={`/u/${l.seller.id}`} className="hover:underline">
                    {l.seller.name}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {l.seller.verified ? (
                      <BadgeCheck className="size-3.5 text-primary" aria-hidden />
                    ) : null}
                    {l.seller.ratingCount > 0 ? (
                      <>
                        <Star className="size-3 fill-warning text-warning" aria-hidden />
                        <span className="num">
                          {l.seller.ratingAvg.toFixed(1)} ({l.seller.ratingCount})
                        </span>
                      </>
                    ) : (
                      "אין דירוגים"
                    )}
                  </span>
                </Cell>
              ))}
            </Row>

            {specKeys.map(([key, spec]) => (
              <Row key={key} label={spec.label} highlight={isDifferent(key)}>
                {data.map((l) => (
                  <Cell key={l.id}>
                    <span className="num">{l.specs[key]?.value ?? "—"}</span>
                  </Cell>
                ))}
              </Row>
            ))}

            <Row label="">
              {data.map((l) => (
                <Cell key={l.id}>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/item/${l.slug}`}>למודעה</Link>
                  </Button>
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        שורות שבהן יש הבדל בין המודעות מסומנות ברקע בהיר.
      </p>
    </div>
  );
}

function Row({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr className={cn("border-b border-border last:border-b-0", highlight && "bg-primary-soft/25")}>
      <th scope="row" className="p-3 text-start align-top text-xs font-medium text-muted-foreground">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="border-s border-border p-3 align-top">{children}</td>;
}
