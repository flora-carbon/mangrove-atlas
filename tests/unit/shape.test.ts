import { describe, expect, it } from "vitest";
import { carbonEstimate, CO2_PER_C } from "@/lib/analysis/carbon";
import {
  consecutivePairs,
  seriesStart,
  shapeChange,
  shapeCoastal,
  shapeCondition,
  shapeExtent,
  shapeStructure,
} from "@/lib/analysis/shape";

describe("shapeExtent", () => {
  it("converts m² to ha and picks the latest CGMD year", () => {
    const r = shapeExtent({ y2010: 2e6, y2020: 3e6 }, { y1984: 1e6, y2023: 4e6 }, { area: 3.5e6 }, [2010, 2020], [1984, 2023]);
    expect(r.gmwV3).toEqual([{ year: 2010, ha: 200 }, { year: 2020, ha: 300 }]);
    expect(r.cgmd[1]).toEqual({ year: 2023, ha: 400 });
    expect(r.gmw10m2020Ha).toBe(350);
    expect(r.latest).toEqual({ year: 2023, ha: 400, dataset: "cgmd" });
  });
  it("treats missing keys (no mangroves) as zero and failed datasets as empty", () => {
    const r = shapeExtent({}, null, null, [1996], [1984]);
    expect(r.gmwV3).toEqual([{ year: 1996, ha: 0 }]);
    expect(r.cgmd).toEqual([]);
    expect(r.gmw10m2020Ha).toBeNull();
    expect(r.latest).toEqual({ year: 1996, ha: 0, dataset: "gmw-v3" });
  });
});

describe("shapeChange", () => {
  it("computes net change per step and CGMD percentage", () => {
    const pairs = consecutivePairs([1996, 2007, 2010]);
    expect(pairs).toEqual([[1996, 2007], [2007, 2010]]);
    const raw = { gain_1996_2007: 1e4, loss_1996_2007: 3e4, gain_2007_2010: 5e4, loss_2007_2010: 0, gain_1996_2010: 6e4, loss_1996_2010: 3e4 };
    const r = shapeChange(raw, pairs, [1996, 2010], [{ year: 1984, ha: 100 }, { year: 2023, ha: 90 }]);
    expect(r.gmwV3[0]).toEqual({ from: 1996, to: 2007, gainHa: 1, lossHa: 3, netHa: -2 });
    expect(r.overall?.netHa).toBe(3);
    expect(r.cgmdNet).toEqual({ from: 1984, to: 2023, netHa: -10, pct: -10 });
  });
});

describe("shapeStructure + carbon", () => {
  it("reads EE reducer keys and computes carbon", () => {
    const tdx = {
      summary: { height_mean: 7.123, height_max: 22, height_p50: 6, height_p90: 12 },
      byClass: { groups: [{ cls: 0, sum: 1e6 }, { cls: 2, sum: 5e5 }] },
    };
    const simard = { mean: { agb: 80 }, total: { agb_total: 10_000 }, area: { agb_area: 1.25e6 }, hmaxMean: { hmax: 9.5 } };
    const r = shapeStructure(tdx, simard, null, 0.47);
    expect(r.height2015.meanM).toBe(7.12);
    expect(r.height2015.classes[0].ha).toBe(100);
    expect(r.height2015.classes[2].ha).toBe(50);
    expect(r.height2015.classes[5].ha).toBe(0);
    expect(r.agb).toEqual({ meanMgHa: 80, totalMg: 10_000, areaHa: 125 });
    expect(r.carbon.agcMg).toBeCloseTo(4700);
    expect(r.carbon.agcCo2eMg).toBeCloseTo(4700 * CO2_PER_C);
    expect(r.carbon.totalCo2eMg).toBeCloseTo(4700 * CO2_PER_C);
    expect(r.soc).toBeNull();
  });
  it("adds soil carbon when present and handles nulls", () => {
    const c = carbonEstimate(1000, 2000, 0.451);
    expect(c.totalCo2eMg).toBeCloseTo((451 + 2000) * CO2_PER_C);
    expect(carbonEstimate(null, null).totalCo2eMg).toBeNull();
  });
});

describe("shapeCoastal", () => {
  it("maps classes to hectares", () => {
    expect(shapeCoastal({ mangrove_loss: 2e4, tidal_flat: 1e5 })).toMatchObject({ mangroveLossHa: 2, mangroveGainHa: 0, tidalFlatHa: 10 });
  });
});

describe("shapeCondition", () => {
  const months = Array.from({ length: 24 }, (_, i) => ({
    month: `m${i}`,
    scenes: i === 23 ? 0 : 3,
    ...(i === 23 ? {} : { ndvi_median: i >= 20 ? 0.7 : 0.8, mvi_median: 6, ndvi_count: 50 }),
  }));
  it("finds the latest usable month, clear fraction and YoY change", () => {
    const r = shapeCondition(months, 100, "gmw-10m-2020");
    expect(r.latest?.month).toBe("m22");
    expect(r.months[0].clearFraction).toBe(0.5);
    expect(r.months[23].ndvi).toBeNull();
    // latest 3 → only m21, m22 usable (0.7); a year earlier m9..m11 (0.8)
    expect(r.ndviYoY).toBeCloseTo(-0.1);
  });
  it("skips months with too little clear view", () => {
    const r = shapeCondition([{ month: "a", scenes: 1, ndvi_median: 0.5, ndvi_count: 1 }], 100, "aoi");
    expect(r.latest).toBeNull();
  });
});

describe("seriesStart", () => {
  it("returns the first day of the month N-1 months back", () => {
    expect(seriesStart(new Date("2026-10-19T00:00:00Z"), 24)).toBe("2024-11-01");
  });
});
