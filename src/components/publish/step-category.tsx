"use client";

import * as React from "react";
import { ChevronLeft, Search } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import type { CategoryNode } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** שלב 1: בחירת קטגוריה — עמודת קטגוריות ראשיות ולצידה תת-קטגוריות. */
export function StepCategory({
  tree,
  value,
  error,
  onChange,
}: {
  tree: CategoryNode[];
  value: string;
  error?: string;
  onChange: (categoryId: string) => void;
}) {
  const [rootId, setRootId] = React.useState<string>(() => {
    const owner = tree.find(
      (r) => r.id === value || r.children.some((c) => c.id === value),
    );
    return owner?.id ?? tree[0]?.id ?? "";
  });
  const [query, setQuery] = React.useState("");

  const root = tree.find((r) => r.id === rootId) ?? tree[0];

  const matches = React.useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return tree.flatMap((r) =>
      [r, ...r.children]
        .filter((c) => c.name.includes(q))
        .map((c) => ({ ...c, rootName: r.name })),
    );
  }, [query, tree]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">מה מפרסמים?</h2>
        <p className="text-sm text-muted-foreground">
          בחירת הקטגוריה קובעת אילו שדות תתבקשו למלא ואיפה המודעה תופיע.
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש קטגוריה…"
          className="ps-9"
          aria-label="חיפוש קטגוריה"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {matches ? (
        <ul className="space-y-1.5">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange(c.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border p-3 text-start transition-colors hover:border-primary hover:bg-muted"
              >
                <CategoryIcon name={c.icon} className="size-5 text-primary" />
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.rootName}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">
              לא נמצאה קטגוריה מתאימה
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <ul className="space-y-1" role="tablist" aria-label="קטגוריות ראשיות">
            {tree.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={r.id === rootId}
                  onClick={() => setRootId(r.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-colors",
                    r.id === rootId
                      ? "bg-primary-soft text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <CategoryIcon name={r.icon} className="size-5" />
                  <span className="flex-1">{r.name}</span>
                  <ChevronLeft className="size-4 opacity-50" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <ul className="grid gap-2 sm:grid-cols-2">
            {(root?.children.length ? root.children : root ? [root] : []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border p-3 text-start text-sm transition-colors",
                    c.id === value
                      ? "border-primary bg-primary-soft font-semibold text-primary"
                      : "border-border hover:border-primary hover:bg-muted",
                  )}
                >
                  <CategoryIcon name={c.icon} className="size-4 shrink-0" />
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
