"use client";

import * as React from "react";
import { AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";

import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ResolvedAttribute } from "@/lib/categories";
import { CITY_NAMES, neighborhoodsOf } from "@/lib/cities";
import { formatPrice } from "@/lib/format";
import type { PublishFormState } from "@/components/publish/publish-wizard";

type Props = {
  form: PublishFormState;
  attributes: ResolvedAttribute[];
  loadingAttributes: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<PublishFormState>) => void;
};

type Assist = {
  priceSuggestion: { p25: number; median: number; p75: number; sample: number } | null;
  duplicates: { id: string; slug: string; title: string; status: string }[];
};

/** שלב 2: פרטי המודעה — שדות קבועים + השדות הדינמיים של הקטגוריה. */
export function StepDetails({
  form,
  attributes,
  loadingAttributes,
  errors,
  onChange,
}: Props) {
  const [assist, setAssist] = React.useState<Assist | null>(null);
  const neighborhoods = neighborhoodsOf(form.city);

  // הצעת מחיר וזיהוי כפילויות — נטענים בהשהיה אחרי הקלדה
  React.useEffect(() => {
    if (!form.categoryId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/listings/assist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            categoryId: form.categoryId,
            title: form.title,
            description: form.description,
            price: form.price,
            excludeId: form.id,
          }),
        });
        if (res.ok) setAssist((await res.json()) as Assist);
      } catch {
        // ביטול בקשה בעקבות הקלדה נוספת — לא שגיאה
      }
    }, 700);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.categoryId, form.title, form.description, form.price, form.id]);

  function setAttr(key: string, value: string | number | boolean | string[]) {
    onChange({ attributes: { ...form.attributes, [key]: value } });
  }

  const visibleAttributes = attributes.filter((a) => {
    if (!a.dependsOn) return true;
    // שדה תלוי מוצג רק אחרי שנבחר ערך בשדה שממנו הוא נגזר
    return Boolean(form.attributes[a.dependsOn]);
  });

  return (
    <div className="space-y-6">
      {assist?.duplicates.length ? (
        <aside className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-bold">כבר פרסמת משהו דומה</p>
            <ul className="mt-1 space-y-0.5">
              {assist.duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/item/${d.slug}`} className="underline" target="_blank">
                    {d.title}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({d.status === "DRAFT" ? "טיוטה" : "פעילה"})
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              פרסום כפול עלול להוביל להסרת המודעות. אפשר לערוך את הקיימת במקום.
            </p>
          </div>
        </aside>
      ) : null}

      {/* --- שדות בסיס --- */}
      <section className="space-y-4">
        <Field
          id="title"
          label="כותרת המודעה"
          required
          error={errors.title}
          hint="כותרת קצרה וברורה מביאה יותר פניות. לדוגמה: ״טויוטה קורולה 2019 יד ראשונה״"
        >
          <Input
            id="title"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={80}
            placeholder="מה אתם מפרסמים?"
          />
          <p className="text-end text-xs text-muted-foreground num">
            {form.title.length}/80
          </p>
        </Field>

        <Field
          id="description"
          label="תיאור"
          required
          error={errors.description}
          hint="פרטו מצב, גיל, סיבת המכירה ומה כלול. תיאור מלא חוסך שאלות."
        >
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={6}
            maxLength={5000}
            placeholder="ספרו על הפריט…"
          />
          <p className="text-end text-xs text-muted-foreground num">
            {form.description.length}/5000
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="price" label="מחיר" error={errors.price} hint="אפשר להשאיר ריק ולציין ״לפי הצעה״">
            <div className="relative">
              <span className="pointer-events-none absolute start-3 top-2.5 text-sm text-muted-foreground">
                ₪
              </span>
              <Input
                id="price"
                type="number"
                inputMode="numeric"
                dir="ltr"
                min={0}
                className="ps-7"
                value={form.price ?? ""}
                onChange={(e) =>
                  onChange({ price: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
          </Field>

          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={form.isNegotiable}
                onCheckedChange={(v) => onChange({ isNegotiable: v === true })}
              />
              <span className="text-sm">המחיר גמיש / נתון למשא ומתן</span>
            </label>
          </div>
        </div>

        {assist?.priceSuggestion ? (
          <p className="flex items-start gap-2 rounded-lg bg-primary-soft/60 p-3 text-sm text-primary">
            <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              מודעות דומות בקטגוריה נמכרות בין{" "}
              <span className="num font-bold">
                {formatPrice(assist.priceSuggestion.p25)}
              </span>{" "}
              ל־
              <span className="num font-bold">
                {formatPrice(assist.priceSuggestion.p75)}
              </span>
              , חציון{" "}
              <span className="num font-bold">
                {formatPrice(assist.priceSuggestion.median)}
              </span>
              .{" "}
              <span className="text-xs opacity-80">
                (מבוסס על {assist.priceSuggestion.sample} מודעות בחצי השנה האחרונה)
              </span>
            </span>
          </p>
        ) : null}
      </section>

      {/* --- שדות דינמיים --- */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">
          פרטים לפי הקטגוריה
          {loadingAttributes ? (
            <Loader2 className="ms-2 inline size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </h2>

        {visibleAttributes.length === 0 && !loadingAttributes ? (
          <p className="text-sm text-muted-foreground">
            אין שדות נוספים בקטגוריה הזו.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleAttributes
            .filter((a) => a.type !== "BOOLEAN")
            .map((attr) => (
              <AttributeField
                key={attr.id}
                attr={attr}
                value={form.attributes[attr.key]}
                parentValue={
                  attr.dependsOn ? String(form.attributes[attr.dependsOn] ?? "") : null
                }
                error={errors[`attr:${attr.key}`]}
                onChange={(v) => setAttr(attr.key, v)}
              />
            ))}
        </div>

        {visibleAttributes.some((a) => a.type === "BOOLEAN") ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">מאפיינים</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleAttributes
                .filter((a) => a.type === "BOOLEAN")
                .map((attr) => (
                  <label
                    key={attr.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border p-2.5"
                  >
                    <Checkbox
                      checked={form.attributes[attr.key] === true}
                      onCheckedChange={(v) => setAttr(attr.key, v === true)}
                    />
                    <span className="text-sm">{attr.label}</span>
                  </label>
                ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      {/* --- מיקום --- */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">מיקום</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" label="עיר / יישוב" required error={errors.city}>
            <Select value={form.city} onValueChange={(city) => onChange({ city, neighborhood: "" })}>
              <SelectTrigger id="city">
                <SelectValue placeholder="בחירת יישוב" />
              </SelectTrigger>
              <SelectContent>
                {CITY_NAMES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {neighborhoods.length ? (
            <Field id="neighborhood" label="שכונה">
              <Select
                value={form.neighborhood || "none"}
                onValueChange={(v) => onChange({ neighborhood: v === "none" ? "" : v })}
              >
                <SelectTrigger id="neighborhood">
                  <SelectValue placeholder="בחירת שכונה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {neighborhoods.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          המיקום המדויק לעולם לא מוצג בפומבי — במפה מופיע אזור מקורב בלבד.
        </p>
      </section>

      {/* --- יצירת קשר --- */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">פרטי יצירת קשר</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactName" label="שם ליצירת קשר">
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => onChange({ contactName: e.target.value })}
              maxLength={40}
            />
          </Field>
          <Field id="contactPhone" label="טלפון" hint="המספר נחשף רק בלחיצה של המתעניין">
            <Input
              id="contactPhone"
              type="tel"
              dir="ltr"
              value={form.contactPhone}
              onChange={(e) => onChange({ contactPhone: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <span className="text-sm">
            אפשרו פנייה בהודעות דרך האתר
            <span className="block text-xs text-muted-foreground">
              רוב הקונים מעדיפים לפתוח בהודעה לפני שיחת טלפון.
            </span>
          </span>
          <Switch
            checked={form.allowChat}
            onCheckedChange={(v) => onChange({ allowChat: v })}
            aria-label="אפשרו פנייה בהודעות"
          />
        </label>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AttributeField({
  attr,
  value,
  parentValue,
  error,
  onChange,
}: {
  attr: ResolvedAttribute;
  value: string | number | boolean | string[] | undefined;
  parentValue: string | null;
  error?: string;
  onChange: (value: string | number | string[]) => void;
}) {
  const id = `attr-${attr.key}`;

  if (attr.type === "NUMBER") {
    return (
      <Field id={id} label={attr.label} required={attr.isRequired} error={error} hint={attr.helpText ?? undefined}>
        <div className="relative">
          <Input
            id={id}
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={attr.min ?? undefined}
            max={attr.max ?? undefined}
            step={attr.step ?? undefined}
            placeholder={attr.placeholder ?? undefined}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={attr.unit ? "pe-14" : undefined}
          />
          {attr.unit ? (
            <span className="pointer-events-none absolute end-3 top-2.5 text-xs text-muted-foreground">
              {attr.unit}
            </span>
          ) : null}
        </div>
      </Field>
    );
  }

  if (attr.type === "TEXT") {
    return (
      <Field id={id} label={attr.label} required={attr.isRequired} error={error} hint={attr.helpText ?? undefined}>
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={attr.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          maxLength={200}
        />
      </Field>
    );
  }

  const options = attr.dependsOn
    ? attr.values.filter((v) => v.parentValue === parentValue)
    : attr.values;

  if (attr.type === "MULTISELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <Label required={attr.isRequired}>{attr.label}</Label>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((s) => s !== opt.value)
                      : [...selected, opt.value],
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary-soft font-medium text-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Field id={id} label={attr.label} required={attr.isRequired} error={error} hint={attr.helpText ?? undefined}>
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        disabled={options.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={options.length ? `בחירת ${attr.label}` : "אין אפשרויות"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
