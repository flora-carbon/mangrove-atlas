import "server-only";
import { BIOMASS, LAYER_BY_ID, NDVI, SOC, VIRIDIS, type LayerId } from "@/lib/layers";
import { getConfig } from "../config";
import { getEE, getMapId } from "./client";
import * as R from "./recipes";
import type { EE, EEObject } from "./types";

export interface TileParams {
  year?: number;
  from?: number;
  to?: number;
}

export class LayerParamError extends Error {}

const hex = (colors: string[]) => colors.map((c) => c.replace("#", ""));

function pickYear(layer: LayerId, year: number | undefined): number {
  const def = LAYER_BY_ID[layer];
  const years = def.years ?? [];
  const y = year ?? def.defaultYear ?? years[years.length - 1];
  if (!years.includes(y)) throw new LayerParamError(`Year ${y} is not available for ${def.title}`);
  return y;
}

function build(ee: EE, layer: LayerId, p: TileParams): { image: EEObject; vis: object } {
  const ninetyDaysAgo = () => {
    const now = ee.Date(Date.now());
    return { start: now.advance(-90, "day"), end: now };
  };
  switch (layer) {
    case "gmw-v3-extent":
      return { image: R.gmwV3Extent(ee, pickYear(layer, p.year)), vis: { palette: ["0f766e"] } };
    case "cgmd-extent":
      return { image: R.cgmdExtent(ee, pickYear(layer, p.year)), vis: { palette: ["13a36b"] } };
    case "gmw-v3-change": {
      const from = pickYear(layer, p.from ?? 1996);
      const to = pickYear(layer, p.to ?? 2020);
      if (from >= to) throw new LayerParamError("'from' must be earlier than 'to'");
      return { image: R.gmwV3Change(ee, from, to), vis: { min: 1, max: 2, palette: ["2563eb", "dc2626"] } };
    }
    case "gmw-v4-2020":
      return { image: R.gmwV4_2020(ee), vis: { palette: ["22c55e"] } };
    case "tandemx-height":
      return { image: R.tandemxHeight(ee), vis: { min: 0, max: 30, palette: hex(VIRIDIS) } };
    case "simard-agb":
      return { image: R.simardAgb(ee), vis: { min: 0, max: 300, palette: hex(BIOMASS) } };
    case "simard-hmax":
      return { image: R.simardHmax(ee), vis: { min: 0, max: 30, palette: hex(VIRIDIS) } };
    case "soil-carbon": {
      const asset = getConfig().socAsset;
      if (!asset) throw new LayerParamError("Soil carbon is not configured on this server (GEE_SOC_ASSET)");
      return { image: R.soilCarbon(ee, asset), vis: { min: 0, max: 700, palette: hex(SOC) } };
    }
    case "murray-tidal-change":
      return {
        image: R.murrayTidalChange(ee),
        vis: { min: 1, max: 4, palette: ["dc2626", "2563eb", "f59e0b", "a855f7"] },
      };
    case "murray-intertidal":
      return { image: R.murrayIntertidal(ee), vis: { palette: ["d6a35c"] } };
    case "s2-truecolor": {
      const { start, end } = ninetyDaysAgo();
      return {
        image: R.s2Clear(ee, start, end).median().select(["B4", "B3", "B2"]),
        vis: { min: 0, max: 2500, gamma: 1.1 },
      };
    }
    case "s2-ndvi": {
      const { start, end } = ninetyDaysAgo();
      return { image: R.ndvi(R.s2Clear(ee, start, end).median()), vis: { min: 0, max: 0.9, palette: hex(NDVI) } };
    }
  }
}

interface CachedMap {
  url: string;
  expiresAt: number;
}

const MAP_TTL_MS = 3 * 60 * 60 * 1000; // EE map IDs stay valid for hours; refresh every 3 h.
const mapCache = new Map<string, CachedMap>();

export async function getLayerTiles(layer: LayerId, params: TileParams): Promise<CachedMap & { cached: boolean }> {
  const key = `${layer}|${params.year ?? ""}|${params.from ?? ""}|${params.to ?? ""}`;
  const hit = mapCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit, cached: true };

  const ee = await getEE();
  const { image, vis } = build(ee, layer, params);
  const map = await getMapId(image, vis);
  const entry = { url: map.urlFormat, expiresAt: Date.now() + MAP_TTL_MS };
  mapCache.set(key, entry);
  if (mapCache.size > 500) mapCache.delete(mapCache.keys().next().value as string);
  return { ...entry, cached: false };
}
