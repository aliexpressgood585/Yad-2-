import type { Metadata } from "next";
import Link from "next/link";

import { formatCompact, formatCount } from "@/lib/format";
import {
  categoryPerformance,
  deadQueries,
  eventVolume,
  funnel,
  northStarByWeek,
} from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "מדידה",
  robots: { index: false, follow: false },
};

/** התקופות שאפשר לבחור. יותר משלוש הופך את המסך לטופס. */
const RANGES = [
  { key: "7", label: "7 ימים", days: 7 },
  { key: "30", label: "30 ימים", days: 30 },
  { key: "90", label: "90 ימים", days: 90 },
] as const;

type Props = { searchParams: Promise<{ range?: string }> };

/**
 * מסך המדידה.
 *
 * מדד אחד בראש, משפך אחד מתחתיו, ושתי טבלאות שאפשר לפעול לפיהן. אין
 * כאן "צפיות היום" ואין גרף עוגה: מסך שמציג שנים-עשר מספרים אינו עונה
 * על שום שאלה, והוא בדיוק מה שגורם לאנשים להפסיק להסתכל על מדידה.
 *
 * הנימוק לבחירת המדד ולמבנה המשפך נמצא ב-GROWTH.md.
 */
export default async function AnalyticsPage({ searchParams }: Props) {
  const { range } = await searchParams;
  const active = RANGES.find((r) => r.key === range) ?? RANGES[1];

  const to = new Date();
  const from = new Date(to.getTime() - active.days * 86_400_000);

  const [weeks, steps, dead, categories, volume] = await Promise.all([
    northStarByWeek(12),
    funnel(from, to),
    deadQueries(from, to),
    categoryPerformance(from, to),
    eventVolume(from, to),
  ]);

  const current = weeks.at(-1)?.connectedListings ?? 0;
  const previous = weeks.at(-2)?.connectedListings ?? 0;
  const peak = Math.max(1, ...weeks.map((w) => w.connectedListings));
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  const top = steps.stages[0]?.sessions ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">מדידה</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            יומן אירועים משלנו, בלי SDK חיצוני.{" "}
            <span className="num">{formatCount(volume)}</span> אירועים בתקופה.
          </p>
        </div>

        <nav aria-label="טווח זמן" className="flex border border-border">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/analytics?range=${r.key}`}
              aria-current={r.key === active.key ? "page" : undefined}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                r.key === active.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* --- מדד הצפון ------------------------------------------------ */}
      <section aria-labelledby="north-star" className="border border-border bg-card p-5">
        <h3 id="north-star" className="font-heading text-lg">
          מודעות מחוברות בשבוע
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          כמה מודעות <strong className="font-semibold text-foreground">שונות</strong> קיבלו
          לפחות פנייה אמיתית אחת — חשיפת טלפון או הודעה ראשונה. זה המדד היחיד שהלוח
          נמדד לפיו: צפיות אפשר להעלות בלי לעזור לאיש, ומספר מודעות שפורסמו הוא היצע
          ולא ערך.
        </p>

        <div className="mt-4 flex flex-wrap items-baseline gap-4">
          <p className="num font-heading text-3xl text-primary">{formatCount(current)}</p>
          {delta === null ? (
            <p className="text-sm text-muted-foreground">אין שבוע קודם להשוואה</p>
          ) : (
            <p className={cn("text-sm", delta >= 0 ? "text-info" : "text-muted-foreground")}>
              <span className="num">{delta > 0 ? `+${delta}` : delta}%</span> מהשבוע שעבר
            </p>
          )}
        </div>

        {/*
         * שנים-עשר שבועות כעמודות. אין כאן ספריית גרפים — זו רשימה של
         * שתים-עשרה מידות, וספרייה של 90KB בשביל שתים-עשרה מידות היא
         * בדיוק סוג ההחלטה שהופכת מסך ניהול לאיטי.
         */}
        <ol className="mt-5 flex h-28 items-end gap-1.5" aria-label="שנים-עשר השבועות האחרונים">
          {weeks.map((w) => {
            const date = new Date(w.weekStart);
            const label = `${date.getUTCDate()}.${date.getUTCMonth() + 1}`;
            return (
              <li key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className="w-full bg-primary/70"
                  style={{ height: `${Math.max(2, (w.connectedListings / peak) * 100)}%` }}
                  title={`${label}: ${w.connectedListings}`}
                />
                <span className="num text-[10px] leading-none text-muted-foreground">
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* --- המשפך ---------------------------------------------------- */}
      <section aria-labelledby="funnel" className="border border-border bg-card p-5">
        <h3 id="funnel" className="font-heading text-lg">
          המשפך
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          נמדד ברמת סשן ולא ברמת קליק, ובשרשרת קפדנית: סשן נספר בשלב רק אם עבר את כל
          השלבים שלפניו.
        </p>

        {top === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            לא נרשמו סשנים עם חיפוש בתקופה הזו.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {steps.stages.map((stage, i) => {
              const previousStage = steps.stages[i - 1];
              const share = (stage.sessions / top) * 100;
              const step =
                previousStage && previousStage.sessions > 0
                  ? Math.round((stage.sessions / previousStage.sessions) * 100)
                  : null;

              return (
                <li key={stage.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-muted-foreground">
                      <span className="num text-foreground">
                        {formatCount(stage.sessions)}
                      </span>{" "}
                      סשנים
                      {step !== null ? (
                        <>
                          {" · "}
                          <span className="num">{step}%</span> מהשלב הקודם
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.max(0.5, share)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/*
         * שני מספרים שנופלים מחוץ לשרשרת. הם מוצגים כאן במפורש כי משפך
         * שמסתיר תנועה אמיתית הוא מכשיר מטעה, ולא מכשיר מקוצר.
         */}
        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              הגיעו למודעה בלי לעבור דרך מסך תוצאות
            </dt>
            <dd className="num mt-0.5 text-sm font-medium">
              {formatCount(steps.viewsWithoutSearch)} סשנים
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">פנו למוכר בלי לחשוף טלפון</dt>
            <dd className="num mt-0.5 text-sm font-medium">
              {formatCount(steps.contactedWithoutReveal)} סשנים
            </dd>
          </div>
        </dl>
      </section>

      {/* --- חיפושים ללא תוצאות --------------------------------------- */}
      <section aria-labelledby="dead-queries" className="border border-border bg-card p-5">
        <h3 id="dead-queries" className="font-heading text-lg">
          חיפושים שלא החזירו כלום
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          כל שורה כאן היא ביקוש שהגיע ללוח ולא מצא היצע — קטגוריה חסרה, מילה נרדפת
          שלא במילון, או שגיאת כתיב שהחיפוש לא סופג.
        </p>

        {dead.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            אין חיפושים ללא תוצאות בתקופה הזו.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {dead.map((q) => (
              <li key={q.query} className="flex items-baseline justify-between gap-3 py-2">
                <span className="truncate text-sm">{q.query}</span>
                <span className="num shrink-0 text-sm text-muted-foreground">
                  {formatCount(q.searches)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- המרה לפי קטגוריה ----------------------------------------- */}
      <section aria-labelledby="by-category" className="border border-border bg-card p-5">
        <h3 id="by-category" className="font-heading text-lg">
          המרה לפי קטגוריה
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          מוצגות רק קטגוריות עם <span className="num">30</span> צפיות ומעלה בתקופה. שיעור
          שמחושב משבע צפיות אינו מדידה.
        </p>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            אין קטגוריה שעברה את סף הצפיות בתקופה הזו.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-start font-medium">
                    קטגוריה
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    צפיות
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    מודעות מחוברות
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    יחס
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => (
                  <tr key={c.categoryId}>
                    <td className="py-2">{c.name}</td>
                    <td className="num py-2">{formatCompact(c.views)}</td>
                    <td className="num py-2">{formatCount(c.connections)}</td>
                    <td className="num py-2">
                      {Math.round((c.connections / c.views) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
