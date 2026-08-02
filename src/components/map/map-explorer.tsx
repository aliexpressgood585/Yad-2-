"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type MapMouseEvent } from "maplibre-gl";
import { useTheme } from "next-themes";
import { Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";

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
import { ISRAEL_BOUNDS, mapStyle } from "@/lib/map-style";
import { formatPrice, formatCount } from "@/lib/format";
import { PALETTE } from "@/lib/palette";

type Category = { id: string; slug: string; name: string };

const SOURCE_ID = "listings";

/**
 * מפת כל המודעות עם קיבוץ אשכולות (clustering).
 * הפילטרים נשמרים ב-URL כדי שהתצוגה תהיה ניתנת לשיתוף.
 */
export function MapExplorer({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { resolvedTheme } = useTheme();

  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const popupRef = React.useRef<maplibregl.Popup | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [count, setCount] = React.useState(0);

  const category = params.get("category") ?? "all";
  const priceMin = params.get("priceMin") ?? "";
  const priceMax = params.get("priceMax") ?? "";

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (!value || value === "all") sp.delete(key);
      else sp.set(key, value);
      const qs = sp.toString();
      router.replace(qs ? `/map?${qs}` : "/map", { scroll: false });
    },
    [params, router],
  );

  // אתחול המפה פעם אחת
  React.useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle(document.documentElement.classList.contains("dark")),
      bounds: ISRAEL_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: false },
        trackUserLocation: false,
      }),
      "top-left",
    );

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 55,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": PALETTE.sign,
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30, 200, 38],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.6,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": PALETTE.signal,
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // לחיצה על אשכול מתקרבת אליו
      map.on("click", "clusters", async (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId === undefined) return;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId as number);
        const geometry = features[0]!.geometry;
        if (geometry.type !== "Point") return;
        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: zoom + 0.2,
        });
      });

      map.on("click", "unclustered", (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const p = feature.properties as Record<string, string>;

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: "260px" })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(popupHtml(p))
          .addTo(map);
      });

      for (const layer of ["clusters", "unclustered"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    mapRef.current?.setStyle(mapStyle(resolvedTheme === "dark"));
  }, [resolvedTheme]);

  // טעינת הנקודות מחדש בכל שינוי פילטר
  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (category !== "all") sp.set("category", category);
        if (priceMin) sp.set("priceMin", priceMin);
        if (priceMax) sp.set("priceMax", priceMax);

        const res = await fetch(`/api/map?${sp.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as GeoJSON.FeatureCollection;

        setCount(data.features.length);

        const apply = () => {
          const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
          source?.setData(data);
        };
        // ייתכן שהמפה עוד לא סיימה להיטען בטעינה הראשונה
        if (mapRef.current?.isStyleLoaded() && mapRef.current.getSource(SOURCE_ID)) apply();
        else mapRef.current?.once("idle", apply);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("טעינת המודעות למפה נכשלה");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [category, priceMin, priceMax]);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      toast.error("הדפדפן שלך לא תומך באיתור מיקום");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        mapRef.current?.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 13,
        }),
      () => toast.error("לא הצלחנו לאתר את המיקום"),
    );
  }

  return (
    <div className="relative">
      <div className="container py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="map-category">קטגוריה</Label>
            <Select value={category} onValueChange={(v) => setParam("category", v)}>
              <SelectTrigger id="map-category" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="map-price-min">מחיר מ־</Label>
            <Input
              id="map-price-min"
              type="number"
              dir="ltr"
              className="w-32"
              defaultValue={priceMin}
              onBlur={(e) => setParam("priceMin", e.target.value || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="map-price-max">עד</Label>
            <Input
              id="map-price-max"
              type="number"
              dir="ltr"
              className="w-32"
              defaultValue={priceMax}
              onBlur={(e) => setParam("priceMax", e.target.value || null)}
            />
          </div>

          <Button variant="outline" onClick={locateMe}>
            <LocateFixed aria-hidden />
            המיקום שלי
          </Button>

          <p className="ms-auto text-sm text-muted-foreground" role="status" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                טוען…
              </span>
            ) : (
              <>
                <span className="num font-medium text-foreground">
                  {formatCount(count)}
                </span>{" "}
                מודעות על המפה
              </>
            )}
          </p>
        </div>
      </div>

      <div
        ref={container}
        className="h-[70dvh] w-full border-y border-border"
        role="application"
        aria-label="מפת מודעות אינטראקטיבית"
      />

      <p className="container py-3 text-xs text-muted-foreground">
        המיקומים מוצגים באופן מקורב מטעמי פרטיות. לחיצה על אשכול מתקרבת אליו, ולחיצה
        על סמן פותחת את פרטי המודעה.
      </p>
    </div>
  );
}

/** תוכן החלונית שנפתחת בלחיצה על סמן. */
function popupHtml(p: Record<string, string>): string {
  const escape = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const price = p.price ? formatPrice(Number(p.price)) : "לא צוין מחיר";

  return `
    <a href="/item/${escape(p.slug)}" style="display:block;text-decoration:none;color:inherit;direction:rtl;">
      ${
        p.thumb
          ? `<img src="${escape(p.thumb)}" alt="" style="width:100%;height:120px;object-fit:cover;display:block;" loading="lazy">`
          : ""
      }
      <div style="padding:10px;">
        <div style="font-weight:700;font-size:15px;">${price}</div>
        <div style="font-size:13px;line-height:1.35;margin-top:2px;">${escape(p.title)}</div>
        <div style="font-size:11px;opacity:.7;margin-top:4px;">${escape(p.city)}</div>
      </div>
    </a>`;
}
