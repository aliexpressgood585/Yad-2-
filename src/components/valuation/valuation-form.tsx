"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCount } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { HAND_LABELS, type CityOption, type DealKind, type MakeOption } from "@/lib/valuation";

export type ValuationFormValues = {
  type: "vehicle" | "realestate";
  manufacturer: string;
  model: string;
  year: string;
  hand: string;
  km: string;
  deal: DealKind;
  city: string;
  neighborhood: string;
  rooms: string;
  size: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1990 }, (_, i) => CURRENT_YEAR + 1 - i);
const ROOMS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8];

/** ערך "לא משנה" בתוך Select — Radix אינו מרשה ערך ריק לפריט. */
const ANY = "any";

/**
 * טופס מדד המחירים.
 *
 * הבחירה נכתבת ל-URL ולא ל-state בלבד: תוצאת שווי היא בדיוק סוג הדבר
 * שמשתמש שולח לעצמו או לצד השני במשא ומתן, ולכן היא חייבת כתובת.
 * החישוב עצמו רץ בשרת על אותם פרמטרים.
 */
export function ValuationForm({
  makes,
  cities,
  neighborhoods,
  initial,
}: {
  makes: MakeOption[];
  cities: CityOption[];
  neighborhoods: Record<DealKind, Record<string, string[]>>;
  initial: ValuationFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ValuationFormValues>(initial);
  const [tab, setTab] = useState<ValuationFormValues["type"]>(initial.type);

  const set = (patch: Partial<ValuationFormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const models = useMemo(
    () => makes.find((m) => m.manufacturer === values.manufacturer)?.models ?? [],
    [makes, values.manufacturer],
  );

  const cityOptions = useMemo(
    () => cities.filter((c) => (values.deal === "sale" ? c.sale : c.rent) > 0),
    [cities, values.deal],
  );

  const hoodOptions = neighborhoods[values.deal]?.[values.city] ?? [];

  function submit(type: ValuationFormValues["type"]) {
    const params = new URLSearchParams();
    params.set("type", type);

    if (type === "vehicle") {
      if (!values.manufacturer) return;
      params.set("make", values.manufacturer);
      if (values.model) params.set("model", values.model);
      if (values.year) params.set("year", values.year);
      if (values.hand) params.set("hand", values.hand);
      if (values.km) params.set("km", values.km);
    } else {
      if (!values.city) return;
      params.set("deal", values.deal);
      params.set("city", values.city);
      if (values.neighborhood) params.set("hood", values.neighborhood);
      if (values.rooms) params.set("rooms", values.rooms);
      if (values.size) params.set("size", values.size);
    }

    router.push(`${pricePaths.valuation}?${params.toString()}`);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as ValuationFormValues["type"])}
      className="rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="vehicle" className="flex-1 sm:flex-none">
          רכב
        </TabsTrigger>
        <TabsTrigger value="realestate" className="flex-1 sm:flex-none">
          דירה
        </TabsTrigger>
      </TabsList>

      {/* --- רכב --- */}
      <TabsContent value="vehicle" className="mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit("vehicle");
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">יצרן</Label>
              <Select
                value={values.manufacturer}
                onValueChange={(v) => set({ manufacturer: v, model: "" })}
              >
                <SelectTrigger id="make">
                  <SelectValue placeholder="בחר יצרן" />
                </SelectTrigger>
                <SelectContent>
                  {makes.map((m) => (
                    <SelectItem key={m.manufacturer} value={m.manufacturer}>
                      {m.manufacturer}{" "}
                      <span className="num text-muted-foreground">
                        ({formatCount(m.count)})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model">דגם</Label>
              <Select
                value={values.model || ANY}
                onValueChange={(v) => set({ model: v === ANY ? "" : v })}
                disabled={!models.length}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder={values.manufacturer ? "כל הדגמים" : "בחר יצרן קודם"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>כל הדגמים</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      {m.model}{" "}
                      <span className="num text-muted-foreground">({formatCount(m.count)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="year">שנת ייצור</Label>
              <Select
                value={values.year || ANY}
                onValueChange={(v) => set({ year: v === ANY ? "" : v })}
              >
                <SelectTrigger id="year">
                  <SelectValue placeholder="כל השנים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>כל השנים</SelectItem>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      <span className="num">{y}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hand">יד</Label>
              <Select
                value={values.hand || ANY}
                onValueChange={(v) => set({ hand: v === ANY ? "" : v })}
              >
                <SelectTrigger id="hand">
                  <SelectValue placeholder="לא משנה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>לא משנה</SelectItem>
                  {Object.entries(HAND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="km">קילומטראז&apos;</Label>
              <Input
                id="km"
                type="number"
                inputMode="numeric"
                min={0}
                max={900000}
                step={1000}
                placeholder="לדוגמה 84000"
                className="num"
                value={values.km}
                onChange={(e) => set({ km: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" disabled={!values.manufacturer} className="w-full sm:w-auto">
            <Search aria-hidden />
            הצג טווח שווי
          </Button>
        </form>
      </TabsContent>

      {/* --- נדל"ן --- */}
      <TabsContent value="realestate" className="mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit("realestate");
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal">סוג עסקה</Label>
              <Select
                value={values.deal}
                onValueChange={(v) => set({ deal: v as DealKind, neighborhood: "" })}
              >
                <SelectTrigger id="deal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">מכירה</SelectItem>
                  <SelectItem value="rent">השכרה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">עיר</Label>
              <Select
                value={values.city}
                onValueChange={(v) => set({ city: v, neighborhood: "" })}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder="בחר עיר" />
                </SelectTrigger>
                <SelectContent>
                  {cityOptions.map((c) => (
                    <SelectItem key={c.city} value={c.city}>
                      {c.city}{" "}
                      <span className="num text-muted-foreground">
                        ({formatCount(values.deal === "sale" ? c.sale : c.rent)})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hood">שכונה</Label>
              <Select
                value={values.neighborhood || ANY}
                onValueChange={(v) => set({ neighborhood: v === ANY ? "" : v })}
                disabled={!hoodOptions.length}
              >
                <SelectTrigger id="hood">
                  <SelectValue placeholder={hoodOptions.length ? "כל השכונות" : "אין שכונות ברשימה"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>כל השכונות</SelectItem>
                  {hoodOptions.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rooms">חדרים</Label>
              <Select
                value={values.rooms || ANY}
                onValueChange={(v) => set({ rooms: v === ANY ? "" : v })}
              >
                <SelectTrigger id="rooms">
                  <SelectValue placeholder="לא משנה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>לא משנה</SelectItem>
                  {ROOMS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      <span className="num">{r}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="size">שטח במ&quot;ר</Label>
              <Input
                id="size"
                type="number"
                inputMode="numeric"
                min={10}
                max={2000}
                step={5}
                placeholder="לדוגמה 90"
                className="num"
                value={values.size}
                onChange={(e) => set({ size: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" disabled={!values.city} className="w-full sm:w-auto">
            <Search aria-hidden />
            הצג טווח שווי
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
