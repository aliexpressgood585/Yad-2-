"use client";

import * as React from "react";
import Link from "next/link";
import { Home, RotateCw } from "lucide-react";

import { FaultPlate } from "@/components/fault-plate";
import { Button } from "@/components/ui/button";

/**
 * מסך תקלה.
 *
 * עד עכשיו קריסה בשרת הציגה את מסך השגיאה הגנרי של Next — רקע לבן,
 * אנגלית, ובפרודקשן גם בלי שום דבר שאפשר לעשות איתו. זה הדף היחיד
 * שכל משתמש רואה באותה מידה, ולכן הוא לא יכול להיות הדף היחיד
 * שלא עוצב.
 *
 * שלושה דברים שהוא חייב לעשות, לפי הסדר:
 * 1. לומר שזה אצלנו ולא אצלו — משתמש שמאשים את עצמו לא חוזר.
 * 2. לתת פעולה אחת ברורה.
 * 3. לדווח, בלי לבקש ממנו לעשות את זה.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    /*
     * דיווח ל-Sentry רק כשהוא מוגדר, ובייבוא דינמי כדי שדף השגיאה
     * לא ייגרור את ה-SDK לחבילה של כל דף אחר.
     */
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-12 text-center">
      <FaultPlate code="500" />

      <div>
        <h1 className="font-heading text-2xl font-extrabold">משהו נשבר אצלנו</h1>
        <p className="mx-auto mt-1 max-w-md text-pretty text-muted-foreground">
          לא עשית שום דבר לא בסדר. התקלה נרשמה אצלנו ואנחנו רואים אותה — לרוב ניסיון
          נוסף פותר.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCw aria-hidden />
          לנסות שוב
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home aria-hidden />
            לדף הבית
          </Link>
        </Button>
      </div>

      {/*
       * מזהה התקלה מוצג כי הוא מה שהופך פנייה לתמיכה לבירור של דקה
       * במקום לחקירה. הוא אינו חושף דבר — הוא גיבוב של האירוע בלבד.
       */}
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          מזהה התקלה: <span className="num">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
