import { ShieldAlert } from "lucide-react";

import { dealHeadline, dealTipsFor } from "@/lib/safe-deal";
import { cn } from "@/lib/utils";

/**
 * רשימת הבדיקות שנפתחת יחד עם מספר הטלפון.
 *
 * **הניסוח הוא של רשימה לקונה, לא של חשד במוכר.** רוב המוכרים ישרים,
 * ואזהרה שנשמעת כמו האשמה הופכת את הלוח לעוין — וגם נקראת פחות, כי
 * הקונה שכבר החליט לפנות מתייחס אליה כאל רעש.
 *
 * מודעה שסומנה מקבלת טון חד יותר אבל **אותה רשימה בדיוק**: הבדיקות
 * הנכונות נכונות גם בעסקה תקינה, והתאמת התוכן לחשד הייתה מלמדת שאין
 * צורך לבדוק כשאין דגל.
 */
export function SafeDealTips({
  rootSlug,
  flagged = false,
  className,
}: {
  rootSlug?: string | null;
  flagged?: boolean;
  className?: string;
}) {
  const tips = dealTipsFor(rootSlug);

  return (
    <section
      aria-labelledby="safe-deal-heading"
      className={cn(
        "flex flex-col gap-3 border p-3.5",
        flagged ? "border-accent/60 bg-accent/5" : "border-border bg-secondary/40",
        className,
      )}
    >
      <h3
        id="safe-deal-heading"
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          flagged && "text-accent",
        )}
      >
        <ShieldAlert className="size-4 shrink-0" aria-hidden />
        {dealHeadline(flagged)}
      </h3>

      <ul className="flex flex-col gap-2.5">
        {tips.map((tip) => (
          <li key={tip.title} className="flex flex-col gap-0.5">
            <span className="text-sm font-medium leading-snug">{tip.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{tip.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
