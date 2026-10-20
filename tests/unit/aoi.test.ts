import { describe, expect, it } from "vitest";
import { AoiError, aoiKey, normaliseAoi } from "@/lib/geo/aoi";

const limits = { maxAreaHa: 250_000, maxVertices: 20_000 };
// ~1 km × 1 km square near the Sundarbans
const square = {
  type: "Polygon",
  coordinates: [[[88.8, 21.9], [88.80967, 21.9], [88.80967, 21.909], [88.8, 21.909], [88.8, 21.9]]],
};

describe("normaliseAoi", () => {
  it("accepts a polygon and reports a plausible area", () => {
    const a = normaliseAoi(square, limits);
    expect(a.geometry.type).toBe("MultiPolygon");
    expect(a.areaHa).toBeGreaterThan(90);
    expect(a.areaHa).toBeLessThan(110);
    expect(a.bbox[0]).toBeCloseTo(88.8);
  });

  it("closes open rings and drops duplicate points", () => {
    const open = { type: "Polygon", coordinates: [[[88.8, 21.9], [88.8, 21.9], [88.81, 21.9], [88.81, 21.91], [88.8, 21.91]]] };
    const a = normaliseAoi(open, limits);
    const ring = a.geometry.coordinates[0][0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(5);
  });

  it("merges features from a FeatureCollection and ignores points", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: square },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [88, 22] } },
        { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [square.coordinates] } },
      ],
    };
    expect(normaliseAoi(fc, limits).geometry.coordinates).toHaveLength(2);
  });

  it("rejects non-polygons, bad coordinates and oversize areas", () => {
    expect(() => normaliseAoi({ type: "Point", coordinates: [88, 22] }, limits)).toThrow(AoiError);
    expect(() => normaliseAoi({ type: "Polygon", coordinates: [[[200, 0], [201, 0], [201, 1], [200, 0]]] }, limits)).toThrow(/WGS84/);
    expect(() => normaliseAoi(square, { ...limits, maxAreaHa: 10 })).toThrow(/limit/);
    expect(() => normaliseAoi(square, { ...limits, maxVertices: 3 })).toThrow(/vertices/);
    expect(() => normaliseAoi("nope", limits)).toThrow(AoiError);
  });

  it("produces stable cache keys", () => {
    expect(aoiKey(normaliseAoi(square, limits))).toBe(aoiKey(normaliseAoi({ type: "Feature", properties: {}, geometry: square }, limits)));
  });
});
