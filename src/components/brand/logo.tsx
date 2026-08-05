import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * הלוגו הוא הסקאלה.
 *
 * **סימן המותג ורכיב החתימה של המוצר הם אותו אובייקט**: שורת שנתות עם
 * מחוג ענבר אחד — בדיוק מה שמופיע על כל מודעה כדי להראות איפה המחיר
 * יושב מול השוק.
 *
 * זה גם מה שהופך את השם לניתן להגנה: מתחרה שיאמץ אותו יצטרך לאמץ גם
 * את המנגנון שמאחוריו.
 *
 * ה-SVG נכתב ידנית ולא כקובץ: הוא שמונה קווים, והוא צריך לרשת את צבעי
 * הטוקנים — קובץ חיצוני היה מקבע את הצבע ונשבר במעבר בין החוגות.
 */
export function Logo({
  className,
  showWordmark = true,
  href = "/",
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string | null;
}) {
  const content = (
    <span className={cn("group inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center bg-[hsl(var(--scale-plate))]",
          "transition-transform duration-150 group-hover:-translate-y-0.5",
        )}
      >
        <svg viewBox="0 0 28 20" className="w-6" role="presentation">
          {/* שנתות: ארוכה־קצרה־קצרה לסירוגין, כמו על סרגל */}
          {[2, 6, 10, 14, 18, 22, 26].map((x, i) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={i % 3 === 0 ? 8 : 12}
              y2={17}
              stroke="hsl(var(--scale-hair))"
              strokeWidth="1.5"
            />
          ))}
          {/* המחוג — יחיד, ובצבע היחיד שמותר לו */}
          <line
            x1="14"
            x2="14"
            y1="3"
            y2="17"
            stroke="hsl(var(--needle))"
            strokeWidth="2"
          />
          <path d="M14 1.5 L16.2 4 L11.8 4 Z" fill="hsl(var(--needle))" />
        </svg>
      </span>

      {showWordmark ? (
        <span className="font-heading text-xl font-extrabold">שנתות</span>
      ) : null}
      <span className="sr-only">שנתות — דף הבית</span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
