"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";
import { AVAILABLE_LOCALES, LOCALE_LABEL, LOCALE_DIR, type Locale } from "@/i18n/config";

/**
 * בורר שפת הממשק.
 *
 * ## כל שפה כתובה בשפה של עצמה
 *
 * "English" ולא "אנגלית", "العربية" ולא "ערבית". מי שמחפש את השפה שלו
 * ברשימה אינו קורא בהכרח את השפה שהאתר מוצג בה כרגע, וזו כל מטרת
 * הרשימה.
 *
 * ## הכיוון מוגדר לכל פריט
 *
 * שם באנגלית בתוך תפריט RTL בלי `dir` מפורש נשבר בסימני פיסוק, ושם
 * ערבי בתוך תפריט LTR נשבר באותו אופן. `dir` על הפריט עצמו מבודד כל
 * שם מהכיוון שסביבו.
 *
 * ## מדוע `startTransition` ולא `await` ישיר
 *
 * הפעולה כותבת עוגייה ומבטלת את מטמון ה-layout בשרת, ומיד אחריה נדרש
 * רענון כדי שרכיבי השרת ירונדרו בשפה החדשה. בלי `transition` הממשק היה
 * קופא בין השתיים בלי שום סימן שמשהו קורה.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function choose(locale: Locale) {
    if (locale === active) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("chrome.chooseLanguage")}
          disabled={pending}
        >
          <Languages aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {AVAILABLE_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            dir={LOCALE_DIR[locale]}
            onClick={() => choose(locale)}
          >
            <Check
              aria-hidden
              className={locale === active ? "opacity-100" : "opacity-0"}
            />
            {LOCALE_LABEL[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
