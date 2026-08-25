import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { markGeometry, MARK_VIEWBOX } from "@/lib/brand-mark";
import { cn } from "@/lib/utils";

/**
 * הלוגו הוא הקריאה של המכשיר.
 *
 * **סימן המותג ורכיב החתימה של המוצר הם אותו אובייקט**: שורת קווי סקאלה עם
 * מחוג ענבר אחד — בדיוק מה שמופיע על כל מודעה כדי להראות איפה המחיר
 * יושב מול השוק.
 *
 * ההבדל בין סימן טוב לסימן נכון הוא היכן עומד המחוג. מחוג במרכז מצייר
 * *מכשיר*; מחוג עמוק בקצה הזול מצייר **פסק דין**. שבירה אחת בלבד במקצב
 * האפור, והיא בצבע הפעולה היחיד של המערכת — זה כל הסימן.
 *
 * הגאומטריה מיובאת מ-`@/lib/brand-mark` ולא כתובה כאן, מפני שאותה צורה
 * בדיוק צריכה לצאת גם כקובצי PNG לפאביקון ול-PWA. הצבעים לעומת זאת
 * נשארים כאן כטוקנים חיים: הלוחית משתנה בין החוגה הבהירה לכהה, וקובץ
 * SVG חיצוני עם צבע קפוא היה נשבר במעבר.
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
  /*
   * צפיפות מצומצמת ולא מלאה: הסימן כאן הוא 24 פיקסלים, ובגודל הזה
   * רווח של 3 יחידות בין קו לקו הוא פחות משלושה פיקסלים ומתמזג לכתם.
   * קווי המשנה יורדות, הרווח האפור מוכפל, והמחוג נשאר במקומו —
   * הוא נבדל בצבע ולא ברווח.
   */
  const mark = markGeometry("compact");

  const content = (
    <span className={cn("group inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center bg-[hsl(var(--scale-plate))]",
          /*
           * קו-שיער בכהה בלבד.
           *
           * הלוחית גרפיט בשתי הערכות במכוון — היא אובייקט אחד ולא
           * רכיב שמשנה זהות לפי הרקע. אבל בכותרת הכהה הרקע קרוב
           * מדי לגרפיט, והלוחית נעלמת: נשארים שנתות ומחוג מרחפים
           * בלי הצורה שמחזיקה אותם.
           *
           * הקצה מצויר בצבע השנתות עצמן ולא בצבע גבול כללי — כלומר
           * הוא חלק מהמכשיר, לא מסגרת שהודבקה עליו. הצבע לא זז.
           */
          "dark:ring-1 dark:ring-[hsl(var(--scale-hair))]",
          "transition-transform duration-150 group-hover:-translate-y-0.5",
        )}
      >
        <svg
          viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
          className="w-6"
          role="presentation"
        >
          {/* השוק: מקצב סדיר לגמרי, ראשית־משנה לסירוגין */}
          {mark.ticks.map((tick) => (
            <line
              key={tick.x}
              x1={tick.x}
              x2={tick.x}
              y1={tick.y1}
              y2={tick.y2}
              stroke="hsl(var(--scale-hair))"
              strokeWidth="1.1"
              strokeLinecap="butt"
            />
          ))}

          {/* פסק הדין: המחוג היחיד, בענבר, בשמינית התחתונה של הסקאלה */}
          <line
            x1={mark.needle.x}
            x2={mark.needle.x}
            y1={mark.needle.y1}
            y2={mark.needle.y2}
            stroke="hsl(var(--needle))"
            strokeWidth="1.6"
            strokeLinecap="butt"
          />
          <rect
            x={mark.head.x - mark.head.size / 2}
            y={mark.head.y - mark.head.size / 2}
            width={mark.head.size}
            height={mark.head.size}
            fill="hsl(var(--needle))"
            transform={`rotate(45 ${mark.head.x} ${mark.head.y})`}
          />
        </svg>
      </span>

      {/*
       * הטקסט הנסתר משלים את מה שחסר ולא חוזר על מה שכבר נאמר.
       * כששם המותג מוצג, קורא מסך הקריא אותו פעמיים ("כדאיכדאי — דף
       * הבית"): הסימן החזותי כבר נושא את השם, ולנסתר נשאר רק היעד.
       */}
      {showWordmark ? (
        <>
          <span className="font-heading text-xl font-extrabold">{BRAND.name}</span>
          <span className="sr-only">דף הבית</span>
        </>
      ) : (
        <span className="sr-only">{BRAND.name} — דף הבית</span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
