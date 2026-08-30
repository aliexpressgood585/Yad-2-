import * as React from "react";

/**
 * משפט שיש בתוכו אלמנט — קישור, הדגשה, קוד.
 *
 * ## הבעיה שזה פותר
 *
 * `<p>קראו קודם את <Link>מדריך הבטיחות</Link>.</p>` מייצר שלושה צמתים.
 * חילוץ של כל צומת בנפרד נותן שלושה מפתחות שאי אפשר לתרגם: באנגלית
 * הקישור יושב במקום אחר במשפט, ובערבית במקום שלישי. מתרגם שמקבל
 * "קראו קודם את" בלי ההמשך אינו יכול לדעת מה נכון.
 *
 * הפתרון הוא מחרוזת אחת עם מציין מקום, שהמתרגם מזיז לאן שנכון בשפה
 * שלו:
 *
 * ```tsx
 * <Rich
 *   message={t("help.contact", {})}
 *   slots={{ guide: (text) => <Link href="/safety">{text}</Link> }}
 * />
 * ```
 *
 * והמחרוזת: `"כתבו לנו. מומלץ לקרוא קודם את <guide>מדריך הבטיחות</guide>."`
 *
 * ## למה תגיות ולא אינדקסים
 *
 * `{0}` ו-`{1}` מחייבים את המתרגם לזכור מה כל מספר. תגית בשם אומרת
 * מה היא, והטקסט שבתוכה הוא חלק מהתרגום — כלומר גם מילות הקישור
 * עצמן מתורגמות ולא רק מה שסביבן.
 */
const TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

export function Rich({
  message,
  slots,
}: {
  message: string;
  slots: Record<string, (text: string) => React.ReactNode>;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  // `lastIndex` מתאפס בכל קריאה כי הביטוי גלובלי ומשותף למודול
  TAG.lastIndex = 0;

  while ((match = TAG.exec(message)) !== null) {
    const [full, name, inner] = match;
    if (match.index > cursor) parts.push(message.slice(cursor, match.index));

    const render = slots[name!];
    // תגית שאין לה מימוש מוצגת כטקסט שלה ולא נעלמת מהמשפט
    parts.push(render ? render(inner!) : inner);
    cursor = match.index + full.length;
  }

  if (cursor < message.length) parts.push(message.slice(cursor));

  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </>
  );
}
