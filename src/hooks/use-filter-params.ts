"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ATTR_PREFIX, parseFilters, type FilterState } from "@/lib/filters";

/**
 * מנהל את מצב הפילטרים כמקור אמת יחיד ב-URL.
 * כל שינוי דוחף URL חדש (ללא reload) כך שהתוצאות מתרעננות בשרת
 * והקישור ניתן לשיתוף.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state: FilterState = React.useMemo(() => {
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      raw[key] = value;
    });
    return parseFilters(raw);
  }, [searchParams]);

  const push = React.useCallback(
    (mutate: (sp: URLSearchParams) => void, options?: { replace?: boolean }) => {
      const sp = new URLSearchParams(searchParams.toString());
      mutate(sp);
      // כל שינוי בפילטר מחזיר לעמוד הראשון
      sp.delete("page");
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      push((sp) => {
        if (value === null || value === "") sp.delete(key);
        else sp.set(key, value);
      });
    },
    [push],
  );

  /** מוסיף/מסיר ערך מרשימה מופרדת בפסיקים. */
  const toggleInList = React.useCallback(
    (key: string, value: string) => {
      push((sp) => {
        const current = (sp.get(key) ?? "").split(",").filter(Boolean);
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        if (next.length) sp.set(key, next.join(","));
        else sp.delete(key);
      });
    },
    [push],
  );

  const setAttrValues = React.useCallback(
    (attrKey: string, values: string[]) => {
      setParam(`${ATTR_PREFIX}${attrKey}`, values.length ? values.join(",") : null);
    },
    [setParam],
  );

  const setAttrRange = React.useCallback(
    (attrKey: string, min?: number, max?: number) => {
      push((sp) => {
        const minKey = `${ATTR_PREFIX}${attrKey}_min`;
        const maxKey = `${ATTR_PREFIX}${attrKey}_max`;
        if (min === undefined || Number.isNaN(min)) sp.delete(minKey);
        else sp.set(minKey, String(min));
        if (max === undefined || Number.isNaN(max)) sp.delete(maxKey);
        else sp.set(maxKey, String(max));
      });
    },
    [push],
  );

  const setAttrBool = React.useCallback(
    (attrKey: string, value: boolean) => {
      setParam(`${ATTR_PREFIX}${attrKey}`, value ? "1" : null);
    },
    [setParam],
  );

  /** מנקה את כל הפילטרים ומשאיר את מילות החיפוש והמיון. */
  const clearAll = React.useCallback(() => {
    const sp = new URLSearchParams();
    const q = searchParams.get("q");
    const sort = searchParams.get("sort");
    if (q) sp.set("q", q);
    if (sort) sp.set("sort", sort);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return {
    state,
    searchParams,
    pathname,
    push,
    setParam,
    toggleInList,
    setAttrValues,
    setAttrRange,
    setAttrBool,
    clearAll,
  };
}
