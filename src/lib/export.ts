import type { MultiPolygon } from "geojson";
import { DATASETS, citationFor, type DatasetId } from "./datasets";
import type { ModuleId, ModuleResponse } from "./analysis/types";

export type Results = { [M in ModuleId]?: ModuleResponse<M> };

export interface Report {
  tool: string;
  version: string;
  generatedAt: string;
  disclaimer: string;
  aoi: { type: "Feature"; properties: { areaHa: number | null; name: string }; geometry: MultiPolygon };
  modules: Results;
  sources: { id: DatasetId; name: string; version: string; licence: string; citation: string }[];
}

export const DISCLAIMER =
  "Screening-grade estimates from global open datasets. Not a substitute for field measurement, and not sufficient on its own for carbon-credit issuance under Verra VCS or Gold Standard.";

export function buildReport(name: string, geometry: MultiPolygon, results: Results): Report {
  const ids = new Set<DatasetId>();
  Object.values(results).forEach((r) => r?.datasets.forEach((d) => ids.add(d)));
  const areaHa = Object.values(results).find(Boolean)?.aoi.areaHa ?? null;
  return {
    tool: "Flora Mangrove Atlas",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    aoi: { type: "Feature", properties: { areaHa, name }, geometry },
    modules: results,
    sources: [...ids].map((id) => ({
      id,
      name: DATASETS[id].name,
      version: DATASETS[id].version,
      licence: DATASETS[id].licence,
      citation: citationFor(id),
    })),
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Flatten results into long-format rows: module, metric, dataset, year/period, value, unit. */
export function reportToCsv(r: Report): string {
  const rows: (string | number | null)[][] = [["module", "metric", "dataset", "period", "value", "unit"]];
  const m = r.modules;
  m.extent?.result.gmwV3.forEach((y) => rows.push(["extent", "mangrove_area", "gmw-v3", y.year, y.ha, "ha"]));
  m.extent?.result.cgmd.forEach((y) => rows.push(["extent", "mangrove_area", "cgmd", y.year, y.ha, "ha"]));
  if (m.extent?.result.gmw10m2020Ha != null)
    rows.push(["extent", "mangrove_area", "gmw-v4-2020", 2020, m.extent.result.gmw10m2020Ha, "ha"]);
  m.change?.result.gmwV3.forEach((s) => {
    rows.push(["change", "gain", "gmw-v3", `${s.from}-${s.to}`, s.gainHa, "ha"]);
    rows.push(["change", "loss", "gmw-v3", `${s.from}-${s.to}`, s.lossHa, "ha"]);
    rows.push(["change", "net", "gmw-v3", `${s.from}-${s.to}`, s.netHa, "ha"]);
  });
  const st = m.structure?.result;
  if (st) {
    rows.push(["structure", "canopy_height_mean", "tandemx-height", 2015, st.height2015.meanM, "m"]);
    rows.push(["structure", "canopy_height_p90", "tandemx-height", 2015, st.height2015.p90M, "m"]);
    st.height2015.classes.forEach((c) => rows.push(["structure", `height_class_${c.label}`, "tandemx-height", 2015, c.ha, "ha"]));
    rows.push(["structure", "hmax_mean", "simard-hmax", 2000, st.hmax2000MeanM, "m"]);
    rows.push(["structure", "agb_mean", "simard-agb", 2000, st.agb.meanMgHa, "Mg/ha"]);
    rows.push(["structure", "agb_total", "simard-agb", 2000, st.agb.totalMg, "Mg"]);
    rows.push(["structure", "agc_co2e_total", "simard-agb", 2000, st.carbon.agcCo2eMg, "Mg CO2e"]);
    if (st.soc) rows.push(["structure", "soc_total", "soil-carbon", 2000, st.soc.totalMgC, "Mg C"]);
  }
  const c = m.coastal?.result;
  if (c) {
    rows.push(["coastal", "mangrove_loss", "murray-tidal-change", c.period, c.mangroveLossHa, "ha"]);
    rows.push(["coastal", "mangrove_gain", "murray-tidal-change", c.period, c.mangroveGainHa, "ha"]);
    rows.push(["coastal", "tidal_flat", "murray-intertidal", "2014-2016", c.tidalFlatHa, "ha"]);
  }
  m.condition?.result.months.forEach((mo) => {
    rows.push(["condition", "ndvi_median", "sentinel-2", mo.month, mo.ndvi, "index"]);
    rows.push(["condition", "mvi_median", "sentinel-2", mo.month, mo.mvi, "index"]);
    rows.push(["condition", "clear_fraction", "sentinel-2", mo.month, mo.clearFraction, "fraction"]);
  });
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
