import area from "@turf/area";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";

export type AoiGeometry = Polygon | MultiPolygon;

export interface Aoi {
  geometry: MultiPolygon;
  areaHa: number;
  bbox: [number, number, number, number];
  vertices: number;
}

export class AoiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AoiError";
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function cleanRing(ring: unknown): Position[] {
  if (!Array.isArray(ring)) throw new AoiError("Polygon ring must be an array of coordinates");
  const out: Position[] = [];
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) {
      throw new AoiError("Coordinates must be [longitude, latitude] numbers");
    }
    const [lon, lat] = p as number[];
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new AoiError("Coordinates must be WGS84 longitude/latitude (EPSG:4326)");
    }
    // Round to ~1 cm to keep payloads small and cache keys stable.
    const q: Position = [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== q[0] || prev[1] !== q[1]) out.push(q);
  }
  if (out.length < 3) throw new AoiError("A polygon ring needs at least 3 distinct points");
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  if (out.length < 4) throw new AoiError("A polygon ring needs at least 3 distinct points");
  return out;
}

function collectPolygons(g: Geometry | null | undefined, acc: Position[][][]) {
  if (!g) return;
  switch (g.type) {
    case "Polygon":
      acc.push(g.coordinates.map(cleanRing));
      break;
    case "MultiPolygon":
      for (const poly of g.coordinates) acc.push(poly.map(cleanRing));
      break;
    case "GeometryCollection":
      for (const child of g.geometries) collectPolygons(child, acc);
      break;
    default:
      // Points and lines carry no area; ignore them silently.
      break;
  }
}

/**
 * Normalise any GeoJSON input (Geometry, Feature or FeatureCollection) into a
 * single MultiPolygon, validating coordinates and enforcing size limits.
 */
export function normaliseAoi(
  input: unknown,
  limits: { maxAreaHa: number; maxVertices: number },
): Aoi {
  if (!input || typeof input !== "object") throw new AoiError("Expected a GeoJSON object");
  const obj = input as { type?: string };
  const polys: Position[][][] = [];

  if (obj.type === "FeatureCollection") {
    for (const f of (input as FeatureCollection).features ?? []) collectPolygons(f?.geometry, polys);
  } else if (obj.type === "Feature") {
    collectPolygons((input as Feature).geometry, polys);
  } else if (typeof obj.type === "string") {
    collectPolygons(input as Geometry, polys);
  } else {
    throw new AoiError("Expected a GeoJSON object");
  }

  if (polys.length === 0) throw new AoiError("No polygon found — draw or upload an area (points and lines have no area)");

  const geometry: MultiPolygon = { type: "MultiPolygon", coordinates: polys };
  const vertices = polys.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
  if (vertices > limits.maxVertices) {
    throw new AoiError(
      `The area has ${vertices.toLocaleString("en")} vertices; the limit is ${limits.maxVertices.toLocaleString("en")}. Simplify it first.`,
    );
  }
  const areaHa = area(geometry) / 10_000;
  if (!(areaHa > 0)) throw new AoiError("The area is empty");
  if (areaHa > limits.maxAreaHa) {
    throw new AoiError(
      `The area is ${Math.round(areaHa).toLocaleString("en")} ha; the public limit is ${limits.maxAreaHa.toLocaleString("en")} ha. Split it or self-host with a higher limit.`,
    );
  }
  const b = bbox(geometry) as [number, number, number, number];
  return { geometry, areaHa, bbox: b, vertices };
}

/** Stable string for caching (coordinates are already rounded). */
export function aoiKey(aoi: Aoi): string {
  return JSON.stringify(aoi.geometry.coordinates);
}
