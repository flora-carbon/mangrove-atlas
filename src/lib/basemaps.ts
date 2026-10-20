import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "satellite" | "streets" | "esri";

export interface Basemap {
  id: BasemapId;
  label: string;
  style: string | StyleSpecification;
  note: string;
}

const rasterStyle = (tiles: string[], attribution: string, maxzoom = 19): StyleSpecification => ({
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    basemap: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
});

/**
 * Basemaps chosen for licences that allow commercial and open-source reuse:
 * - Streets: OpenFreeMap (OpenStreetMap data, ODbL) — free, no API key.
 * - Satellite: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0). Later EOX years
 *   are CC BY-NC-SA, so we deliberately default to 2016. For current imagery
 *   switch on the "Latest Sentinel-2" layer, rendered live from Earth Engine.
 * - Esri World Imagery is opt-in (NEXT_PUBLIC_ENABLE_ESRI_IMAGERY=true) because
 *   its terms depend on your Esri licence.
 */
export function getBasemaps(): Basemap[] {
  const list: Basemap[] = [
    {
      id: "satellite",
      label: "Satellite (2016)",
      style: rasterStyle(
        [
          process.env.NEXT_PUBLIC_SATELLITE_TILES ??
            "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg",
        ],
        '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless – s2maps.eu</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
        15,
      ),
      note: "Sentinel-2 cloudless 2016 (EOX, CC BY 4.0)",
    },
    {
      id: "streets",
      label: "Streets",
      style: process.env.NEXT_PUBLIC_STREETS_STYLE ?? "https://tiles.openfreemap.org/styles/positron",
      note: "OpenFreeMap · © OpenStreetMap contributors",
    },
  ];
  if (process.env.NEXT_PUBLIC_ENABLE_ESRI_IMAGERY === "true") {
    list.push({
      id: "esri",
      label: "Esri imagery",
      style: rasterStyle(
        ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      ),
      note: "Esri World Imagery (check your Esri licence)",
    });
  }
  return list;
}
