import { Fragment } from "react";

/**
 * טקסט עברי שמכיל מקטעים לטיניים או מספריים.
 *
 * הבעיה: `text-overflow: ellipsis` על שורה RTL חותכת לפי סדר הבתים ולא
 * לפי סדר התצוגה, ולכן "MG 4 2026" נחתך באמצע ספרה ומופיע כ-"MG 4 202€".
 * `<bdi dir="ltr">` הופך כל מקטע כזה ליחידה אחת מבחינת האלגוריתם
 * הדו-כיווני, כך שהחיתוך מתרחש בגבול היחידה ולא בתוכה.
 *
 * הפיצול נעשה בשרת ולא ב-CSS כי זו בעיית סדר תווים, לא בעיית פריסה.
 */

// רצף של לטינית, ספרות וסימנים שנצמדים אליהם (מקף, נקודה, סלאש, גרש)
const LTR_RUN = /([A-Za-z0-9][A-Za-z0-9'"./\\-]*)/g;

export function BidiText({ children }: { children: string }) {
  const parts = children.split(LTR_RUN);

  return (
    <>
      {parts.map((part, i) =>
        // המקטעים הלטיניים הם האינדקסים האי-זוגיים אחרי split עם קבוצה
        i % 2 === 1 ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
