import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";
import { getRootCategories } from "@/lib/categories";
import { pricePaths } from "@/lib/hebrew-routes";
import { SITE } from "@/lib/site";

/*
 * העמודות נבנות מתוך `t` ולא כקבוע ברמת המודול: קבוע היה מחושב פעם אחת
 * לתהליך ומקבע את השפה של הבקשה הראשונה עבור כל הבקשות הבאות.
 * `id` יציב משמש ל-`aria-labelledby`, כדי שהמזהה לא ישתנה עם השפה.
 */
function columnsFor(t: (key: MessageKey) => string) {
  return [
    {
      id: "board",
      title: t("footer.board"),
      links: [
        { href: "/about", label: t("footer.about") },
        { href: pricePaths.valuation, label: t("footer.priceIndex") },
        { href: pricePaths.guideIndex, label: t("footer.carGuide") },
        { href: pricePaths.cityIndex, label: t("footer.cityPrices") },
        { href: "/help", label: t("footer.help") },
        { href: "/safety", label: t("footer.safety") },
        { href: "/business", label: t("footer.business") },
      ],
    },
    {
      id: "legal",
      title: t("footer.legal"),
      links: [
        { href: "/terms", label: t("footer.terms") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/accessibility", label: t("footer.accessibility") },
        { href: "/cookies", label: t("footer.cookies") },
      ],
    },
  ];
}

export async function SiteFooter() {
  const roots = await getRootCategories();
  const { t } = await getT();
  const year = new Date().getFullYear();
  const columns = columnsFor(t);

  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{SITE.description}</p>
        </div>

        <nav aria-labelledby="footer-categories">
          <h2 id="footer-categories" className="mb-3 text-sm font-bold">
            {t("chrome.categories")}
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

        {columns.map((col) => (
          <nav key={col.id} aria-labelledby={`footer-${col.id}`}>
            <h2 id={`footer-${col.id}`} className="mb-3 text-sm font-bold">
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
            © <span className="num">{year}</span> {SITE.name}. {t("footer.rights")}
          </p>
          <p>{t("footer.builtIn")}</p>
        </div>
      </div>
    </footer>
  );
}
