"use client";

import { useState } from "react";

import { SAMPLE_CSV, type ImportRow, type RowError } from "@/lib/dealer-import";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Preview = {
  preview: true;
  willCreate: number;
  rejected: number;
  rows: ImportRow[];
  errors: RowError[];
};

type Committed = { preview: false; created: number; failed: number; errors: RowError[] };

/**
 * ייבוא מרוכז — הדבקה, תצוגה מקדימה, ואז יצירה.
 *
 * **שני שלבים ולא אחד.** ייבוא הוא פעולה שקשה לבטל: 80 מודעות שגויות
 * באוויר הן נזק אמיתי למוניטין של הסוחר, וכפתור אחד שיוצר אותן מיד
 * הוא הזמנה לתאונה. הכפתור הראשון רק בודק.
 *
 * השגיאות מוצגות **לצד** מה שייווצר ולא במקומו. קובץ עם שלוש שורות
 * בעייתיות מתוך שמונים הוא קובץ שאפשר לייבא, והסוחר צריך לראות את
 * שתי העובדות יחד כדי להחליט.
 */
export function ImportPanel() {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Committed | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, commit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "הייבוא נכשל");
        return;
      }
      if (commit) {
        setResult(data as Committed);
        setPreview(null);
      } else {
        setPreview(data as Preview);
        setResult(null);
      }
    } catch {
      setError("לא ניתן היה לפנות לשרת. בדקו את החיבור ונסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setCsv(await file.text());
    setPreview(null);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer border border-border bg-secondary px-3 py-1.5 text-sm font-medium">
            בחירת קובץ CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setCsv(SAMPLE_CSV);
              setPreview(null);
              setResult(null);
            }}
            className="text-sm text-info underline underline-offset-4"
          >
            טעינת קובץ דוגמה
          </button>
        </div>

        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
            setResult(null);
          }}
          rows={10}
          dir="ltr"
          spellCheck={false}
          placeholder="כותרת,תיאור,מחיר,עיר,קטגוריה…"
          aria-label="תוכן קובץ ה-CSV"
          className="w-full border border-input bg-background p-3 font-mono text-xs leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!csv.trim() || busy}
          onClick={() => void send(false)}
          className="border border-border bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy && !preview ? "בודק…" : "בדיקה ותצוגה מקדימה"}
        </button>

        {/*
         * כפתור היצירה מופיע רק אחרי בדיקה, ורק כשיש מה ליצור.
         * כפתור יצירה שזמין לפני שראו את התוצאה הוא הדרך הבטוחה
         * להעלות מלאי שגוי לאוויר.
         */}
        {preview && preview.willCreate > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(true)}
            className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "מייבא…" : `יצירת ${preview.willCreate} מודעות`}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="border-s-2 border-destructive bg-destructive/10 p-3 text-sm">{error}</p>
      ) : null}

      {result ? (
        <div className="border border-border bg-card p-4">
          <p className="font-medium">
            נוצרו <span className="num">{result.created}</span> מודעות.
            {result.failed > 0 ? (
              <>
                {" "}
                <span className="num">{result.failed}</span> נכשלו.
              </>
            ) : null}
          </p>
          <ErrorList errors={result.errors} />
        </div>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-6 border border-border bg-card p-4">
            <Stat label="ייווצרו" value={preview.willCreate} />
            <Stat label="נדחו" value={preview.rejected} tone={preview.rejected ? "warn" : undefined} />
          </div>

          <ErrorList errors={preview.errors} />

          {preview.rows.length ? (
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[40rem] bg-card text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-2.5 text-start font-bold">שורה</th>
                    <th className="p-2.5 text-start font-bold">כותרת</th>
                    <th className="p-2.5 text-start font-bold">מחיר</th>
                    <th className="p-2.5 text-start font-bold">עיר</th>
                    <th className="p-2.5 text-start font-bold">מאפיינים</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.line} className="border-b border-border last:border-b-0">
                      <td className="num p-2.5 text-muted-foreground">{row.line}</td>
                      <td className="p-2.5">{row.title}</td>
                      <td className="num p-2.5">{formatPrice(row.price, { currency: "ILS" })}</td>
                      <td className="p-2.5">{row.city}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">
                        {Object.entries(row.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "num font-heading text-2xl font-bold leading-none",
          tone === "warn" && "text-accent",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * השגיאות מקובצות לפי שורה.
 *
 * לשורה אחת יכולות להיות שלוש בעיות, ורשימה שטוחה של 40 שגיאות מ-14
 * שורות נקראת כאילו הקובץ אבוד. הסוחר מתקן שורות, לא שגיאות.
 */
function ErrorList({ errors }: { errors: RowError[] }) {
  if (!errors.length) return null;

  const byLine = new Map<number, RowError[]>();
  for (const err of errors) {
    const list = byLine.get(err.line);
    if (list) list.push(err);
    else byLine.set(err.line, [err]);
  }

  return (
    <ul className="flex flex-col gap-2 border border-border bg-card p-4 text-sm">
      {[...byLine.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([line, list]) => (
          <li key={line} className="flex flex-wrap items-baseline gap-2">
            <span className="num shrink-0 font-medium text-accent">שורה {line}</span>
            <span className="text-muted-foreground">
              {list.map((e) => (e.column ? `${e.column} — ${e.message}` : e.message)).join(" · ")}
            </span>
          </li>
        ))}
    </ul>
  );
}
