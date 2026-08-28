"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CORE_FIELDS } from "@/lib/feed";
import { formatCount } from "@/lib/format";

type Category = { id: string; name: string; path: string };
type Attribute = { key: string; label: string; isRequired: boolean };

type Preview = {
  headers: string[];
  mapping: Record<string, string>;
  total: number;
  accepted: number;
  sample: { line: number; externalId: string; title: string; price: number | null; city: string }[];
  errors: { line: number; field: string; message: string }[];
  errorCount: number;
};

/**
 * העלאה מרוכזת — שני שלבים.
 *
 * השלב הראשון אינו כותב דבר: הוא מחזיר את המיפוי שנוחש, את מספר
 * השורות שיתקבלו, ואת השורות שנפלו עם מספר השורה בקובץ ועם הסיבה.
 * הסוחר מתקן את המיפוי במסך, רואה את התוצאה משתנה, ורק אז מאשר.
 *
 * מסך שכותב מאתיים מודעות ואז מספר על שלוש שגיאות הוא מסך שאי אפשר
 * לתקן בו כלום — צריך למצוא את השלוש, למחוק את כולן, ולהתחיל מחדש.
 */
export function BulkImport({
  categories,
  attributesByCategory,
}: {
  categories: Category[];
  attributesByCategory: Record<string, Attribute[]>;
}) {
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [content, setContent] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [format, setFormat] = React.useState<"CSV" | "XML">("CSV");
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [publish, setPublish] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const attributes = attributesByCategory[categoryId] ?? [];

  const targets = [
    ...CORE_FIELDS.map((f) => ({ key: f.key as string, label: f.label, required: f.required })),
    ...attributes.map((a) => ({ key: a.key, label: a.label, required: a.isRequired })),
  ];

  async function readFile(file: File) {
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    setFormat(/\.xml$/i.test(file.name) ? "XML" : "CSV");
    setPreview(null);
    setMapping({});
  }

  async function post(body: unknown) {
    const res = await fetch("/api/business/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "הפעולה נכשלה");
    return data;
  }

  async function runPreview(nextMapping?: Record<string, string>) {
    if (!content) return;
    setBusy(true);
    try {
      const data = (await post({
        mode: "preview",
        categoryId,
        format,
        content,
        ...(nextMapping ? { mapping: nextMapping } : {}),
      })) as Preview;
      setPreview(data);
      setMapping(data.mapping);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "בדיקת הקובץ נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const data = await post({ mode: "commit", categoryId, format, content, mapping, publish });
      toast.success(
        `${formatCount(data.created)} מודעות נוצרו, ${formatCount(data.updated)} עודכנו.`,
      );
      setPreview(null);
      setContent("");
      setFileName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הייבוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="border border-border bg-card p-4">
        <h2 className="font-heading text-base">1. הקובץ</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="import-category">קטגוריה</Label>
            <select
              id="import-category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPreview(null);
                setMapping({});
              }}
              className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              כל המודעות בקובץ נכנסות לקטגוריה הזו.
            </p>
          </div>

          <div>
            <Label htmlFor="import-file">קובץ CSV או XML</Label>
            <input
              id="import-file"
              type="file"
              accept=".csv,.xml,text/csv,text/xml,application/xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
              className="mt-1 block w-full border border-input bg-background p-2 text-sm file:me-3 file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
            {fileName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {fileName} · <span className="num">{formatCount(content.length)}</span> תווים
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                השורה הראשונה חייבת להיות שורת כותרות.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => runPreview()} disabled={!content || busy} loading={busy}>
            בדיקת הקובץ
          </Button>
          <a
            href={`/api/business/import/template?categoryId=${categoryId}`}
            className="text-sm text-info underline-offset-4 hover:underline"
          >
            הורדת קובץ לדוגמה
          </a>
        </div>
      </section>

      {preview ? (
        <>
          <section className="border border-border bg-card p-4">
            <h2 className="font-heading text-base">2. המיפוי</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              לכל שדה בלוח, איזו עמודה בקובץ מזינה אותו. הניחוש נעשה משמות
              העמודות — תקנו מה שצריך והמסך יבדוק שוב.
            </p>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {targets.map((target) => (
                <li key={target.key}>
                  <Label htmlFor={`map-${target.key}`}>
                    {target.label}
                    {target.required ? <span className="text-accent"> *</span> : null}
                  </Label>
                  <select
                    id={`map-${target.key}`}
                    value={mapping[target.key] ?? ""}
                    onChange={(e) => {
                      const next = { ...mapping };
                      if (e.target.value) next[target.key] = e.target.value;
                      else delete next[target.key];
                      setMapping(next);
                      void runPreview(next);
                    }}
                    className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— לא ממופה —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-border bg-card p-4">
            <h2 className="font-heading text-base">3. מה ייובא</h2>

            <p className="mt-2 text-sm">
              <span className="num font-semibold text-primary">
                {formatCount(preview.accepted)}
              </span>{" "}
              שורות מתוך <span className="num">{formatCount(preview.total)}</span> עברו
              אימות.
              {preview.errorCount > 0 ? (
                <>
                  {" "}
                  <span className="num text-accent">{formatCount(preview.errorCount)}</span>{" "}
                  נדחו.
                </>
              ) : null}
            </p>

            {preview.sample.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 text-start font-medium">שורה</th>
                      <th scope="col" className="py-2 text-start font-medium">מזהה</th>
                      <th scope="col" className="py-2 text-start font-medium">כותרת</th>
                      <th scope="col" className="py-2 text-start font-medium">מחיר</th>
                      <th scope="col" className="py-2 text-start font-medium">עיר</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.sample.map((row) => (
                      <tr key={row.line}>
                        <td className="num py-2">{row.line}</td>
                        <td className="num py-2">{row.externalId}</td>
                        <td className="max-w-xs truncate py-2">{row.title}</td>
                        <td className="num py-2">{row.price ?? "—"}</td>
                        <td className="py-2">{row.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview.errors.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">שורות שנדחו</h3>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
                  {preview.errors.map((e, i) => (
                    <li key={`${e.line}-${e.field}-${i}`} className="text-muted-foreground">
                      שורה <span className="num text-foreground">{e.line}</span> · {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="size-4 border border-input"
                />
                לפרסם מיד
              </label>
              <p className="text-xs text-muted-foreground">
                בלי סימון המודעות נכנסות כטיוטות, ואפשר לעבור עליהן לפני שהן עולות.
              </p>

              <Button
                onClick={commit}
                disabled={preview.accepted === 0 || busy}
                loading={busy}
                className="ms-auto"
              >
                ייבוא {formatCount(preview.accepted)} מודעות
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
