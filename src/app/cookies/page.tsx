import type { Metadata } from "next";

import { ContentPage } from "@/components/content-page";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("cookies.d6aa07"),
    description: t("cookies.intro"),
    alternates: { canonical: "/cookies" },
  };
}

/*
 * הטבלה מחזיקה מפתחות ולא טקסט. השם הטכני של העוגייה אינו מתורגם —
 * הוא מה שהמשתמש יראה בכלי הדפדפן.
 */
const COOKIES: { name: string; purpose: MessageKey; duration: MessageKey; type: MessageKey }[] = [
  { name: "authjs.session-token", purpose: "cookies.p.session", duration: "cookies.d.30days", type: "cookies.t.essential" },
  { name: "authjs.csrf-token", purpose: "cookies.p.csrf", duration: "cookies.d.session", type: "cookies.t.essential" },
  { name: "luach_sid", purpose: "cookies.p.sid", duration: "cookies.d.30minutes", type: "cookies.t.measurement" },
  { name: "luach_locale", purpose: "cookies.p.locale", duration: "cookies.d.year", type: "cookies.t.preference" },
  { name: "theme", purpose: "cookies.p.theme", duration: "cookies.d.year", type: "cookies.t.preference" },
  { name: "luach-compare", purpose: "cookies.p.compare", duration: "cookies.d.untilCleared", type: "cookies.t.preference" },
  { name: "luach-recent", purpose: "cookies.p.recent", duration: "cookies.d.untilCleared", type: "cookies.t.preference" },
  { name: "luach-publish-draft", purpose: "cookies.p.draft", duration: "cookies.d.untilPublished", type: "cookies.t.functional" },
];

export default async function CookiesPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("cookies.d6aa07")}
      intro={t("cookies.intro")}
      updatedAt={t("cookies.2847f5")}
    >
      <div className="not-prose overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{t("cookies.7193f1")}</caption>
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th scope="col" className="p-3 text-start font-medium">
                {t("cookies.346853")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("cookies.9d66d6")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("cookies.4531ad")}
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                {t("cookies.27fd0e")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COOKIES.map((c) => (
              <tr key={c.name}>
                <td className="p-3 font-mono text-xs" dir="ltr">
                  {c.name}
                </td>
                <td className="p-3 text-muted-foreground">{t(c.purpose)}</td>
                <td className="p-3 text-muted-foreground">{t(c.duration)}</td>
                <td className="p-3 text-muted-foreground">{t(c.type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2>{t("cookies.ac519c")}</h2>
        <p>
          {t("cookies.9e64e7")}
        </p>
      </section>
    </ContentPage>
  );
}
