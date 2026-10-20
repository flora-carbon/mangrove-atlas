import { afterEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigForTests } from "@/lib/server/config";
import { RateLimiter, TtlCache } from "@/lib/server/rateLimit";
import { buildReport, reportToCsv } from "@/lib/export";

afterEach(() => {
  delete process.env.GEE_SERVICE_ACCOUNT_KEY;
  delete process.env.GEE_PROJECT;
  resetConfigForTests();
});

describe("config", () => {
  it("reports why Earth Engine is not configured", () => {
    expect(getConfig().gee).toBeNull();
    expect(getConfig().geeError).toMatch(/GEE_SERVICE_ACCOUNT_KEY/);
  });
  it("accepts base64 keys and takes the project from the key", () => {
    const key = { client_email: "sa@proj.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----x", project_id: "proj" };
    process.env.GEE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify(key)).toString("base64");
    expect(getConfig().gee?.project).toBe("proj");
  });
  it("rejects malformed keys", () => {
    process.env.GEE_SERVICE_ACCOUNT_KEY = "{not json";
    expect(getConfig().geeError).toMatch(/valid JSON/);
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.check("a", 1, 0).ok).toBe(true);
    expect(rl.check("a", 2, 10).ok).toBe(true);
    expect(rl.check("a", 1, 20).ok).toBe(false);
    expect(rl.check("b", 1, 20).ok).toBe(true);
    expect(rl.check("a", 1, 1500).ok).toBe(true);
  });
});

describe("TtlCache", () => {
  it("evicts least recently used entries", () => {
    const c = new TtlCache<number>(2, 60_000);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
  });
});

describe("export", () => {
  it("builds a report with sources and a CSV", () => {
    const geometry = { type: "MultiPolygon" as const, coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] };
    const r = buildReport("Test, \"site\"", geometry, {
      coastal: {
        schemaVersion: "1.0", module: "coastal", engine: "gee", generatedAt: "", aoi: { areaHa: 5, bbox: [0, 0, 1, 1] },
        datasets: ["murray-tidal-change"], warnings: [], partial: false, cached: false,
        result: { period: "1999–2019", mangroveLossHa: 1, mangroveGainHa: 2, otherTidalLossHa: 0, otherTidalGainHa: 0, tidalFlatHa: 3 },
      },
    });
    expect(r.sources[0].licence).toBe("CC BY 4.0");
    expect(r.aoi.properties.areaHa).toBe(5);
    const csv = reportToCsv(r).split("\n");
    expect(csv[0]).toBe("module,metric,dataset,period,value,unit");
    expect(csv).toContain("coastal,mangrove_gain,murray-tidal-change,1999–2019,2,ha");
  });
});
