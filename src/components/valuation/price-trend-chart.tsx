"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatCount, formatPrice } from "@/lib/format";
import type { TrendPoint } from "@/lib/valuation";

/**
 * מגמת החציון ב-12 החודשים האחרונים.
 *
 * מוצגים רק חודשים שעברו את גודל המדגם המזערי, ולכן ייתכנו פערים בקו —
 * זה מכוון. קו רציף שמחבר חודש עם 40 מודעות לחודש עם 3 היה מצייר מגמה
 * שלא נמדדה.
 *
 * הצירים ב-LTR: Recharts מניחה ציר זמן משמאל לימין (ראה DESIGN.md).
 */
export function PriceTrendChart({
  points,
  currency = "ILS",
}: {
  points: TrendPoint[];
  currency?: string;
}) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => formatCompact(v)}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              direction: "rtl",
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value: number, _name, item) => [
              `${formatPrice(value, { currency })} · ${formatCount(
                (item?.payload as TrendPoint | undefined)?.sample ?? 0,
              )} מודעות`,
              "חציון",
            ]}
          />
          <Line
            type="monotone"
            dataKey="median"
            name="חציון"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
