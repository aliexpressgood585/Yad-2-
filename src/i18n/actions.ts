"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./config";

/**
 * שמירת בחירת השפה.
 *
 * ## למה `revalidatePath` ולא רענון בלקוח
 *
 * רוב הטקסט באתר מרונדר בשרת, וחלק גדול ממנו יושב במטמון ISR. החלפת
 * עוגייה בלקוח לבדה הייתה מחליפה את השפה ברכיבי הלקוח בלבד ומשאירה את
 * השרת בשפה הקודמת — כלומר בדיוק מסך חצי-מתורגם.
 *
 * העוגייה אינה `httpOnly`: היא אינה סוד, והלקוח צריך לקרוא אותה כדי
 * לסמן את השפה הפעילה בלי סבב נוסף לשרת.
 */
export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
}
