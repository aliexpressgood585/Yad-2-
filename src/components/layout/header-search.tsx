"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** השהיה בין הקלדה לעדכון התוצאות. */
const DEBOUNCE_MS = 300;

/**
 * תיבת החיפוש הראשית בכותרת. שולחת ל-/search עם פרמטר q.
 * עטופה ב-Suspense (ראה `HeaderSearch`) כי היא קוראת ל-useSearchParams.
 *
 * **חיפוש חי כשיש תוצאות על המסך.** דף שמציג רשימת מודעות מסמן את
 * עצמו ב-`data-live-search`, והתיבה מעדכנת אותו תוך כדי הקלדה במקום
 * לחכות ל-Enter. בכל דף אחר — בדף הבית, במודעה, בטופס פרסום — הקלדה
 * לא מנווטת לשום מקום, כי משתמש שהתחיל להקליד לא ביקש לעזוב את הדף.
 *
 * העדכון הוא `replace` ולא `push`: אחרת כל תו היה מוסיף רשומה
 * להיסטוריה, וכפתור "אחורה" היה חוזר אות-אות.
 */
function HeaderSearchInner({ className, inputId }: { className?: string; inputId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = React.useState(params.get("q") ?? "");
  const { t } = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const typingRef = React.useRef(false);

  // שמירה על סנכרון כשמנווטים בין דפי תוצאות. בזמן הקלדה לא נוגעים
  // בערך — עדכון ה-URL שהתיבה עצמה יזמה היה קופץ חזרה אל הטקסט הישן.
  React.useEffect(() => {
    if (typingRef.current) return;
    setValue(params.get("q") ?? "");
  }, [params]);

  /** האם על המסך יש רשימת תוצאות שאפשר לעדכן במקום. */
  const liveTarget = React.useCallback(
    () => typeof document !== "undefined" && document.querySelector("[data-live-search]") !== null,
    [],
  );

  React.useEffect(() => {
    if (!typingRef.current) return;

    const current = params.get("q") ?? "";
    const next = value.trim();
    if (next === current) return;
    if (!liveTarget()) return;

    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (next) sp.set("q", next);
      else sp.delete("q");
      // שינוי בחיפוש מחזיר לעמוד הראשון
      sp.delete("page");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, params, pathname, router, liveTarget]);

  // אחרי ניווט מלא אפשר שוב לקבל ערך מה-URL
  React.useEffect(() => {
    typingRef.current = false;
  }, [pathname]);

  // קיצור מקלדת: "/" ממקד את שדה החיפוש
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn("relative flex items-center", className)}
    >
      <label htmlFor={inputId} className="sr-only">
        {t("search.listings")}
      </label>
      <Search
        className="pointer-events-none absolute start-3 size-4 text-muted-foreground"
        aria-hidden
      />
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          typingRef.current = true;
          setValue(e.target.value);
        }}
        placeholder={t("search.placeholder")}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-muted/50 ps-9 pe-24 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            typingRef.current = true;
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute end-[4.75rem] rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">{t("search.clear")}</span>
        </button>
      ) : null}
{/* חוק הברזל: כפתור מלא אחד למסך. הענבר שמור ל"פרסום מודעה"
          שבהדר, ולכן שליחת החיפוש היא כפתור מתאר. */}
      <Button type="submit" variant="outline" size="sm" className="absolute end-1 h-8">
        {t("search.submit")}
      </Button>
    </form>
  );
}

/** שלד סטטי — מוצג עד שה-Suspense נפתר. */
function HeaderSearchFallback({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center", className)} aria-hidden>
      <Search className="pointer-events-none absolute start-3 size-4 text-muted-foreground" />
      <div className="h-10 w-full rounded-lg border border-input bg-muted/50" />
    </div>
  );
}

/**
 * `inputId` נמסר מבחוץ כי ההדר מרנדר שני עותקים של השדה — אחד לדסקטופ
 * ואחד לנייד — ושניהם קיימים ב-DOM בכל רגע. מזהה קבוע היה מופיע פעמיים
 * באותו מסמך, וקורא מסך היה קושר את התווית לשדה הלא נכון.
 */
export function HeaderSearch({
  className,
  inputId = "site-search",
}: {
  className?: string;
  inputId?: string;
}) {
  return (
    <React.Suspense fallback={<HeaderSearchFallback className={className} />}>
      <HeaderSearchInner className={className} inputId={inputId} />
    </React.Suspense>
  );
}
