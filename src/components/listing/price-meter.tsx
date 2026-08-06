import type { PriceMeter as PriceMeterData } from "@/lib/price-meter";
import { cn } from "@/lib/utils";

/**
 * סטייה קטנה מהחציון היא רעש סטטיסטי ולא "מחיר טוב".
 * מתחת לסף הזה הסקאלה לא מוצגת בכלל — מחוג שזז באחוז אחד מלמד את
 * המשתמש להתעלם ממנו, וזה מחיר גבוה יותר מלא להציג אותו.
 */
const NOISE_FLOOR_PCT = 3;

/**
 * סקאלת המחיר — אלמנט החתימה של הלוח.
 *
 * לוחית גרפיט עם שנתות ומחוג ענבר שמסמן את האחוזון שבו יושב המחיר בתוך
 * המודעות הדומות. המחיר לבדו לא אומר אם העסקה טובה; הסקאלה עונה על זה
 * במבט אחד, באותה צורה בדיוק בכל מסך שבו היא מופיעה.
 *
 * **`meter === null` (פחות מ-8 מודעות להשוואה) → לא מוצג כלום.** לא מחוג
 * חיוור ולא הערכה זהירה. מכשיר שמראה קריאה שאין לו הוא מכשיר מקולקל,
 * וזה ההבדל בין הרכיב הזה לבין גרף קישוטי.
 */
export function PriceMeter({
  meter,
  className,
  /**
   * `column` — הרכיב יושב בעמודה משלו בשורת קריאה, ולכן הוא **חייב
   * להחזיר משהו תמיד**: עמודה שנעלמת מזיזה את המחיר של אותה שורה
   * ושוברת את יישור העמודה לאורך הרשימה. במכשיר זה חמור יותר מחוסר
   * הנתון עצמו — עמודת מספרים שלא מתיישרת היא בדיוק מה שהסקאלה
   * אמורה למנוע.
   *
   * במצב הזה היעדר קריאה נאמר במילים במקום להיעלם.
   */
  variant = "inline",
}: {
  meter: PriceMeterData | null;
  className?: string;
  variant?: "inline" | "column";
}) {
  const isColumn = variant === "column";

  const note = (text: string) =>
    isColumn ? <p className={cn("text-xs text-muted-foreground", className)}>{text}</p> : null;

  if (!meter) return note("אין מספיק מודעות דומות להשוואה");

  const below = meter.deltaPct < 0;
  const magnitude = Math.abs(meter.deltaPct);

  /*
   * סטייה זניחה היא קריאה תקפה — "בדיוק כמו השוק" — ולא היעדר נתון.
   * היא נאמרת במילים בלי מחוג, כי מחוג שזז באחוז אחד מלמד להתעלם ממנו.
   */
  if (magnitude < NOISE_FLOOR_PCT) return note("במחיר החציון");

  /*
   * המחוג ממוקם באחוזון, ו-`inset-inline-start` הוא מה שהופך אותו לנכון
   * ב-RTL: הקצה הזול נמצא בצד שממנו מתחילים לקרוא, כלומר מימין.
   * הצמדה ל-1%–99% מונעת מחוג שנחתך בדיוק בקצה הלוחית.
   */
  const position = Math.min(99, Math.max(1, meter.percentile * 100));

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="price-scale w-full"
        role="img"
        aria-label={`המחיר ${below ? "נמוך" : "גבוה"} ב-${magnitude} אחוז מחציון של ${meter.sample} מודעות דומות`}
      >
        <span className="price-scale-needle" style={{ insetInlineStart: `${position}%` }} />
      </div>

      {/*
       * פסק הדין בציאן כשהמחיר מתחת לחציון, ובצבע האזהרה כשהוא מעליו.
       * שניהם צבעי קריאה ולא צבעי פעולה — לאף אחד מהם אין כפתור מלא
       * בשום מסך, וזה מה שמשאיר את הענבר כצבע הפעולה היחיד.
       */}
      {/*
       * גודל המדגם צמוד למספר, תמיד.
       *
       * "38% מתחת לחציון" בלי לומר מול כמה מודעות הוא מספר שאי אפשר
       * לבדוק — וזה בדיוק מה שהסתיר כאן קוהורט שגוי במשך זמן. עכשיו
       * משתמש שרואה "מול 9 מודעות" יודע כמה משקל לתת לזה, ומפתח
       * שרואה מספר מוזר רואה מיד גם את הסיבה.
       */}
      <p className={cn("text-xs", below ? "text-info" : "text-accent")}>
        <span className="num">{magnitude}%</span> {below ? "מתחת לחציון" : "מעל החציון"}
        <span className="text-muted-foreground">
          {" · "}
          <span className="num">{meter.sample}</span> מודעות דומות
        </span>
      </p>
    </div>
  );
}
