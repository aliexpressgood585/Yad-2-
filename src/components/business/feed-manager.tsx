"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/checkbox";
import { CORE_FIELDS } from "@/lib/feed";
import { formatCount } from "@/lib/format";
import { timeAgo } from "@/lib/utils";

type Category = { id: string; path: string };
type Attribute = { key: string; label: string; isRequired: boolean };

export type FeedRow = {
  id: string;
  name: string;
  url: string;
  format: "CSV" | "XML";
  categoryPath: string;
  isActive: boolean;
  removeMissing: boolean;
  lastRunAt: string | null;
  lastStatus: "OK" | "PARTIAL" | "FAILED" | null;
  lastMessage: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  OK: "הצליח",
  PARTIAL: "הצליח חלקית",
  FAILED: "נכשל",
};

/**
 * ניהול פידים.
 *
 * פיד הוא בדיוק אותו מנגנון כמו העלאה מרוכזת, רק שהמקור הוא כתובת
 * שנמשכת שוב ושוב. לכן המיפוי כאן זהה — ולכן גם כפתור "הרצה עכשיו":
 * סוחר שהגדיר מיפוי צריך לדעת מיד אם הוא נכון, ולא לחכות לריצת הלילה
 * כדי לגלות שעמודת המחיר לא מופתה.
 */
export function FeedManager({
  feeds,
  categories,
  attributesByCategory,
}: {
  feeds: FeedRow[];
  categories: Category[];
  attributesByCategory: Record<string, Attribute[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(feeds.length === 0);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [format, setFormat] = React.useState<"CSV" | "XML">("CSV");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [removeMissing, setRemoveMissing] = React.useState(false);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});

  const attributes = attributesByCategory[categoryId] ?? [];
  const targets = [
    ...CORE_FIELDS.map((f) => ({ key: f.key as string, label: f.label, required: f.required })),
    ...attributes.map((a) => ({ key: a.key, label: a.label, required: a.isRequired })),
  ];

  async function send(method: string, body: unknown, label: string) {
    setBusy(label);
    try {
      const res = await fetch("/api/business/feeds", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "הפעולה נכשלה");
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    try {
      const missing = targets.filter((t) => t.required && !mapping[t.key]);
      if (missing.length) {
        toast.error(`חסר מיפוי לשדות חובה: ${missing.map((m) => m.label).join(", ")}`);
        return;
      }
      await send("POST", { name, url, format, categoryId, mapping, removeMissing }, "create");
      toast.success("הפיד נוצר. אפשר להריץ אותו עכשיו כדי לבדוק את המיפוי.");
      setName("");
      setUrl("");
      setMapping({});
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "יצירת הפיד נכשלה");
    }
  }

  async function runNow(id: string) {
    try {
      const data = await send("PATCH", { id, run: true }, id);
      const outcome = data.run;
      if (outcome?.status === "FAILED") toast.error(outcome.message);
      else toast.success(outcome?.message ?? "הפיד רץ");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההרצה נכשלה");
    }
  }

  async function toggle(id: string, isActive: boolean) {
    try {
      await send("PATCH", { id, isActive }, id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  async function remove(id: string) {
    try {
      await send("DELETE", { id }, id);
      toast.success("הפיד הוסר. המודעות שהוא יצר נשארו בלוח.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "המחיקה נכשלה");
    }
  }

  return (
    <div className="space-y-5">
      {feeds.length > 0 ? (
        <ul className="flex flex-col gap-px bg-border">
          {feeds.map((feed) => (
            <li key={feed.id} className="bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{feed.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
                    {feed.url}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {feed.categoryPath} · {feed.format}
                    {feed.removeMissing ? " · מסמן כנמכר מה שנעלם" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={feed.isActive}
                    onCheckedChange={(v) => void toggle(feed.id, v)}
                    aria-label={`הפעלת הפיד ${feed.name}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void runNow(feed.id)}
                    loading={busy === feed.id}
                  >
                    הרצה עכשיו
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(feed.id)}>
                    הסרה
                  </Button>
                </div>
              </div>

              {feed.lastRunAt ? (
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  הרצה אחרונה {timeAgo(feed.lastRunAt)} ·{" "}
                  <span
                    className={
                      feed.lastStatus === "FAILED"
                        ? "text-accent"
                        : feed.lastStatus === "OK"
                          ? "text-info"
                          : ""
                    }
                  >
                    {STATUS_LABELS[feed.lastStatus ?? ""] ?? ""}
                  </span>
                  {feed.lastMessage ? ` · ${feed.lastMessage}` : ""}
                </p>
              ) : (
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  הפיד עדיין לא רץ. הרצה יומית, או ידנית מכאן.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <section className="border border-border bg-card p-4">
          <h2 className="font-heading text-base">פיד חדש</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="feed-name">שם</Label>
              <Input
                id="feed-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="מלאי הסוכנות"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="feed-url">כתובת</Label>
              <Input
                id="feed-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                dir="ltr"
                placeholder="https://example.com/inventory.csv"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="feed-format">פורמט</Label>
              <select
                id="feed-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as "CSV" | "XML")}
                className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm"
              >
                <option value="CSV">CSV</option>
                <option value="XML">XML</option>
              </select>
            </div>
            <div>
              <Label htmlFor="feed-category">קטגוריה</Label>
              <select
                id="feed-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
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
            </div>
          </div>

          <h3 className="mt-5 text-sm font-semibold">מיפוי עמודות</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            שם העמודה בקובץ שמזינה כל שדה. בדיוק כמו בהעלאה מרוכזת, אבל נשמר
            לריצות הבאות.
          </p>

          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {targets.map((target) => (
              <li key={target.key}>
                <Label htmlFor={`feed-map-${target.key}`}>
                  {target.label}
                  {target.required ? <span className="text-accent"> *</span> : null}
                </Label>
                <Input
                  id={`feed-map-${target.key}`}
                  value={mapping[target.key] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value) next[target.key] = e.target.value;
                    else delete next[target.key];
                    setMapping(next);
                  }}
                  dir="ltr"
                  placeholder={target.key}
                  className="mt-1"
                />
              </li>
            ))}
          </ul>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeMissing}
              onChange={(e) => setRemoveMissing(e.target.checked)}
              className="mt-0.5 size-4 border border-input"
            />
            <span>
              לסמן כנמכר מה שנעלם מהפיד
              <span className="mt-0.5 block text-xs text-muted-foreground">
                כבוי כברירת מחדל. פיד שנקטע באמצע ההורדה נראה בדיוק כמו פיד שבו
                נמכר כל המלאי, ולכן ההסרה מדלגת גם כשהפיד מכיל פחות מחצי מהמלאי
                הפעיל.
              </span>
            </span>
          </label>

          <div className="mt-5 flex gap-3">
            <Button onClick={create} loading={busy === "create"} disabled={!name || !url}>
              יצירת הפיד
            </Button>
            {feeds.length > 0 ? (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                ביטול
              </Button>
            ) : null}
          </div>
        </section>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          הוספת פיד
        </Button>
      )}

      {feeds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          <span className="num">{formatCount(feeds.filter((f) => f.isActive).length)}</span>{" "}
          פידים פעילים. הרצה אוטומטית פעם ביום.
        </p>
      ) : null}
    </div>
  );
}
