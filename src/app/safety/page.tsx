import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { ContentPage } from "@/components/content-page";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("safety.9d342f"),
    description: t("safety.metaDescription"),
    alternates: { canonical: "/safety" },
  };
}

const RED_FLAGS: MessageKey[] = [
  "safety.14fe48",
  "safety.a98618",
  "safety.36b50b",
  "safety.65e501",
  "safety.4b6fde",
  "safety.289d18",
  "safety.64c0fa",
];

const SAFE_RULES: MessageKey[] = [
  "safety.ebd09a",
  "safety.2c8097",
  "safety.8531e2",
  "safety.020c18",
  "safety.208032",
  "safety.86f9cd",
  "safety.d62c13",
];

export default async function SafetyPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("safety.9d342f")}
      intro={t("safety.918c33")}
    >
      <section>
        <h2 className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
          {t("safety.redFlagsHeading")}
        </h2>
        <p>{t("safety.2bf010")}</p>
        <ul>
          {RED_FLAGS.map((flag) => (
            <li key={flag}>{t(flag)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          {t("safety.safeRulesHeading")}
        </h2>
        <ul>
          {SAFE_RULES.map((rule) => (
            <li key={rule}>{t(rule)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("safety.f4d92d")}</h2>
        <ul>
          <li>{t("safety.afca4b")}</li>
          <li>
            {t("safety.f811dc")}
          </li>
          <li>{t("safety.1d77a6")}</li>
          <li>{t("safety.83d4b3")}</li>
          <li>{t("safety.1458d9")}</li>
          <li>{t("safety.56a214")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("safety.2281e1")}</h2>
        <ol>
          <li>{t("safety.e028e4")}</li>
          <li>
            {t("safety.deb355")}
          </li>
          <li>{t("safety.ddf4a4")}</li>
        </ol>
      </section>
    </ContentPage>
  );
}
