import type { Metadata } from "next";

import { ContentPage } from "@/components/content-page";
import { getT } from "@/i18n/server";
import { SITE } from "@/lib/site";

/*
 * `generateMetadata` ולא קבוע `metadata`: קבוע מחושב פעם אחת בבנייה,
 * והכותרת בלשונית הדפדפן הייתה נשארת עברית בכל שפה. הפונקציה נקראת לכל
 * בקשה ורואה את העוגייה.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("accessibility.6e51d1"),
    description: t("accessibility.metaDescription"),
    alternates: { canonical: "/accessibility" },
  };
}

export default async function AccessibilityPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("accessibility.6e51d1")}
      intro={t("accessibility.intro", { site: SITE.name })}
      updatedAt={t("accessibility.2847f5")}
    >
      <section>
        <h2>{t("accessibility.109973")}</h2>
        <p>
          {t("accessibility.cca661")}
        </p>
      </section>

      <section>
        <h2>{t("accessibility.40dadb")}</h2>
        <ul>
          <li>{t("accessibility.85d561")}</li>
          <li>{t("accessibility.3ae3cf")}</li>
          <li>{t("accessibility.55afeb")}</li>
          <li>{t("accessibility.30dd24")}</li>
          <li>{t("accessibility.f0633a")}</li>
          <li>{t("accessibility.fc14cd")}</li>
          <li>{t("accessibility.bb0297")}</li>
          <li>{t("accessibility.d67c32")}</li>
          {/*
            * משפט אחד עם פרמטר, ולא שני חצאים סביב <code>. סדר המילים
            * באנגלית ובערבית שונה, וחצי משפט אינו ניתן לתרגום.
            */}
          <li>{t("accessibility.reducedMotion", { property: "prefers-reduced-motion" })}</li>
          <li>{t("accessibility.941be2")}</li>
          <li>{t("accessibility.53917d")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("accessibility.0c4c81")}</h2>
        <p>
          {t("accessibility.f7a0a2")}
        </p>
        <p>
          {t("accessibility.f64f30")}
        </p>
      </section>

      <section>
        <h2>{t("accessibility.5c743d")}</h2>
        <p>
          {t("accessibility.9ecdba")}
        </p>
      </section>
    </ContentPage>
  );
}
