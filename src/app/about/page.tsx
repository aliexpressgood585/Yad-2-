import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "אודות",
  description: `${SITE.name} — לוח מודעות ישראלי נקי, מהיר והוגן. הסיפור והעקרונות שמאחורי האתר.`,
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    icon: Gauge,
    title: "מהירות לפני הכול",
    body: "עמודים נטענים מיידית, החיפוש מגיב תוך כדי הקלדה, ואין באנרים שקופצים ומזיזים את התוכן.",
  },
  {
    icon: Sparkles,
    title: "ממשק נקי",
    body: "לא יותר מרכיב מסחרי אחד לעמוד. כל שאר המסך שייך למודעות עצמן.",
  },
  {
    icon: ShieldCheck,
    title: "שקיפות ואמון",
    body: "ציון אמינות מוכר שמורכב מאותות גלויים בלבד, ואזהרה ברורה כשמשהו נראה חשוד.",
  },
  {
    icon: HeartHandshake,
    title: "פרטיות כברירת מחדל",
    body: "מיקום מקורב במקום כתובת, מחיקת EXIF אוטומטית, וטלפון שנחשף רק בלחיצה.",
  },
];

export default function AboutPage() {
  return (
    <ContentPage
      title={`על ${SITE.name}`}
      intro="בנינו את הלוח שהיינו רוצים להשתמש בו בעצמנו: מהיר, נקי, והוגן לשני הצדדים של העסקה."
    >
      <section>
        <h2>למה עוד לוח מודעות</h2>
        <p>
          לוחות המודעות הגדולים בישראל עובדים — אבל הם כבדים, עמוסים בפרסומות, והחיפוש
          בהם לא תמיד מבין מה חיפשתם. רצינו לבדוק מה קורה כשמתחילים מחדש ושמים את חוויית
          המשתמש במקום הראשון: חיפוש שמבין עברית ושסולח על שגיאות כתיב, פילטרים שמותאמים
          לכל קטגוריה בנפרד, וממשק שנטען מהר גם ברשת סלולרית איטית.
        </p>
      </section>

      <section>
        <h2>העקרונות שלנו</h2>
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
        <h2>איך אנחנו מתפרנסים</h2>
        <p>
          פרסום מודעה הוא ותמיד יישאר חינם. ההכנסות מגיעות מחבילות קידום אופציונליות
          למוכרים שרוצים חשיפה נוספת, ומפתרונות לעסקים. אנחנו לא מוכרים מידע אישי, ולא
          נכניס לאתר רשתות פרסום שעוקבות אחריכם.
        </p>
      </section>

      <section className="not-prose flex flex-wrap gap-2 rounded-lg bg-muted/50 p-5">
        <div className="flex-1">
          <h2 className="font-heading text-lg font-bold">מוכנים להתחיל?</h2>
          <p className="text-sm text-muted-foreground">
            פרסום מודעה לוקח פחות מדקה, והיא באוויר מיד.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/publish">פרסום מודעה</Link>
        </Button>
      </section>
    </ContentPage>
  );
}
