import type { Metadata } from "next";

import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "מדיניות עוגיות",
  description: "אילו עוגיות ואחסון מקומי משמשים באתר ולמה.",
  alternates: { canonical: "/cookies" },
};

const COOKIES = [
  {
    name: "authjs.session-token",
    purpose: "שמירת ההתחברות שלכם בין ביקורים.",
    duration: "30 יום",
    type: "הכרחית",
  },
  {
    name: "authjs.csrf-token",
    purpose: "הגנה מפני זיוף בקשות בין אתרים (CSRF).",
    duration: "הפעלה נוכחית",
    type: "הכרחית",
  },
  {
    name: "luach_sid",
    purpose:
      "מזהה אקראי לביקור הנוכחי, כדי לספור כמה ביקורים הגיעו מחיפוש לפנייה למוכר. " +
      "אינו מקושר לזהות, אינו נשמר בין ביקורים ואינו נשלח לאף גורם חיצוני.",
    duration: "30 דקות מהפעולה האחרונה",
    type: "מדידה",
  },
  {
    name: "theme",
    purpose: "זכירת בחירת מצב התצוגה — פנים המכשיר או פנים היום.",
    duration: "שנה",
    type: "העדפה",
  },
  {
    name: "luach-compare",
    purpose: "רשימת המודעות שבחרתם להשוואה (אחסון מקומי, לא נשלח לשרת).",
    duration: "עד לניקוי ידני",
    type: "העדפה",
  },
  {
    name: "luach-recent",
    purpose: 'מזהי המודעות שנצפו לאחרונה, לרצועת "נצפו לאחרונה" (אחסון מקומי).',
    duration: "עד לניקוי ידני",
    type: "העדפה",
  },
  {
    name: "luach-publish-draft",
    purpose: "טיוטת המודעה שאתם כותבים, כדי שלא תאבד ברענון (אחסון מקומי).",
    duration: "עד לפרסום או לניקוי",
    type: "פונקציונלית",
  },
];

export default function CookiesPage() {
  return (
    <ContentPage
      title="מדיניות עוגיות"
      intro="אנחנו משתמשים בעוגיות הכרחיות, בעוגיית מדידה אחת ובאחסון מקומי בלבד. אין באתר עוגיות מעקב פרסומיות ואין SDK של צד שלישי — המדידה נעשית בשרת שלנו ולא עוזבת אותו."
      updatedAt="אוגוסט 2026"
    >
      <div className="not-prose overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">רשימת העוגיות והאחסון המקומי באתר</caption>
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th scope="col" className="p-3 text-start font-medium">
                שם
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                מטרה
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                תוקף
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                סוג
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COOKIES.map((c) => (
              <tr key={c.name}>
                <td className="p-3 font-mono text-xs" dir="ltr">
                  {c.name}
                </td>
                <td className="p-3 text-muted-foreground">{c.purpose}</td>
                <td className="p-3 text-muted-foreground">{c.duration}</td>
                <td className="p-3 text-muted-foreground">{c.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2>ניהול העוגיות</h2>
        <p>
          אפשר למחוק עוגיות ואחסון מקומי בכל עת מהגדרות הדפדפן. שימו לב שמחיקת העוגיות
          ההכרחיות תנתק אתכם מהחשבון, ומחיקת האחסון המקומי תאפס את רשימת ההשוואה ואת
          המודעות שנצפו לאחרונה.
        </p>
      </section>
    </ContentPage>
  );
}
