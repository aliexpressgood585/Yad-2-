"use client";

import { useEffect, useRef, useState } from "react";

import { HeaderSearch } from "@/components/layout/header-search";
import { cn } from "@/lib/utils";

/**
 * שדה החיפוש בהדר, מוסתר כל עוד שדה החיפוש של הירו נראה.
 *
 * בדף הבית הופיעו שני שדות חיפוש זהים במסך אחד — אחד בהירו ואחד בהדר
 * הדביק שמעליו. במקום להסתיר אחד מהם לתמיד, ההדר מוותר על השדה שלו כל
 * עוד יש שדה גדול יותר על המסך, ומחזיר אותו ברגע שהירו נגלל החוצה.
 *
 * הזיהוי נעשה דרך `#hero-search-anchor`, שקיים רק בדף הבית: בכל דף אחר
 * ה-observer לא מוצא אותו והשדה מוצג מיד.
 */
export function HeaderSearchSlot({
  className,
  inputId,
}: {
  className?: string;
  inputId?: string;
}) {
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = document.getElementById("hero-search-anchor");
    if (!anchor) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry?.isIntersecting),
      // מרווח עליון בגובה ההדר, כדי שההחלפה תקרה בדיוק כשהשדה נכנס תחתיו
      { rootMargin: "-56px 0px 0px 0px" },
    );
    io.observe(anchor);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-opacity duration-ui ease-ui",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      aria-hidden={!visible}
      /*
       * `inert` יחד עם `aria-hidden`, ולא רק `aria-hidden`.
       *
       * `aria-hidden` מסתיר מקורא מסך אבל **אינו** מוציא את תיבת
       * החיפוש מסדר המקלדת. משתמש שגולל בטאב הגיע לשדה שאינו נראה,
       * המיקוד נעלם מהמסך, והוא הקליד לתוך כלום. `pointer-events-none`
       * מונע עכבר בלבד. Lighthouse מדווח על זה כ-`aria-hidden-focus`,
       * וזו אחת התקלות שקורא מסך חווה כאתר שבור.
       */
      inert={!visible}
    >
      <HeaderSearch inputId={inputId} />
    </div>
  );
}
