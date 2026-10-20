import { describe, expect, it } from "vitest";
import { decodeLayers, encodeLayers, readUrlState, writeUrlState } from "@/lib/urlState";

describe("url state", () => {
  it("round-trips layers, basemap and view", () => {
    const s = readUrlState("?layers=cgmd-extent~2001~50~1,gmw-v3-change~2007-2020~100~0&basemap=streets&view=88.1,21.9,9");
    expect(s.layers).toEqual([
      { id: "cgmd-extent", visible: true, opacity: 0.5, year: 2001 },
      { id: "gmw-v3-change", visible: false, opacity: 1, from: 2007, to: 2020 },
    ]);
    expect(s.basemap).toBe("streets");
    expect(readUrlState(writeUrlState(s))).toEqual(s);
  });
  it("drops unknown layers, invalid years and duplicates", () => {
    const l = decodeLayers("bogus~1~1~1,cgmd-extent~1900~80~1,cgmd-extent~2000~80~1,gmw-v3-change~2020-1996~100~1");
    expect(l).toHaveLength(2);
    expect(l?.[0].year).toBe(2023);
    expect(l?.[1]).toMatchObject({ from: 1996, to: 2020 });
    expect(encodeLayers(l!)).toContain("cgmd-extent~2023~80~1");
  });
  it("falls back to defaults for bad input", () => {
    const s = readUrlState("?view=abc&basemap=nope");
    expect(s.basemap).toBe("satellite");
    expect(s.view.zoom).toBeGreaterThan(0);
  });
});
