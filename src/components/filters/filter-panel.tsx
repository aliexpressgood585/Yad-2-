"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityFilter } from "@/components/filters/city-filter";
import { DistanceFilter } from "@/components/filters/distance-filter";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { ResolvedAttribute } from "@/lib/categories";
import { countActiveFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

export type CityFacet = { city: string; count: number };

/** `attributeId` → ערך → מספר המודעות התואמות בתוצאות הנוכחיות. */
export type ValueFacets = Record<string, Record<string, number>>;

type Props = {
  attributes: ResolvedAttribute[];
  cityFacets: CityFacet[];
  priceRange: { min: number; max: number; median: number } | null;
  priceLabel?: string;
  valueFacets?: ValueFacets;
  className?: string;
};

/** ספירת תוצאות ליד תווית פילטר. חסרה ספירה — לא מוצג כלום. */
function FacetCount({ count }: { count?: number }) {
  if (count === undefined) return null;
  return (
    <span
      className={cn("num ms-1.5 text-xs", count === 0 ? "text-muted-foreground/50" : "text-muted-foreground")}
    >
      ({count})
    </span>
  );
}

export function FilterPanel({
  attributes,
  cityFacets,
  priceRange,
  priceLabel = "מחיר",
  valueFacets = {},
  className,
}: Props) {
  const { state, setParam, setAttrValues, setAttrRange, setAttrBool, clearAll, push } =
    useFilterParams();

  const activeCount = countActiveFilters(state);

  const filterable = attributes.filter((a) => a.isFilter);
  const booleans = filterable.filter((a) => a.type === "BOOLEAN");
  const others = filterable.filter((a) => a.type !== "BOOLEAN");

  // ערך "יצרן" נבחר משפיע על אפשרויות "דגם"
  const selectedByKey = state.attrs;

  const defaultOpen = React.useMemo(
    () => ["price", "location", ...others.slice(0, 3).map((a) => a.key)],
    [others],
  );

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="font-heading text-base font-bold">סינון</h2>
        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <RotateCcw aria-hidden />
            ניקוי ({activeCount})
          </Button>
        ) : null}
      </div>

      <Accordion type="multiple" defaultValue={defaultOpen}>
        {/* --- מחיר --- */}
        <AccordionItem value="price">
          <AccordionTrigger>{priceLabel}</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="price-min" className="text-xs text-muted-foreground">
                  מ־
                </Label>
                <Input
                  id="price-min"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={0}
                  placeholder={priceRange ? String(priceRange.min) : "0"}
                  defaultValue={state.priceMin ?? ""}
                  key={`min-${state.priceMin ?? ""}`}
                  onBlur={(e) => setParam("priceMin", e.target.value || null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="price-max" className="text-xs text-muted-foreground">
                  עד
                </Label>
                <Input
                  id="price-max"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={0}
                  placeholder={priceRange ? String(priceRange.max) : "∞"}
                  defaultValue={state.priceMax ?? ""}
                  key={`max-${state.priceMax ?? ""}`}
                  onBlur={(e) => setParam("priceMax", e.target.value || null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </div>
            </div>
            {priceRange ? (
              <p className="mt-2 text-xs text-muted-foreground">
                מחיר חציוני בקטגוריה:{" "}
                <span className="num font-medium text-foreground">
                  {formatPrice(priceRange.median)}
                </span>
              </p>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        {/* --- מיקום --- */}
        <AccordionItem value="location">
          <AccordionTrigger>
            מיקום
            {state.cities.length ? (
              <span className="ms-2 rounded-full bg-primary-soft px-2 text-xs text-primary num">
                {state.cities.length}
              </span>
            ) : null}
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <CityFilter facets={cityFacets} selected={state.cities} />
            <DistanceFilter state={state} push={push} />
          </AccordionContent>
        </AccordionItem>

        {/* --- שדות דינמיים לפי קטגוריה --- */}
        {others.map((attr) => (
          <AccordionItem key={attr.id} value={attr.key}>
            <AccordionTrigger>
              {attr.label}
              {selectedByKey[attr.key]?.length ? (
                <span className="ms-2 rounded-full bg-primary-soft px-2 text-xs text-primary num">
                  {selectedByKey[attr.key]!.length}
                </span>
              ) : null}
            </AccordionTrigger>
            <AccordionContent>
              <AttributeControl
                attr={attr}
                counts={valueFacets[attr.id]}
                selected={selectedByKey[attr.key] ?? []}
                range={state.attrRanges[attr.key] ?? {}}
                parentValues={attr.dependsOn ? (selectedByKey[attr.dependsOn] ?? []) : null}
                onValues={(v) => setAttrValues(attr.key, v)}
                onRange={(min, max) => setAttrRange(attr.key, min, max)}
              />
            </AccordionContent>
          </AccordionItem>
        ))}

        {/* --- מאפיינים בוליאניים --- */}
        {booleans.length ? (
          <AccordionItem value="features">
            <AccordionTrigger>מאפיינים</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2.5">
                {booleans.map((attr) => (
                  <li key={attr.id} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`bool-${attr.key}`} className="cursor-pointer font-normal">
                      {attr.label}
                      <FacetCount count={valueFacets[attr.id]?.true} />
                    </Label>
                    <Switch
                      id={`bool-${attr.key}`}
                      checked={Boolean(state.attrBools[attr.key])}
                      onCheckedChange={(v) => setAttrBool(attr.key, v)}
                    />
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* --- כללי --- */}
        <AccordionItem value="general">
          <AccordionTrigger>כללי</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2.5">
              <li className="flex items-center justify-between gap-3">
                <Label htmlFor="with-images" className="cursor-pointer font-normal">
                  רק מודעות עם תמונות
                </Label>
                <Switch
                  id="with-images"
                  checked={state.withImages}
                  onCheckedChange={(v) => setParam("withImages", v ? "1" : null)}
                />
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** בקרה מתאימה לסוג השדה: רשימת סימון, טווח מספרי או טקסט. */
function AttributeControl({
  attr,
  counts,
  selected,
  range,
  parentValues,
  onValues,
  onRange,
}: {
  attr: ResolvedAttribute;
  counts?: Record<string, number>;
  selected: string[];
  range: { min?: number; max?: number };
  parentValues: string[] | null;
  onValues: (values: string[]) => void;
  onRange: (min?: number, max?: number) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);

  if (attr.type === "NUMBER") {
    return (
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${attr.key}-min`} className="text-xs text-muted-foreground">
            מ־
          </Label>
          <Input
            id={`${attr.key}-min`}
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={attr.min ?? undefined}
            max={attr.max ?? undefined}
            step={attr.step ?? undefined}
            placeholder={attr.min !== null ? String(attr.min) : ""}
            defaultValue={range.min ?? ""}
            key={`n-min-${range.min ?? ""}`}
            onBlur={(e) =>
              onRange(e.target.value ? Number(e.target.value) : undefined, range.max)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${attr.key}-max`} className="text-xs text-muted-foreground">
            עד
          </Label>
          <Input
            id={`${attr.key}-max`}
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={attr.min ?? undefined}
            max={attr.max ?? undefined}
            step={attr.step ?? undefined}
            placeholder={attr.max !== null ? String(attr.max) : ""}
            defaultValue={range.max ?? ""}
            key={`n-max-${range.max ?? ""}`}
            onBlur={(e) =>
              onRange(range.min, e.target.value ? Number(e.target.value) : undefined)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
        {attr.unit ? (
          <span className="pb-2.5 text-xs text-muted-foreground">{attr.unit}</span>
        ) : null}
      </div>
    );
  }

  if (attr.type === "TEXT") {
    return (
      <Input
        placeholder={attr.placeholder ?? `סינון לפי ${attr.label}`}
        defaultValue={selected[0] ?? ""}
        key={`t-${selected[0] ?? ""}`}
        onBlur={(e) => onValues(e.target.value ? [e.target.value] : [])}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  }

  // SELECT / MULTISELECT — כשהשדה תלוי בשדה אחר, מציגים רק אפשרויות רלוונטיות
  const options = parentValues?.length
    ? attr.values.filter((v) => v.parentValue && parentValues.includes(v.parentValue))
    : attr.dependsOn
      ? []
      : attr.values;

  if (attr.dependsOn && !parentValues?.length) {
    return (
      <p className="text-xs text-muted-foreground">
        בחרו קודם ערך בשדה שמעל כדי לראות את האפשרויות.
      </p>
    );
  }

  /*
   * כשיש ספירות, אפשרות בלי תוצאות יורדת לסוף הרשימה במקום להיעלם:
   * היעלמות הייתה משנה את הרשימה מתחת לאצבע בזמן סינון, והמשתמש היה
   * מאבד את המקום. אפשרות מסומנת נשארת למעלה גם אם ספירתה 0.
   */
  const ordered = counts
    ? [...options].sort((a, b) => {
        const ca = selected.includes(a.value) ? Infinity : (counts[a.value] ?? 0);
        const cb = selected.includes(b.value) ? Infinity : (counts[b.value] ?? 0);
        return cb - ca;
      })
    : options;

  const visible = showAll ? ordered : ordered.slice(0, 8);

  return (
    <div className="space-y-2">
      <ul className="space-y-2 max-h-72 overflow-y-auto pe-1">
        {visible.map((opt) => {
          const id = `${attr.key}-${opt.id}`;
          const checked = selected.includes(opt.value);
          return (
            <li key={opt.id} className="flex items-center gap-2.5">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v) =>
                  onValues(
                    v === true
                      ? [...selected, opt.value]
                      : selected.filter((s) => s !== opt.value),
                  )
                }
              />
              <Label htmlFor={id} className="cursor-pointer font-normal">
                {opt.label}
                {/* יש ספירות לשדה → ערך בלי תוצאות מוצג כ-0 ולא כחסר מידע */}
                <FacetCount count={counts ? (counts[opt.value] ?? 0) : undefined} />
              </Label>
            </li>
          );
        })}
      </ul>
      {options.length > 8 ? (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "הצגת פחות" : `הצגת כל ${options.length} האפשרויות`}
        </Button>
      ) : null}
    </div>
  );
}
