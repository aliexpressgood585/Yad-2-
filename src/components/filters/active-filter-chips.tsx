"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { ResolvedAttribute } from "@/lib/categories";
import { ATTR_PREFIX, countActiveFilters } from "@/lib/filters";
import { formatPrice } from "@/lib/format";

type Chip = { label: string; onRemove: () => void };

/** שורת תגיות של הפילטרים הפעילים, עם אפשרות להסרה מהירה. */
export function ActiveFilterChips({ attributes }: { attributes: ResolvedAttribute[] }) {
  const { state, setParam, toggleInList, setAttrRange, clearAll, push } = useFilterParams();

  if (countActiveFilters(state) === 0) return null;

  const byKey = new Map(attributes.map((a) => [a.key, a]));
  const chips: Chip[] = [];

  for (const city of state.cities) {
    chips.push({ label: city, onRemove: () => toggleInList("city", city) });
  }

  if (state.priceMin !== undefined || state.priceMax !== undefined) {
    const from = state.priceMin !== undefined ? formatPrice(state.priceMin) : "";
    const to = state.priceMax !== undefined ? formatPrice(state.priceMax) : "";
    chips.push({
      label: from && to ? `${from} – ${to}` : from ? `מ־${from}` : `עד ${to}`,
      onRemove: () =>
        push((sp) => {
          sp.delete("priceMin");
          sp.delete("priceMax");
        }),
    });
  }

  if (state.radiusKm !== undefined) {
    chips.push({
      label: `עד ${state.radiusKm} ק"מ ממני`,
      onRemove: () =>
        push((sp) => {
          sp.delete("radius");
          sp.delete("lat");
          sp.delete("lng");
        }),
    });
  }

  if (state.withImages) {
    chips.push({ label: "עם תמונות", onRemove: () => setParam("withImages", null) });
  }

  for (const [key, values] of Object.entries(state.attrs)) {
    const attr = byKey.get(key);
    for (const value of values) {
      const option = attr?.values.find((v) => v.value === value);
      chips.push({
        label: `${attr?.label ?? key}: ${option?.label ?? value}`,
        onRemove: () => toggleInList(`${ATTR_PREFIX}${key}`, value),
      });
    }
  }

  for (const [key, range] of Object.entries(state.attrRanges)) {
    if (range.min === undefined && range.max === undefined) continue;
    const attr = byKey.get(key);
    const unit = attr?.unit ? ` ${attr.unit}` : "";
    const text =
      range.min !== undefined && range.max !== undefined
        ? `${range.min}–${range.max}${unit}`
        : range.min !== undefined
          ? `מ־${range.min}${unit}`
          : `עד ${range.max}${unit}`;
    chips.push({
      label: `${attr?.label ?? key}: ${text}`,
      onRemove: () => setAttrRange(key, undefined, undefined),
    });
  }

  for (const [key, value] of Object.entries(state.attrBools)) {
    if (!value) continue;
    chips.push({
      label: byKey.get(key)?.label ?? key,
      onRemove: () => setParam(`${ATTR_PREFIX}${key}`, null),
    });
  }

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, i) => (
        <li key={`${chip.label}-${i}`}>
          <button
            type="button"
            onClick={chip.onRemove}
            className="flex items-center gap-1 rounded-full border border-border bg-muted/60 py-1 pe-1.5 ps-2.5 text-xs font-medium transition-colors hover:border-destructive hover:text-destructive"
          >
            <span className="num">{chip.label}</span>
            <X className="size-3" aria-hidden />
            <span className="sr-only">הסרת הפילטר</span>
          </button>
        </li>
      ))}
      <li>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={clearAll}>
          ניקוי הכול
        </Button>
      </li>
    </ul>
  );
}
