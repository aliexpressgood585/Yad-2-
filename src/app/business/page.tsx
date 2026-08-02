import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Rocket, Store, Users } from "lucide-react";

import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";
import { BOOST_PACKAGES, SITE } from "@/lib/site";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "פתרונות לעסקים",
  description: `עמוד עסק, קידום מודעות וסטטיסטיקות מכירה ב${SITE.name}.`,
  alternates: { canonical: "/business" },
};

const FEATURES = [
  {
    icon: Store,
    title: "עמוד עסק ייעודי",
    body: "כתובת קבועה עם הלוגו, התיאור וכל המודעות שלכם במקום אחד — נגישה גם ממנועי החיפוש.",
  },
  {
    icon: BarChart3,
    title: "סטטיסטיקות אמיתיות",
    body: "צפיות, חשיפות טלפון, שמירות ושיעור המרה לכל מודעה, עם גרף יומי ותובנות מעשיות.",
  },
  {
    icon: Users,
    title: "ניהול פניות",
    body: "כל השיחות עם הלקוחות במקום אחד, עם סימון נקרא והתראות מיידיות.",
  },
  {
    icon: Rocket,
    title: "קידום ממוקד",
    body: "חבילות קידום לפי הצורך — רענון, הדגשה, ראש הקטגוריה או חשיפה בדף הבית.",
  },
];

export default function BusinessLandingPage() {
  return (
    <ContentPage
      title="פתרונות לעסקים"
      intro="כלים למי שמפרסם הרבה: עמוד עסק, נתונים אמיתיים על ביצועי המודעות, ואפשרויות קידום."
    >
      <section>
        <h2>מה מקבלים</h2>
        <ul className="not-prose grid list-none gap-4 ps-0 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3 rounded-lg border border-border p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                <f.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-heading font-bold">{f.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>חבילות קידום</h2>
        <p>
          כל חבילה נרכשת למודעה בודדת ולתקופה מוגדרת. אפשר לרכוש ישירות מהאזור האישי,
          בלחיצה על &quot;קידום&quot; ליד המודעה.
        </p>
        <ul className="not-prose grid list-none gap-3 ps-0 sm:grid-cols-2">
          {BOOST_PACKAGES.map((pkg) => (
            <li
              key={pkg.kind}
              className="flex items-start gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex-1">
                <h3 className="font-heading font-bold">{pkg.name}</h3>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
              </div>
              <div className="text-end">
                <p className="num font-heading text-lg font-extrabold">
                  {formatPrice(pkg.priceIls)}
                </p>
                <p className="num text-xs text-muted-foreground">{pkg.days} ימים</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="not-prose flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-5">
        <div className="flex-1">
          <h2 className="font-heading text-lg font-bold">מתחילים בחינם</h2>
          <p className="text-sm text-muted-foreground">
            פותחים חשבון, מוסיפים את פרטי העסק בפרופיל, ועמוד העסק נוצר אוטומטית.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/my/profile">להגדרת פרופיל העסק</Link>
        </Button>
      </section>
    </ContentPage>
  );
}
