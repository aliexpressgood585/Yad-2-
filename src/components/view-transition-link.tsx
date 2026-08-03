"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * קישור שמנווט בתוך View Transition.
 *
 * למה בכתיבה ידנית ולא בדגל של Next: `experimental.viewTransition`
 * מפעיל את רכיב `<ViewTransition>` של React, שקיים רק בבילדים
 * הניסיוניים של React. בגרסה 19.0 היציבה שהאפליקציה רצה עליה אין
 * ברכיב הלקוח של Next אף קריאה ל-`startViewTransition` — הדגל פשוט לא
 * עושה כלום. אומת בפועל: 0 קריאות בניווט אמיתי.
 *
 * מה שיש כאן הוא ה-API הנייטיבי, בלי ספרייה ובלי polyfill:
 *
 *   1. דפדפן בלי `document.startViewTransition` → ניווט רגיל של
 *      `next/link`, בלי שום קוד נוסף.
 *   2. `prefers-reduced-motion: reduce` → אותו דבר בדיוק. אין תנועה
 *      במרחב למי שביקש שלא תהיה.
 *   3. לחיצה עם Ctrl/Cmd/Shift או בכפתור אמצעי → נשארת ההתנהגות של
 *      הדפדפן, כי המשתמש מבקש כרטיסייה חדשה ולא מעבר.
 *
 * ה-callback של המעבר חייב להחזיק את המסך הקפוא עד שה-DOM החדש מוכן.
 * ניווט ב-App Router הוא אסינכרוני, ולכן ההבטחה נפתרת כש-`isPending`
 * מתאפס — עם תקרת זמן, כדי שניווט איטי לא יקפיא את המסך.
 */

/** מעבר לא מחזיק את המסך יותר מזה, גם אם הניווט נתקע. */
const MAX_HOLD_MS = 600;

type Props = Omit<React.ComponentProps<typeof Link>, "href"> & { href: string };

export function ViewTransitionLink({ href, onClick, children, ...props }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const resolveRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!pending && resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [pending]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (typeof document.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, MAX_HOLD_MS);
          resolveRef.current = () => {
            window.clearTimeout(timer);
            resolve();
          };
          startTransition(() => router.push(href));
        }),
    );
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
