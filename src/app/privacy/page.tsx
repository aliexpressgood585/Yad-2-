import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/content-page";
import { Rich } from "@/i18n/rich";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("privacy.title"),
    description: t("privacy.metaDescription", { site: SITE.name }),
    alternates: { canonical: "/privacy" },
  };
}

const COLLECTED: MessageKey[] = [
  "privacy.collected.identity",
  "privacy.collected.content",
  "privacy.collected.location",
  "privacy.collected.usage",
];

export default async function PrivacyPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("privacy.cb28e8")}
      intro={t("privacy.5de7c3")}
      updatedAt={t("privacy.2847f5")}
    >
      <section>
        <h2>{t("privacy.270d9f")}</h2>
        <ul>
          {/*
            * כל פריט הוא מחרוזת אחת עם תגית <label>, ולא כותרת מודגשת
            * ואחריה טקסט נפרד. הפרדה לשניים מחייבת שהמודגש יבוא ראשון
            * בכל שפה, וזה אינו נכון באנגלית.
            */}
          {COLLECTED.map((key) => (
            <li key={key}>
              <Rich message={t(key)} slots={{ label: (text) => <strong>{text}</strong> }} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("privacy.4c317d")}</h2>
        <ul>
          <li>{t("privacy.b18e55")}</li>
          <li>{t("privacy.6f9a41")}</li>
          <li>{t("privacy.cd5b57")}</li>
          <li>
            {t("privacy.f475f9")}
          </li>
          <li>{t("privacy.211921")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("privacy.dbf8e4")}</h2>
        <p>
          {t("privacy.8f8504")}
        </p>
      </section>

      <section>
        <h2>{t("privacy.db72cb")}</h2>
        <p>
          <Rich
            message={t("privacy.rights")}
            slots={{ help: (text) => <Link href="/help">{text}</Link> }}
          />
        </p>
      </section>

      <section>
        <h2>{t("privacy.cc968e")}</h2>
        <p>
          <Rich
            message={t("privacy.cookies")}
            slots={{ policy: (text) => <Link href="/cookies">{text}</Link> }}
          />
        </p>
      </section>

      <section>
        <h2>{t("privacy.88cc23")}</h2>
        <p>
          {t("privacy.5b4e84")}
        </p>
      </section>
    </ContentPage>
  );
}
