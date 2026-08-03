"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ParsedChip } from "@/lib/search/parse-query";
import { cn } from "@/lib/utils";

/**
 * מה שהמערכת הבינה מהחיפוש החופשי.
 *
 * החילוץ האוטומטי הוא ניחוש, ולכן הוא חייב להיות גלוי והפיך. הצ'יפים
 * מראים בדיוק מה נלקח מהטקסט, והסרה בלחיצה מחזירה את המילים המקוריות
 * לשורת החיפוש במקום לאבד אותן — `source` נושא אותן לשם כך.
 *
 * בלי זה חילוץ שגוי הופך לתעלומה: המשתמש רואה תוצאות לא צפויות ואין לו
 * דרך להבין למה או לתקן.
 */
export function ParsedChips({
  chips,
  className,
}: {
  chips: ParsedChip[];
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (!chips.length) return null;

  const remove = (chip: ParsedChip) => {
    // מחזירים את המילים שנצרכו לשורת החיפוש, ומסמנים לא לחלץ אותן שוב
    const next = new URLSearchParams(params.toString());
    const q = next.get("q") ?? "";
    next.set("q", q);
    next.set("keep", [...(params.getAll("keep") ?? []), chip.key].join(","));
    router.push(`?${next.toString()}`);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">הבנו מהחיפוש:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => remove(chip)}
          className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-xs text-primary transition-colors duration-ui ease-ui hover:border-primary"
        >
          <span className="num">{chip.label}</span>
          <X className="size-3 opacity-60 group-hover:opacity-100" aria-hidden />
          <span className="sr-only">הסרת הסינון {chip.label}</span>
        </button>
      ))}
    </div>
  );
}
