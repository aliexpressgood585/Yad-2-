/**
 * שמות למעברי תצוגה בין דפים.
 *
 * `view-transition-name` חייב להיות ייחודי בדף — שני אלמנטים עם אותו
 * שם מבטלים את המעבר בשקט. לכן השם נגזר ממזהה המודעה, וחי בקובץ אחד
 * כדי ששני הצדדים (הכרטיס ודף המודעה) לא יוכלו להיפרד זה מזה.
 *
 * מזהי cuid מתחילים באות ולכן הם `custom-ident` תקין; ההסרה של תווים
 * שאינם אלפאנומריים היא הגנה מפני מזהים ממקור אחר.
 */
export function listingImageTransition(listingId: string): string {
  return `listing-img-${listingId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
