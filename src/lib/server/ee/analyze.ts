import "server-only";
import { CGMD_YEARS, GMW_V3_YEARS, type DatasetId } from "@/lib/datasets";
import {
  consecutivePairs,
  seriesStart,
  shapeChange,
  shapeCoastal,
  shapeCondition,
  shapeExtent,
  shapeStructure,
  yearSeries,
} from "@/lib/analysis/shape";
import type { ModuleId, ModuleResultMap } from "@/lib/analysis/types";
import type { Aoi } from "@/lib/geo/aoi";
import { getConfig } from "../config";
import { evaluate, getEE } from "./client";
import * as R from "./recipes";
import type { EE, EEObject } from "./types";

type Raw = Record<string, unknown>;

export interface ModuleOutput<M extends ModuleId> {
  result: ModuleResultMap[M];
  datasets: DatasetId[];
  warnings: string[];
  /** True when at least one dataset failed and the result is incomplete. */
  partial: boolean;
}

const CONDITION_MONTHS = 24;

function toEEGeometry(ee: EE, aoi: Aoi): EEObject {
  // Planar (non-geodesic) edges match how GeoJSON is drawn on a web map.
  return ee.Geometry(aoi.geometry, null, false);
}

/** Run a promise but record a warning instead of failing the whole module. */
type Warnings = string[] & { partial?: boolean };

async function soft<T>(p: Promise<T>, warnings: Warnings, label: string): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    warnings.push(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
    warnings.partial = true;
    return null;
  }
}

export async function runModule<M extends ModuleId>(module: M, aoi: Aoi, opts: { carbonFraction?: number } = {}): Promise<ModuleOutput<M>> {
  const ee = await getEE();
  const g = toEEGeometry(ee, aoi);
  const warnings: Warnings = [];

  switch (module) {
    case "extent": {
      // Use 30 m for the 10 m layer on very large areas to stay within interactive limits.
      const scale10 = aoi.areaHa > 50_000 ? 30 : 10;
      if (scale10 !== 10) warnings.push("10 m extent summarised at 30 m because the area is larger than 50,000 ha.");
      const [gmw, cgmd, v4] = await Promise.all([
        soft(evaluate<Raw>(R.gmwV3AreaByYear(ee, g, GMW_V3_YEARS)), warnings, "GMW v3"),
        soft(evaluate<Raw>(R.cgmdAreaByYear(ee, g, CGMD_YEARS)), warnings, "CGMD"),
        soft(evaluate<Raw>(R.gmwV4AreaM2(ee, g, scale10)), warnings, "GMW 10 m 2020"),
      ]);
      return {
        result: shapeExtent(gmw, cgmd, v4, GMW_V3_YEARS, CGMD_YEARS) as ModuleResultMap[M],
        datasets: ["gmw-v3", "cgmd", "gmw-v4-2020"],
        warnings: [...warnings],
        partial: Boolean(warnings.partial),
      };
    }

    case "change": {
      const pairs = consecutivePairs(GMW_V3_YEARS);
      const overall: [number, number] = [GMW_V3_YEARS[0], GMW_V3_YEARS[GMW_V3_YEARS.length - 1]];
      const [raw, cgmdRaw] = await Promise.all([
        soft(evaluate<Raw>(R.gmwV3ChangeAreas(ee, g, [...pairs, overall])), warnings, "GMW v3 change"),
        soft(evaluate<Raw>(R.cgmdAreaByYear(ee, g, [CGMD_YEARS[0], CGMD_YEARS[CGMD_YEARS.length - 1]])), warnings, "CGMD"),
      ]);
      const cgmd = yearSeries(cgmdRaw, [CGMD_YEARS[0], CGMD_YEARS[CGMD_YEARS.length - 1]]);
      return {
        result: shapeChange(raw, pairs, overall, cgmdRaw ? cgmd : []) as ModuleResultMap[M],
        datasets: ["gmw-v3", "cgmd"],
        warnings: [...warnings],
        partial: Boolean(warnings.partial),
      };
    }

    case "structure": {
      const cfg = getConfig();
      const socImg = cfg.socAsset ? R.soilCarbon(ee, cfg.socAsset) : null;
      const [tdx, simard, soc] = await Promise.all([
        soft(evaluate<Raw>(R.tandemxStats(ee, g)), warnings, "TanDEM-X height"),
        soft(evaluate<Raw>(R.simardStats(ee, g)), warnings, "Simard biomass"),
        socImg ? soft(evaluate<Raw>(R.socStats(ee, g, socImg)), warnings, "Soil carbon") : Promise.resolve(null),
      ]);
      if (!cfg.socAsset) warnings.push("Soil carbon is not configured on this server (GEE_SOC_ASSET), so totals exclude soil carbon.");
      const datasets: DatasetId[] = ["tandemx-height", "simard-agb", "simard-hmax"];
      if (cfg.socAsset) datasets.push("soil-carbon");
      return {
        result: shapeStructure(tdx, simard, soc, opts.carbonFraction) as ModuleResultMap[M],
        datasets,
        warnings: [...warnings],
        partial: Boolean(warnings.partial),
      };
    }

    case "coastal": {
      const raw = await soft(evaluate<Raw>(R.coastalStats(ee, g)), warnings, "Tidal wetlands");
      return {
        result: shapeCoastal(raw) as ModuleResultMap[M],
        datasets: ["murray-tidal-change", "murray-intertidal"],
        warnings: [...warnings],
        partial: Boolean(warnings.partial),
      };
    }

    case "condition": {
      const maskRaw = await soft(evaluate<Raw>(R.maskPixelCount(ee, g)), warnings, "Mangrove mask");
      const maskCount = typeof maskRaw?.mangrove === "number" ? maskRaw.mangrove : 0;
      const useMask = maskCount > 0;
      if (!useMask) warnings.push("No mangroves in the GMW 2020 10 m map here, so condition is computed over the whole area.");
      let denominator: number | null = maskCount || null;
      if (!useMask) {
        // ≈ number of 20 m pixels in the AOI
        denominator = Math.max(1, Math.round((aoi.areaHa * 10_000) / 400));
      }
      const start = seriesStart(new Date(), CONDITION_MONTHS);
      const months = await soft(
        evaluate<Raw[]>(R.conditionSeries(ee, g, start, CONDITION_MONTHS, useMask), 240_000),
        warnings,
        "Sentinel-2",
      );
      return {
        result: shapeCondition(months, denominator, useMask ? "gmw-10m-2020" : "aoi") as ModuleResultMap[M],
        datasets: ["sentinel-2", "gmw-v4-2020"],
        warnings: [...warnings],
        partial: Boolean(warnings.partial),
      };
    }
  }
  throw new Error(`Unknown module ${module satisfies never}`);
}
