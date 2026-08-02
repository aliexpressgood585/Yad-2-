"use client";

import { ArrowUpDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilterParams } from "@/hooks/use-filter-params";
import { SORT_LABELS } from "@/lib/filters";
import type { SortMode } from "@/lib/listings";

const ALWAYS: SortMode[] = ["date", "price_asc", "price_desc", "views"];

export function SortSelect({ hasQuery = false }: { hasQuery?: boolean }) {
  const { state, setParam } = useFilterParams();
  const hasLocation = state.lat !== undefined && state.lng !== undefined;

  const options: SortMode[] = [
    ...(hasQuery ? (["relevance"] as SortMode[]) : []),
    ...ALWAYS,
    ...(hasLocation ? (["distance"] as SortMode[]) : []),
  ];

  return (
    <Select value={state.sort} onValueChange={(v) => setParam("sort", v)}>
      <SelectTrigger className="w-auto min-w-44 gap-2" aria-label="מיון התוצאות">
        <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {SORT_LABELS[mode]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
