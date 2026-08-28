"use client";

import { Rows2, Rows4 } from "lucide-react";

import { useDensity, type Density } from "@/stores/density";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Density; label: string; Icon: typeof Rows2 }[] = [
  { value: "full", label: "שורה עם לוחית תמונה", Icon: Rows2 },
  { value: "compact", label: "שורה צרה", Icon: Rows4 },
];

/**
 * מחליף בין שני מצבי הצפיפות. הבחירה נשמרת ב-localStorage.
 *
 * מוצג בכל מסך תוצאות: זו העדפת עבודה קבועה של המשתמש ולא מצב של
 * מסך בודד, ולכן היא לא יושבת ב-URL.
 *
 * כשנמסר `categorySlug`, הבחירה נספרת גם לקטגוריה: שלוש בחירות רצופות
 * באותה תצוגה הופכות אותה לברירת המחדל שם. הכותרת מספרת שזה קרה —
 * ממשק שלומד בלי לומר זאת מרגיש כמו תקלה ולא כמו עזרה.
 */
export function DensityToggle({
  className,
  categorySlug,
}: {
  className?: string;
  categorySlug?: string;
}) {
  const { density, setDensity, isLearned } = useDensity(categorySlug);

  return (
    <div
      className={cn("flex items-center border border-border p-0.5", className)}
      role="group"
      aria-label={
        isLearned ? "צפיפות התצוגה — נלמדה מהבחירות שלך בקטגוריה הזו" : "צפיפות התצוגה"
      }
      title={isLearned ? "ברירת המחדל בקטגוריה הזו נקבעה מהבחירות שלך" : undefined}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setDensity(value)}
          aria-pressed={density === value}
          title={label}
          className={cn(
            "grid size-7 place-items-center transition-colors duration-ui ease-ui",
            density === value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
