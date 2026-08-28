"use client";

import * as React from "react";
import type MapLibre from "maplibre-gl";
import { useTheme } from "next-themes";

import { mapStyle } from "@/lib/map-style";
import { PALETTE } from "@/lib/palette";

/**
 * מפה של מודעה בודדת. מוצג עיגול רדיוס במקום סמן נקודתי,
 * כדי לא לחשוף את הכתובת המדויקת של המוכר.
 *
 * ## הספרייה נטענת רק כשהמפה נראית
 *
 * `maplibre-gl` שוקלת כ-140KB דחוסים, והמפה יושבת בתחתית דף המודעה —
 * מתחת לתיאור, למפרט ולהתפלגות המחירים. ייבוא סטטי שלה מכניס את כל
 * המשקל הזה למנה הראשונה של הדף, לפני שהמשתמש ראה אפילו את המחיר.
 * Lighthouse מדד 137KB של JavaScript שאינו בשימוש בדף המודעה, וזה
 * כמעט כולו זה.
 *
 * שני מנגנונים יחד:
 *
 *   **`IntersectionObserver`** — הטעינה מתחילה רק כשהמפה מתקרבת
 *   לאזור הנראה. `rootMargin` של 200px מתחיל אותה מעט לפני, כדי
 *   שהמשתמש לא יראה מלבן ריק בזמן הגלילה.
 *
 *   **`await import()`** — הספרייה נכנסת למנה נפרדת שנטענת אז.
 *
 * דפדפן בלי `IntersectionObserver` טוען מיד; זה ה-fallback, ולא
 * מסך ריק.
 */
export function ListingMap({
  lat,
  lng,
  label,
  radiusMeters = 450,
  className,
}: {
  lat: number;
  lng: number;
  label: string;
  radiusMeters?: number;
  className?: string;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibre.Map | null>(null);
  const [visible, setVisible] = React.useState(false);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || !container.current || mapRef.current) return;

    let cancelled = false;
    let created: MapLibre.Map | null = null;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      // המשתמש עשוי לגלול הלאה ולנווט בזמן שהספרייה נטענת
      if (cancelled || !container.current) return;

      const map = new maplibregl.Map({
        container: container.current,
        style: mapStyle(resolvedTheme === "dark"),
        center: [lng, lat],
        zoom: 13.5,
        attributionControl: { compact: true },
      });
      created = map;
      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      map.scrollZoom.disable();

      map.on("load", () => {
        map.addSource("area", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {},
          },
        });

        // רדיוס במטרים → פיקסלים, תלוי בזום ובקו הרוחב
        map.addLayer({
          id: "area-fill",
          type: "circle",
          source: "area",
          paint: {
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              radiusMeters / (156_543 / Math.pow(2, 10)) / Math.cos((lat * Math.PI) / 180),
              18,
              radiusMeters / (156_543 / Math.pow(2, 18)) / Math.cos((lat * Math.PI) / 180),
            ],
            "circle-color": PALETTE.amber,
            "circle-opacity": 0.18,
            "circle-stroke-width": 2,
            "circle-stroke-color": PALETTE.amber,
            "circle-stroke-opacity": 0.55,
          },
        });
      });
    })();

    return () => {
      cancelled = true;
      created?.remove();
      mapRef.current = null;
    };
    // הסגנון מתעדכן בנפרד ב-effect הבא כדי לא לבנות את המפה מחדש
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lat, lng, radiusMeters]);

  React.useEffect(() => {
    mapRef.current?.setStyle(mapStyle(resolvedTheme === "dark"));
  }, [resolvedTheme]);

  return (
    <div className={className}>
      <div
        ref={container}
        className="h-64 w-full overflow-hidden border border-border sm:h-72"
        role="img"
        aria-label={`מפה המציגה אזור מקורב: ${label}`}
      />
    </div>
  );
}
