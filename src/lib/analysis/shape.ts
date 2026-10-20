/**
 * Pure functions that turn raw Earth Engine dictionaries into typed results.
 * Kept separate from the EE calls so they can be unit-tested without network.
 */
import { carbonEstimate } from "./carbon";
import type {
  ChangeResult,
  ChangeStep,
  CoastalResult,
  ConditionMonth,
  ConditionResult,
  ExtentResult,
  HeightClass,
  StructureResult,
  YearValue,
} from "./types";

type Raw = Record<string, unknown>;
const M2_PER_HA = 10_000;

export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ha = (v: unknown): number => (num(v) ?? 0) / M2_PER_HA;
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function yearSeries(raw: Raw | null | undefined, years: readonly number[]): YearValue[] {
  if (!raw) return [];
  return years.map((year) => ({ year, ha: round(ha(raw[`y${year}`])) }));
}

export function shapeExtent(
  gmwV3Raw: Raw | null,
  cgmdRaw: Raw | null,
  gmw10mRaw: Raw | null,
  gmwYears: readonly number[],
  cgmdYears: readonly number[],
): ExtentResult {
  const gmwV3 = yearSeries(gmwV3Raw, gmwYears);
  const cgmd = yearSeries(cgmdRaw, cgmdYears);
  const gmw10m2020Ha = gmw10mRaw ? round(ha(gmw10mRaw.area)) : null;
  const lastCgmd = cgmd[cgmd.length - 1];
  const lastGmw = gmwV3[gmwV3.length - 1];
  let latest: ExtentResult["latest"] = null;
  if (lastCgmd) latest = { year: lastCgmd.year, ha: lastCgmd.ha, dataset: "cgmd" };
  else if (lastGmw) latest = { year: lastGmw.year, ha: lastGmw.ha, dataset: "gmw-v3" };
  return { gmwV3, cgmd, gmw10m2020Ha, latest };
}

export function consecutivePairs(years: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < years.length; i++) out.push([years[i - 1], years[i]]);
  return out;
}

export function shapeChange(
  raw: Raw | null,
  pairs: readonly [number, number][],
  overallPair: [number, number] | null,
  cgmd: YearValue[],
): ChangeResult {
  const step = (from: number, to: number): ChangeStep => {
    const gainHa = round(ha(raw?.[`gain_${from}_${to}`]));
    const lossHa = round(ha(raw?.[`loss_${from}_${to}`]));
    return { from, to, gainHa, lossHa, netHa: round(gainHa - lossHa) };
  };
  const gmwV3 = raw ? pairs.map(([a, b]) => step(a, b)) : [];
  const overall = raw && overallPair ? step(overallPair[0], overallPair[1]) : null;
  let cgmdNet: ChangeResult["cgmdNet"] = null;
  if (cgmd.length >= 2) {
    const first = cgmd[0];
    const last = cgmd[cgmd.length - 1];
    const netHa = round(last.ha - first.ha);
    cgmdNet = { from: first.year, to: last.year, netHa, pct: first.ha > 0 ? round((netHa / first.ha) * 100, 1) : null };
  }
  return { gmwV3, overall, cgmdNet };
}

export const HEIGHT_LABELS = ["0–5 m", "5–10 m", "10–15 m", "15–20 m", "20–25 m", "≥25 m"];

export function shapeStructure(
  tandemxRaw: Raw | null,
  simardRaw: Raw | null,
  socRaw: Raw | null,
  carbonFraction?: number,
): StructureResult {
  const summary = (tandemxRaw?.summary ?? {}) as Raw;
  const groups = ((tandemxRaw?.byClass as Raw | undefined)?.groups ?? []) as { cls?: number; sum?: number }[];
  const classes: HeightClass[] = HEIGHT_LABELS.map((label, i) => {
    const g = groups.find((x) => x.cls === i);
    return { label, ha: round(ha(g?.sum)) };
  });

  const s = (simardRaw ?? {}) as Raw;
  const pick = (d: unknown, k: string) => num((d as Raw | undefined)?.[k]);
  const agbMean = pick(s.mean, "agb");
  const agbTotal = pick(s.total, "agb_total");
  const agbArea = pick(s.area, "agb_area");

  let soc: StructureResult["soc"] = null;
  if (socRaw) {
    soc = { meanMgCHa: pick(socRaw.mean, "soc"), totalMgC: pick(socRaw.total, "soc_total") };
  }

  const r = (v: number | null, d = 2) => (v == null ? null : round(v, d));
  return {
    height2015: {
      meanM: r(num(summary.height_mean)),
      maxM: r(num(summary.height_max)),
      p50M: r(num(summary.height_p50)),
      p90M: r(num(summary.height_p90)),
      classes,
    },
    hmax2000MeanM: r(pick(s.hmaxMean, "hmax")),
    agb: { meanMgHa: r(agbMean), totalMg: r(agbTotal, 0), areaHa: agbArea == null ? null : round(agbArea / M2_PER_HA) },
    soc,
    carbon: carbonEstimate(agbTotal, soc?.totalMgC ?? null, carbonFraction),
  };
}

export function shapeCoastal(raw: Raw | null): CoastalResult {
  return {
    period: "1999–2019",
    mangroveLossHa: round(ha(raw?.mangrove_loss)),
    mangroveGainHa: round(ha(raw?.mangrove_gain)),
    otherTidalLossHa: round(ha(raw?.other_loss)),
    otherTidalGainHa: round(ha(raw?.other_gain)),
    tidalFlatHa: round(ha(raw?.tidal_flat)),
  };
}

export function shapeCondition(
  rawMonths: Raw[] | null,
  maskPixels: number | null,
  maskUsed: ConditionResult["maskUsed"],
): ConditionResult {
  const months: ConditionMonth[] = (rawMonths ?? []).map((m) => {
    const count = num(m.ndvi_count);
    const ndviV = num(m.ndvi_median);
    const mviV = num(m.mvi_median);
    return {
      month: String(m.month ?? ""),
      scenes: num(m.scenes) ?? 0,
      ndvi: ndviV == null ? null : round(ndviV, 3),
      mvi: mviV == null ? null : round(mviV, 2),
      clearFraction: count != null && maskPixels ? round(Math.min(1, count / maskPixels), 3) : null,
    };
  });

  // A month is "usable" when at least 20% of the mask had a clear look.
  const usable = (m: ConditionMonth) => m.ndvi != null && (m.clearFraction == null || m.clearFraction >= 0.2);
  const latest = [...months].reverse().find(usable) ?? null;

  let ndviYoY: number | null = null;
  const recent = months.slice(-3).filter(usable);
  const yearAgo = months.slice(-15, -12).filter(usable);
  if (recent.length && yearAgo.length) {
    const avg = (xs: ConditionMonth[]) => xs.reduce((a, m) => a + (m.ndvi ?? 0), 0) / xs.length;
    ndviYoY = round(avg(recent) - avg(yearAgo), 3);
  }
  return { maskUsed, months, latest, ndviYoY };
}

/** First day of the month `months` months before `now`, as YYYY-MM-01. */
export function seriesStart(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  return d.toISOString().slice(0, 10);
}
