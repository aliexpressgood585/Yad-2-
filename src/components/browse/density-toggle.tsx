"use client";

import { LayoutGrid, Rows3 } from "lucide-react";

import { useDensity, type Density } from "@/stores/density";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Density; label: string; Icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "תצוגת גריד", Icon: LayoutGrid },
  { value: "list", label: "תצוגת רשימה", Icon: Rows3 },
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
      className={cn("flex items-center rounded-md border border-border p-0.5", className)}
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
            "grid size-7 place-items-center rounded-sm transition-colors duration-ui ease-ui",
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
