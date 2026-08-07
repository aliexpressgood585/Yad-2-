import { markGeometry, MARK_VIEWBOX } from "@/lib/brand-mark";
import { cn } from "@/lib/utils";

/**
 * לוחית תקלה — מה שהמכשיר מראה כשאין לו קריאה.
 *
 * דף שגיאה הוא הדף היחיד שנראה לכולם באותה מידה, וברוב האתרים הוא
 * הדף היחיד שלא עוצב. כאן הוא ממשיך את אותו אובייקט: אותה לוחית
 * גרפיט, אותה סקאלה — אבל **המחוג נפל אל מעבר לקצה**, כמו מחוג של
 * מכשיר שאיבד אות.
 *
 * זה אומר למשתמש משהו נכון בלי מילים: לא "שגיאה 500" אלא "המכשיר
 * הזה לא מודד עכשיו".
 */
export function FaultPlate({
  code,
  className,
}: {
  /** המספר שמופיע לצד הלוחית — 404, 500 */
  code: string;
  className?: string;
}) {
  const mark = markGeometry("full");

  return (
    /*
     * לוחית **אחת** ולא שתיים. ניסיון קודם הפריד את המספר מהסקאלה
     * לשני מלבנים עם רווח, וזה נקרא כשני מכשירים ולא כאחד. יחס
     * הרוחב-גובה נשמר רחב, כמו פני מכשיר ולא כמו כרזה.
     */
    <div
      className={cn(
        "flex h-28 w-full max-w-md items-center gap-5 bg-[hsl(var(--scale-plate))] px-6 sm:h-32",
        className,
      )}
    >
      <span
        aria-hidden
        className="num shrink-0 font-heading text-4xl font-extrabold tabular-nums leading-none text-[hsl(var(--scale-hair))] sm:text-5xl"
      >
        {code}
      </span>

      {/*
       * `vector-effect="non-scaling-stroke"` — בלעדיו העובי נמתח יחד
       * עם ה-SVG, ובגודל של דף שלם קו של יחידה אחת הופך לרצועה של
       * 24 פיקסלים. הסימן מפסיק להיות סקאלה והופך לתרשים עמודות,
       * וזו בדיוק התקלה שהעיצוב הזה נועד להימנע ממנה.
       */}
      <svg
        viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
        /*
         * `slice` ולא `meet`: היחס הטבעי של הסימן הוא 28×20, וברוחב
         * של לוחית שלמה הוא מייצר ריבוע. חיתוך אנכי עם עיגון לתחתית
         * חותך את השוליים הריקים מעל ומתחת לשנתות ומשאיר פס רחב —
         * שזה בדיוק היחס של פני מכשיר.
         */
        preserveAspectRatio="xMidYMax slice"
        className="h-full min-w-0 flex-1"
        role="presentation"
        aria-hidden
      >
        {mark.ticks.map((tick) => (
          <line
            key={tick.x}
            x1={tick.x}
            x2={tick.x}
            y1={tick.y1}
            y2={tick.y2}
            stroke="hsl(var(--scale-hair))"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="butt"
          />
        ))}

        {/*
         * המחוג נופל אל מעבר לקצה היקר — המקום שבו קריאה אמיתית כמעט
         * לעולם אינה נמצאת. הוא גם מוטה: מחוג ישר במקום שגוי נראה כמו
         * החלטה, מחוג נטוי נראה כמו כשל.
         */}
        <g transform="rotate(-16 1.5 17)" opacity="0.55">
          <line
            x1="1.5"
            x2="1.5"
            y1="4"
            y2="17"
            stroke="hsl(var(--needle))"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="butt"
          />
        </g>
      </svg>
    </div>
  );
}
