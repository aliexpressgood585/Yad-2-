import Image from "next/image";

import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt?: string;
  blurDataURL?: string | null;
  /** אייקון הקטגוריה, לשימוש כשאין תמונה */
  categoryIcon?: string;
  sizes: string;
  priority?: boolean;
  /**
   * שם המעבר בין דפים. אותו שם בכרטיס ובדף המודעה גורם לדפדפן להזיז
   * את התמונה בין שני המצבים במקום להחליף מסך. השם חייב להיות ייחודי
   * בדף, ולכן הוא נגזר ממזהה המודעה.
   */
  viewTransitionName?: string;
  className?: string;
};

/**
 * תמונת מודעה מנורמלת.
 *
 * זו הדרך היחידה להציג תמונה של מודעה. הסיבה היא שהתמונות מגיעות
 * ממשתמשים באיכות, ביחס ובבהירות אקראיים — ומה שגורם ללוח להיראות
 * מסודר הוא לא איכות התמונה אלא זה שכולן עוברות בדיוק אותו טיפול:
 *
 *   1. יחס 4:3 קבוע עם `object-cover`. אף פעם לא letterbox ואף פעם
 *      לא מלבן ריק — גובה קבוע הוא גם מה שמחזיק CLS על 0.
 *   2. blurhash כ-placeholder: הטעינה מתחילה מהצבע האמיתי של התמונה
 *      במקום ממלבן אפור.
 *   3. חסרה תמונה → קווי המתאר של הקטגוריה ב---stone, לא אייקון
 *      "תמונה שבורה".
 */
export function ListingImage({
  src,
  alt = "",
  blurDataURL,
  categoryIcon,
  sizes,
  priority = false,
  viewTransitionName,
  className,
}: Props) {
  return (
    <div
      className={cn("relative aspect-[4/3] overflow-hidden bg-muted", className)}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          placeholder={blurDataURL ? "blur" : "empty"}
          blurDataURL={blurDataURL ?? undefined}
          priority={priority}
        />
      ) : (
        <div className="grid size-full place-items-center text-border">
          <CategoryIcon name={categoryIcon ?? "Package"} className="size-10" aria-hidden />
          <span className="sr-only">אין תמונה למודעה זו</span>
        </div>
      )}
    </div>
  );
}
