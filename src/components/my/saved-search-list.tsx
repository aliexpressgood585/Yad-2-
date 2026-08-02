"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyResults } from "@/components/listing/listing-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { timeAgo } from "@/lib/utils";

export type SavedSearchItem = {
  id: string;
  name: string;
  filters: Record<string, string>;
  frequency: string;
  createdAt: string;
  lastNotified: string | null;
};

const FREQUENCY_LABELS: Record<string, string> = {
  INSTANT: "התראה מיידית",
  DAILY: "סיכום יומי",
  WEEKLY: "סיכום שבועי",
  OFF: "ללא התראות",
};

/** בונה את כתובת התוצאות מהפילטרים שנשמרו. */
function toHref(filters: Record<string, string>): string {
  const { path = "/search", ...rest } = filters;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "string" && v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** תיאור קריא של הפילטרים שנשמרו. */
function describe(filters: Record<string, string>): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.city) parts.push(filters.city.split(",").join(", "));
  if (filters.priceMin || filters.priceMax) {
    parts.push(
      `${filters.priceMin ? `מ-₪${filters.priceMin}` : ""}${
        filters.priceMax ? ` עד ₪${filters.priceMax}` : ""
      }`.trim(),
    );
  }
  const attrCount = Object.keys(filters).filter((k) => k.startsWith("a_")).length;
  if (attrCount) parts.push(`${attrCount} מאפיינים`);
  return parts.length ? parts.join(" · ") : "כל התוצאות";
}

export function SavedSearchList({ searches }: { searches: SavedSearchItem[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function updateFrequency(id: string, frequency: string) {
    setPending(id);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, frequency }),
      });
      if (!res.ok) {
        toast.error("עדכון ההתראות נכשל");
        return;
      }
      toast.success("ההתראות עודכנו");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("למחוק את החיפוש השמור?")) return;
    setPending(id);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast.error("המחיקה נכשלה");
        return;
      }
      toast.success("החיפוש נמחק");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (!searches.length) {
    return (
      <EmptyResults
        title="אין חיפושים שמורים"
        body='בכל דף תוצאות יש כפתור "שמירת חיפוש". שמרו חיפוש וקבלו התראה על מודעות חדשות שמתאימות לו.'
        action={
          <Button asChild>
            <Link href="/search">למסך החיפוש</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {searches.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3.5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            {s.frequency === "OFF" ? (
              <BellOff className="size-5" aria-hidden />
            ) : (
              <Bell className="size-5" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-medium">
              <Link href={toHref(s.filters)} className="hover:underline">
                {s.name}
              </Link>
            </h2>
            <p className="truncate text-xs text-muted-foreground num">
              {describe(s.filters)}
            </p>
            <p className="text-xs text-muted-foreground">
              נשמר {timeAgo(s.createdAt)}
              {s.lastNotified ? ` · התראה אחרונה ${timeAgo(s.lastNotified)}` : ""}
            </p>
          </div>

          <Select
            value={s.frequency}
            onValueChange={(v) => void updateFrequency(s.id, v)}
            disabled={pending === s.id}
          >
            <SelectTrigger className="w-40" aria-label={`תדירות התראות עבור ${s.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button asChild variant="outline" size="sm">
            <Link href={toHref(s.filters)}>
              <Search aria-hidden />
              הצגה
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void remove(s.id)}
            disabled={pending === s.id}
            aria-label={`מחיקת החיפוש ${s.name}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
