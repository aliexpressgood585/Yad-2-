import { SITE } from "@/lib/site";

/** מזריק בלוק JSON-LD לעמוד. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * נתונים מובנים ברמת האתר: ארגון + אתר עם תיבת חיפוש,
 * כדי ש-Google יוכל להציג sitelinks searchbox.
 */
export function SiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        logo: {
          "@type": "ImageObject",
          url: `${SITE.url}/icons/icon-512.png`,
          width: 512,
          height: 512,
        },
        areaServed: { "@type": "Country", name: "ישראל" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "he-IL",
        publisher: { "@id": `${SITE.url}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE.url}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return <JsonLd data={data} />;
}

/** פירורי לחם מובנים — משפרים את הצגת הנתיב בתוצאות החיפוש. */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "דף הבית",
        item: SITE.url,
      },
      ...items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: item.name,
        item: `${SITE.url}${item.path}`,
      })),
    ],
  };

  return <JsonLd data={data} />;
}
