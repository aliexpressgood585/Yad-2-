import type { StyleSpecification } from "maplibre-gl";

/**
 * סגנון מפה מבוסס אריחי raster חינמיים של CARTO (OpenStreetMap).
 * אין צורך במפתח API, ויש גרסאות לבהיר ולכהה.
 */
export function mapStyle(dark: boolean): StyleSpecification {
  const variant = dark ? "dark_all" : "light_all";
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
          `https://b.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
          `https://c.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

/** גבולות ישראל בקירוב — לאתחול תצוגת המפה הכללית. */
export const ISRAEL_BOUNDS: [[number, number], [number, number]] = [
  [34.2, 29.4],
  [35.9, 33.4],
];

export const ISRAEL_CENTER: [number, number] = [34.95, 31.6];
