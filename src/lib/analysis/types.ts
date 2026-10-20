import type { DatasetId } from "../datasets";

export const ANALYSIS_SCHEMA_VERSION = "1.0";

export const MODULES = ["extent", "change", "structure", "coastal", "condition"] as const;
export type ModuleId = (typeof MODULES)[number];

export function isModuleId(v: string): v is ModuleId {
  return (MODULES as readonly string[]).includes(v);
}

export interface YearValue {
  year: number;
  ha: number;
}

export interface ExtentResult {
  gmwV3: YearValue[];
  cgmd: YearValue[];
  gmw10m2020Ha: number | null;
  /** Latest available extent and the dataset it came from. */
  latest: { year: number; ha: number; dataset: DatasetId } | null;
}

export interface ChangeStep {
  from: number;
  to: number;
  gainHa: number;
  lossHa: number;
  netHa: number;
}

export interface ChangeResult {
  gmwV3: ChangeStep[];
  /** 1996 → 2020 (GMW v3) */
  overall: ChangeStep | null;
  /** First → last year net change from CGMD annual series. */
  cgmdNet: { from: number; to: number; netHa: number; pct: number | null } | null;
}

export interface HeightClass {
  label: string;
  ha: number;
}

export interface CarbonEstimate {
  /** Aboveground carbon (Mg C) = AGB × carbon fraction. */
  agcMg: number | null;
  agcCo2eMg: number | null;
  /** Soil organic carbon 0–1 m (Mg C), when a SOC asset is configured. */
  socMg: number | null;
  socCo2eMg: number | null;
  totalCo2eMg: number | null;
  factors: { carbonFraction: number; co2PerC: number; carbonFractionSource: string };
}

export interface StructureResult {
  height2015: { meanM: number | null; maxM: number | null; p50M: number | null; p90M: number | null; classes: HeightClass[] };
  hmax2000MeanM: number | null;
  agb: { meanMgHa: number | null; totalMg: number | null; areaHa: number | null };
  soc: { meanMgCHa: number | null; totalMgC: number | null } | null;
  carbon: CarbonEstimate;
}

export interface CoastalResult {
  period: string;
  mangroveLossHa: number;
  mangroveGainHa: number;
  otherTidalLossHa: number;
  otherTidalGainHa: number;
  tidalFlatHa: number;
}

export interface ConditionMonth {
  month: string;
  scenes: number;
  ndvi: number | null;
  mvi: number | null;
  /** Fraction of the mask with a clear observation that month (0–1). */
  clearFraction: number | null;
}

export interface ConditionResult {
  maskUsed: "gmw-10m-2020" | "aoi";
  months: ConditionMonth[];
  latest: ConditionMonth | null;
  /** NDVI change, latest 3 clear months vs same months one year earlier. */
  ndviYoY: number | null;
}

export interface ModuleResultMap {
  extent: ExtentResult;
  change: ChangeResult;
  structure: StructureResult;
  coastal: CoastalResult;
  condition: ConditionResult;
}

export interface ModuleResponse<M extends ModuleId = ModuleId> {
  schemaVersion: string;
  module: M;
  engine: "gee";
  generatedAt: string;
  aoi: { areaHa: number; bbox: [number, number, number, number] };
  datasets: DatasetId[];
  result: ModuleResultMap[M];
  warnings: string[];
  /** True when a dataset failed and the result is incomplete. */
  partial: boolean;
  cached: boolean;
}

export interface ApiError {
  error: string;
  code: "bad_request" | "not_configured" | "rate_limited" | "engine_error" | "too_large";
}
