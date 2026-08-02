"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFilterParams } from "@/hooks/use-filter-params";
import { CITY_NAMES, REGIONS, citiesByRegion, type Region } from "@/lib/cities";

type Facet = { city: string; count: number };

/**
 * בחירת ערים מרובה. הערים שמופיעות בתוצאות מוצגות ראשונות עם ספירה,
 * ולצידן חיפוש חופשי מתוך כל רשימת היישובים.
 */
export function CityFilter({
  facets,
  selected,
}: {
  facets: Facet[];
  selected: string[];
}) {
  const { toggleInList, setParam } = useFilterParams();
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);

  const counts = React.useMemo(
    () => new Map(facets.map((f) => [f.city, f.count])),
    [facets],
  );

  const options = React.useMemo(() => {
    if (query.trim()) {
      const q = query.trim();
      return CITY_NAMES.filter((c) => c.includes(q)).slice(0, 25);
    }
    const fromFacets = facets.map((f) => f.city);
    const merged = [...new Set([...selected, ...fromFacets])];
    return showAll ? merged : merged.slice(0, 10);
  }, [query, facets, selected, showAll]);

  function selectRegion(region: Region) {
    const cities = citiesByRegion(region).map((c) => c.name);
    setParam("city", [...new Set([...selected, ...cities])].join(","));
  }

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש יישוב…"
          className="ps-8"
          aria-label="חיפוש יישוב"
        />
      </div>

      <ul className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {options.map((city) => {
          const id = `city-${city}`;
          const count = counts.get(city);
          return (
            <li key={city} className="flex items-center gap-2.5">
              <Checkbox
                id={id}
                checked={selected.includes(city)}
                onCheckedChange={() => toggleInList("city", city)}
              />
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {city}
              </Label>
              {count !== undefined ? (
                <span className="num text-xs text-muted-foreground">{count}</span>
              ) : null}
            </li>
          );
        })}
        {options.length === 0 ? (
          <li className="py-2 text-xs text-muted-foreground">לא נמצא יישוב מתאים</li>
        ) : null}
      </ul>

      {!query && facets.length > 10 ? (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "הצגת פחות" : "הצגת כל היישובים בתוצאות"}
        </Button>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {REGIONS.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => selectRegion(region)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {region}
          </button>
        ))}
      </div>
    </div>
  );
}
