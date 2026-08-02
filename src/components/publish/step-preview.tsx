"use client";

import Image from "next/image";
import { Eye, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublishFormState } from "@/components/publish/publish-wizard";
import type { CategoryNode, ResolvedAttribute } from "@/lib/categories";
import { formatPrice } from "@/lib/utils";

/** שלב 4: תצוגה מקדימה — כך המודעה תיראה לגולשים. */
export function StepPreview({
  form,
  attributes,
  tree,
}: {
  form: PublishFormState;
  attributes: ResolvedAttribute[];
  tree: CategoryNode[];
}) {
  const category = tree
    .flatMap((r) => [r, ...r.children])
    .find((c) => c.id === form.categoryId);

  const specs = attributes
    .map((attr) => {
      const raw = form.attributes[attr.key];
      if (raw === undefined || raw === "" || raw === false) return null;

      let value: string;
      if (Array.isArray(raw)) {
        value = raw
          .map((v) => attr.values.find((o) => o.value === v)?.label ?? v)
          .join(", ");
      } else if (typeof raw === "boolean") {
        value = "יש";
      } else if (attr.type === "SELECT") {
        value = attr.values.find((o) => o.value === String(raw))?.label ?? String(raw);
      } else {
        value = `${raw}${attr.unit ? ` ${attr.unit}` : ""}`;
      }

      return value ? { label: attr.label, value } : null;
    })
    .filter((s): s is { label: string; value: string } => s !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="font-heading text-lg font-bold">כך המודעה תיראה</h2>
      </div>

      <article className="overflow-hidden rounded-lg border border-border bg-card">
        {form.images.length ? (
          <div className="relative aspect-[16/10] bg-muted">
            <Image
              src={form.images[0]!.url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 700px"
              className="object-contain"
              unoptimized
            />
            {form.images.length > 1 ? (
              <span className="absolute bottom-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white num">
                1 / {form.images.length}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-muted text-sm text-muted-foreground">
            לא נוספו תמונות
          </div>
        )}

        <div className="space-y-3 p-4">
          <div>
            <h3 className="font-heading text-xl font-extrabold">
              {form.title || "כותרת המודעה"}
            </h3>
            <p className="mt-1 font-heading text-2xl font-extrabold text-primary num">
              {formatPrice(form.price)}
              {form.isNegotiable ? (
                <span className="ms-2 align-middle text-sm font-medium text-muted-foreground">
                  (מחיר גמיש)
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden />
              {form.city || "לא נבחר יישוב"}
              {form.neighborhood ? `, ${form.neighborhood}` : ""}
            </span>
            {category ? <Badge variant="muted">{category.name}</Badge> : null}
          </div>

          {specs.length ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-xs text-muted-foreground">{spec.label}</dt>
                  <dd className="num text-sm font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="whitespace-pre-line text-sm leading-relaxed">
            {form.description || "תיאור המודעה יופיע כאן."}
          </p>

          <p className="text-xs text-muted-foreground">
            יצירת קשר: {form.contactName || "—"}
            {form.contactPhone ? " · הטלפון ייחשף רק בלחיצה" : ""}
            {form.allowChat ? " · פניות בהודעות מופעלות" : ""}
          </p>
        </div>
      </article>

      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        לאחר הפרסום המודעה תהיה פעילה 45 יום, ואפשר יהיה לחדש אותה בלחיצה אחת מהאזור האישי.
        אפשר לערוך או להסיר אותה בכל רגע.
      </p>
    </div>
  );
}
