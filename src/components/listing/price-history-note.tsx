"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { timeAgo } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

type Entry = { price: number; createdAt: string };

/**
 * מציג את שינוי המחיר האחרון ("ירד ב-₪500 לפני 3 ימים").
 * ירידת מחיר היא אות קנייה חזק ולכן מודגשת.
 */
export function PriceHistoryNote({ history }: { history: Entry[] }) {
  if (history.length < 2) return null;

  const latest = history[history.length - 1]!;
  const previous = history[history.length - 2]!;
  const delta = latest.price - previous.price;
  if (delta === 0) return null;

  const dropped = delta < 0;
  const Icon = dropped ? TrendingDown : TrendingUp;

  return (
    <p
      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium ${
        dropped ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
      <span>
        {dropped ? "ירד ב־" : "עלה ב־"}
        <span className="num">{formatPrice(Math.abs(delta))}</span>{" "}
        {timeAgo(latest.createdAt)}
      </span>
    </p>
  );
}
