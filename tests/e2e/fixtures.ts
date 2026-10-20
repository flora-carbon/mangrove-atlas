/* Synthetic API responses used to exercise the UI without Earth Engine credentials.
 * Values are made up and only need to be plausible in shape. */
import { deflateSync } from "node:zlib";

const base = (module: string, datasets: string[], result: unknown) => ({
  schemaVersion: "1.0",
  module,
  engine: "gee",
  generatedAt: "2026-10-19T00:00:00.000Z",
  aoi: { areaHa: 14000, bbox: [88.75, 21.95, 88.88, 22.05] },
  datasets,
  result,
  warnings: module === "structure" ? ["Soil carbon is not configured on this server (GEE_SOC_ASSET), so totals exclude soil carbon."] : [],
  partial: false,
  cached: false,
});

const gmwYears = [1996, 2007, 2008, 2009, 2010, 2015, 2016, 2017, 2018, 2019, 2020];
const cgmdYears = Array.from({ length: 40 }, (_, i) => 1984 + i);

export const FIXTURES: Record<string, unknown> = {
  extent: base("extent", ["gmw-v3", "cgmd", "gmw-v4-2020"], {
    gmwV3: gmwYears.map((year, i) => ({ year, ha: 11700 - i * 12 })),
    cgmd: cgmdYears.map((year, i) => ({ year, ha: 11900 - i * 9 + (i % 5) * 6 })),
    gmw10m2020Ha: 11848.5,
    latest: { year: 2023, ha: 11555, dataset: "cgmd" },
  }),
  change: base("change", ["gmw-v3", "cgmd"], {
    gmwV3: gmwYears.slice(1).map((to, i) => ({ from: gmwYears[i], to, gainHa: 20 + i * 3, lossHa: 35 + (i % 3) * 10, netHa: 20 + i * 3 - (35 + (i % 3) * 10) })),
    overall: { from: 1996, to: 2020, gainHa: 310, lossHa: 430, netHa: -120 },
    cgmdNet: { from: 1984, to: 2023, netHa: -345, pct: -2.9 },
  }),
  structure: base("structure", ["tandemx-height", "simard-agb", "simard-hmax"], {
    height2015: {
      meanM: 6.7,
      maxM: 21.4,
      p50M: 6.2,
      p90M: 10.9,
      classes: [
        { label: "0–5 m", ha: 3580 },
        { label: "5–10 m", ha: 7056 },
        { label: "10–15 m", ha: 1483 },
        { label: "15–20 m", ha: 140 },
        { label: "20–25 m", ha: 6 },
        { label: "≥25 m", ha: 0 },
      ],
    },
    hmax2000MeanM: 8.1,
    agb: { meanMgHa: 39, totalMg: 4751882, areaHa: 12195 },
    soc: null,
    carbon: {
      agcMg: 2233384,
      agcCo2eMg: 8189075,
      socMg: null,
      socCo2eMg: null,
      totalCo2eMg: 8189075,
      factors: { carbonFraction: 0.47, co2PerC: 3.667, carbonFractionSource: "0.47 — IPCC 2006 default (AFOLU Vol. 4, Table 4.3)" },
    },
  }),
  coastal: base("coastal", ["murray-tidal-change", "murray-intertidal"], {
    period: "1999–2019",
    mangroveLossHa: 212.4,
    mangroveGainHa: 98.1,
    otherTidalLossHa: 64,
    otherTidalGainHa: 120.5,
    tidalFlatHa: 830,
  }),
  condition: base("condition", ["sentinel-2", "gmw-v4-2020"], {
    maskUsed: "gmw-10m-2020",
    months: Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 10 + i, 1));
      const m = d.getUTCMonth();
      const monsoon = m >= 5 && m <= 8;
      return {
        month: d.toISOString().slice(0, 7),
        scenes: monsoon ? 1 : 5,
        ndvi: monsoon && i % 2 ? null : Math.round((0.72 + 0.06 * Math.sin(i / 2)) * 1000) / 1000,
        mvi: monsoon && i % 2 ? null : Math.round((6 + Math.cos(i / 3)) * 100) / 100,
        clearFraction: monsoon ? 0.1 : 0.85,
      };
    }),
    latest: { month: "2026-10", scenes: 5, ndvi: 0.75, mvi: 6.4, clearFraction: 0.85 },
    ndviYoY: -0.02,
  }),
};

// --- a tiny solid-colour PNG generator for mocked map tiles -----------------
function crc32(buf: Buffer) {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function solidPng(r: number, g: number, b: number, a = 255, size = 256): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + size * 4);
  for (let x = 0; x < size; x++) row.set([r, g, b, a], 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
