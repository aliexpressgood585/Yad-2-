"use client";

import * as React from "react";
import maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";

import { mapStyle } from "@/lib/map-style";

/**
 * מפה של מודעה בודדת. מוצג עיגול רדיוס במקום סמן נקודתי,
 * כדי לא לחשוף את הכתובת המדויקת של המוכר.
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
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle(resolvedTheme === "dark"),
      center: [lng, lat],
      zoom: 13.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.scrollZoom.disable();

    map.on("load", () => {
      map.addSource("area", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} },
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
          "circle-color": "#0f6d55",
          "circle-opacity": 0.18,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f6d55",
          "circle-stroke-opacity": 0.55,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // הסגנון מתעדכן בנפרד ב-effect הבא כדי לא לבנות את המפה מחדש
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusMeters]);

  React.useEffect(() => {
    mapRef.current?.setStyle(mapStyle(resolvedTheme === "dark"));
  }, [resolvedTheme]);

  return (
    <div className={className}>
      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-lg border border-border sm:h-72"
        role="img"
        aria-label={`מפה המציגה אזור מקורב: ${label}`}
      />
    </div>
  );
}
