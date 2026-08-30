import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/content-page";
import { Rich } from "@/i18n/rich";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/misc";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("help.title"),
    description: t("help.metaDescription"),
    alternates: { canonical: "/help" },
  };
}

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  {
    q: "help.a514a3",
    a: "help.fd5c05",
  },
  {
    q: "help.4d88b7",
    a: "help.2e59aa",
  },
  {
    q: "help.b10289",
    a: "help.24c6ed",
  },
  {
    q: "help.9ecfcc",
    a: "help.e7484e",
  },
  {
    q: "help.110dbe",
    a: "help.e54ea8",
  },
  {
    q: "help.375664",
    a: "help.cc875a",
  },
  {
    q: "help.70afca",
    a: "help.79d286",
  },
  {
    q: "help.9a0707",
    a: "help.1e021b",
  },
];

export default async function HelpPage() {
  const { t } = await getT();

  return (
    <ContentPage
      title={t("help.36762c")}
      intro={t("help.intro", { site: SITE.name })}
    >
      <Accordion type="single" collapsible className="not-prose">
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`}>
            <AccordionTrigger className="text-start font-medium">{t(item.q)}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{t(item.a)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section>
        <h2>{t("help.c2ce32")}</h2>
        <p>
          <Rich
            message={t("help.contact")}
            slots={{ guide: (text) => <Link href="/safety">{text}</Link> }}
          />
        </p>
      </section>
    </ContentPage>
  );
}
