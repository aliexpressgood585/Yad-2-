"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/**
 * המפה נטענת רק כשמגיעים אליה.
 *
 * MapLibre הוא 767KB של JavaScript, והוא נטען עד עכשיו בכל דף מודעה
 * מיד עם הטעינה — יחד עם כעשרים בקשות אריחים חיצוניות ועם יצירת
 * הקשר WebGL. זה היה הגורם הכבד ביותר ב-LCP ובזמן החסימה של הדף,
 * עבור רכיב שיושב מתחת לקיפול ושרוב הצופים לעולם לא גוללים אליו.
 *
 * המפה עדיין נטענת לבד — בלי לחיצה — ברגע שהיא מתקרבת למסך. מבחינת
 * המשתמש שום דבר לא השתנה חוץ מזה שהדף מוכן מוקדם יותר.
 *
 * `rootMargin` נדיב בכוונה: הטעינה מתחילה 400 פיקסלים לפני שהמפה
 * נראית, כדי שהיא תהיה שם כשמגיעים ולא תיטען מול העיניים.
 */
const ListingMap = dynamic(
  () => import("@/components/map/listing-map").then((m) => m.ListingMap),
  {
    ssr: false,
    loading: () => <Placeholder />,
  },
);

/**
 * שומר המקום תופס בדיוק את הממדים של המפה (`h-64 sm:h-72`), כדי
 * שההחלפה לא תזיז שום דבר בדף. CLS של רכיב שנטען מאוחר הוא בדיוק
 * המחיר שדחיית טעינה משלמת אם לא שומרים לה מקום.
 */
function Placeholder() {
  return <div className="h-64 w-full rounded-lg border border-border bg-muted sm:h-72" />;
}

type Props = React.ComponentProps<typeof ListingMap>;

export function ListingMapLazy(props: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    // בדפדפן בלי IntersectionObserver המפה נטענת מיד — הרכיב חייב
    // לעבוד, וההשהיה היא אופטימיזציה ולא תנאי.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={props.className}>
      {visible ? <ListingMap {...props} /> : <Placeholder />}
    </div>
  );
}
