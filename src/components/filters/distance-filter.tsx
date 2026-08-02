"use client";

import * as React from "react";
import { LocateFixed, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/misc";
import type { FilterState } from "@/lib/filters";

type Push = (mutate: (sp: URLSearchParams) => void) => void;

const STEPS = [1, 2, 5, 10, 20, 30, 50, 100];

/** סינון לפי רדיוס ממיקום המשתמש. דורש הרשאת מיקום מהדפדפן. */
export function DistanceFilter({ state, push }: { state: FilterState; push: Push }) {
  const [loading, setLoading] = React.useState(false);
  const hasLocation = state.lat !== undefined && state.lng !== undefined;
  const radiusIndex = Math.max(
    0,
    STEPS.indexOf(state.radiusKm ?? 20) === -1 ? 4 : STEPS.indexOf(state.radiusKm ?? 20),
  );

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("הדפדפן שלך לא תומך באיתור מיקום");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        push((sp) => {
          sp.set("lat", pos.coords.latitude.toFixed(4));
          sp.set("lng", pos.coords.longitude.toFixed(4));
          sp.set("radius", String(state.radiusKm ?? 20));
        });
        toast.success("המיקום זוהה — התוצאות מסוננות לפי מרחק");
      },
      () => {
        setLoading(false);
        toast.error("לא הצלחנו לאתר את המיקום. אפשרו גישה למיקום בדפדפן.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  function clear() {
    push((sp) => {
      sp.delete("lat");
      sp.delete("lng");
      sp.delete("radius");
      if (sp.get("sort") === "distance") sp.delete("sort");
    });
  }

  if (!hasLocation) {
    return (
      <Button variant="outline" size="sm" className="w-full" loading={loading} onClick={requestLocation}>
        <LocateFixed aria-hidden />
        חיפוש לפי מרחק ממני
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">
          רדיוס: <span className="num font-medium">{state.radiusKm ?? 20} ק&quot;מ</span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="ביטול סינון לפי מרחק">
          <X aria-hidden />
        </Button>
      </div>
      <Slider
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={[radiusIndex]}
        aria-label="רדיוס חיפוש בקילומטרים"
        onValueChange={([i]) => {
          const km = STEPS[i ?? 4] ?? 20;
          push((sp) => sp.set("radius", String(km)));
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground num">
        <span>1</span>
        <span>100 ק&quot;מ</span>
      </div>
    </div>
  );
}
