import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { getRootCategories } from "@/lib/categories";
import { pricePaths } from "@/lib/hebrew-routes";
import { SITE } from "@/lib/site";

const COLUMNS = [
  {
    title: "הלוח",
    links: [
      { href: "/about", label: "אודות" },
      { href: pricePaths.valuation, label: "מדד המחירים" },
      { href: pricePaths.guideIndex, label: "מחירון רכב" },
      { href: pricePaths.cityIndex, label: "מחירי דירות" },
      { href: "/help", label: "עזרה ותמיכה" },
      { href: "/safety", label: "מדריך בטיחות" },
      { href: "/business", label: "פתרונות לעסקים" },
    ],
  },
  {
    title: "משפטי",
    links: [
      { href: "/terms", label: "תנאי שימוש" },
      { href: "/privacy", label: "מדיניות פרטיות" },
      { href: "/accessibility", label: "הצהרת נגישות" },
      { href: "/cookies", label: "מדיניות עוגיות" },
    ],
  },
];

export async function SiteFooter() {
  const roots = await getRootCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{SITE.description}</p>
        </div>

        <nav aria-labelledby="footer-categories">
          <h2 id="footer-categories" className="mb-3 text-sm font-bold">
            קטגוריות
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {roots.map((c) => (
              <li key={c.id}>
                <Link href={`/${c.slug}`} className="hover:text-foreground hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-labelledby={`footer-${col.title}`}>
            <h2 id={`footer-${col.title}`} className="mb-3 text-sm font-bold">
              {col.title}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>
            © <span className="num">{year}</span> {SITE.name}. כל הזכויות שמורות.
          </p>
          <p>נבנה בישראל · אתר נגיש לפי תקן ישראלי 5568 (WCAG 2.1 AA)</p>
        </div>
      </div>
    </footer>
  );
}
