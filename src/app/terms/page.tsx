import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/content-page";
import { Rich } from "@/i18n/rich";
import { getT } from "@/i18n/server";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("terms.title"),
    description: t("terms.metaDescription", { site: SITE.name }),
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("terms.21c6a1")}
      intro={t("terms.intro", { site: SITE.name })}
      updatedAt={t("terms.2847f5")}
    >
      <section>
        <h2>{t("terms.57a2ef")}</h2>
        <p>
          {t("terms.6df62a")}
        </p>
      </section>

      <section>
        <h2>{t("terms.dbb0e9")}</h2>
        <ul>
          <li>{t("terms.994e39")}</li>
          <li>{t("terms.b78176")}</li>
          <li>{t("terms.1a6dad")}</li>
          <li>{t("terms.ad58fc")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("terms.444d58")}</h2>
        <p>{t("terms.4e9d11")}</p>
        <ul>
          <li>{t("terms.3fc9db")}</li>
          <li>{t("terms.beb3bb")}</li>
          <li>{t("terms.f1fd7f")}</li>
          <li>{t("terms.77e2db")}</li>
          <li>{t("terms.c515ba")}</li>
          <li>{t("terms.2ef6b7")}</li>
          <li>{t("terms.a84b78")}</li>
        </ul>
        <p>
          {t("terms.34dd63")}
        </p>
      </section>

      <section>
        <h2>{t("terms.deb747")}</h2>
        <p>
          {t("terms.7515c8")}
        </p>
      </section>

      <section>
        <h2>{t("terms.6eb325")}</h2>
        <p>
          {t("terms.e90c88")}
        </p>
      </section>

      <section>
        <h2>{t("terms.023d8b")}</h2>
        <p>
          <Rich
            message={t("terms.liability")}
            slots={{ guide: (text) => <Link href="/safety">{text}</Link> }}
          />
        </p>
      </section>

      <section>
        <h2>{t("terms.497f04")}</h2>
        <p>
          {t("terms.64c7b9")}
        </p>
      </section>

      <section>
        <h2>{t("terms.da4baa")}</h2>
        <p>
          {t("terms.3af9b6")}
        </p>
      </section>
    </ContentPage>
  );
}
