import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("about.title"),
    description: t("about.metaDescription", { site: SITE.name }),
    alternates: { canonical: "/about" },
  };
}

const PRINCIPLES: { icon: typeof Gauge; title: MessageKey; body: MessageKey }[] = [
  {
    icon: Gauge,
    title: "about.221426",
    body: "about.2fedb3",
  },
  {
    icon: Sparkles,
    title: "about.5c4759",
    body: "about.7aa86e",
  },
  {
    icon: ShieldCheck,
    title: "about.84394b",
    body: "about.ff439b",
  },
  {
    icon: HeartHandshake,
    title: "about.f7770f",
    body: "about.c50521",
  },
];

export default async function AboutPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("about.pageTitle", { site: SITE.name })}
      intro={t("about.430d29")}
    >
      <section>
        <h2>{t("about.222adf")}</h2>
        <p>
          {t("about.5f5d0f")}
        </p>
      </section>

      <section>
        <h2>{t("about.c7e6ea")}</h2>
        <ul className="not-prose grid list-none gap-4 ps-0 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                <p.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-heading font-bold">{p.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("about.93dc77")}</h2>
        <p>
          {t("about.2477d3")}
        </p>
      </section>

      <section className="not-prose flex flex-wrap gap-2 rounded-lg bg-muted/50 p-5">
        <div className="flex-1">
          <h2 className="font-heading text-lg font-bold">{t("about.f87974")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("about.0ba617")}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/publish">{t("about.02b929")}</Link>
        </Button>
      </section>
    </ContentPage>
  );
}
