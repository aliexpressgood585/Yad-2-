/**
 * פרמטרים בנתיב מגיעים לעיתים מקודדים (percent-encoding), במיוחד
 * כשה-slug בעברית ומגיע מקישור חיצוני או מהדבקה בשורת הכתובת.
 * הפונקציה מחזירה תמיד את הצורה המפוענחת והמנורמלת, כך שההשוואה
 * מול העמודה בבסיס הנתונים תצליח בשני המקרים.
 */
export function decodeSlugParam(raw: string): string {
  let value = raw;

  // ייתכן קידוד כפול (למשל קישור ששותף דרך מערכת שמקודדת שוב)
  for (let i = 0; i < 2 && /%[0-9a-fA-F]{2}/.test(value); i++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      // קידוד לא תקין — משאירים את הערך כפי שהוא
      break;
    }
  }

  // עברית יכולה להגיע ב-NFC או ב-NFD; בסיס הנתונים שומר NFC
  return value.normalize("NFC");
}
