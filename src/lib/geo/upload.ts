import type { Feature, FeatureCollection } from "geojson";

export const ACCEPTED_UPLOADS = ".geojson,.json,.kml,.kmz,.zip";

export class UploadError extends Error {}

function asFeatureCollection(input: unknown): FeatureCollection {
  const o = input as { type?: string };
  if (o?.type === "FeatureCollection") return input as FeatureCollection;
  if (o?.type === "Feature") return { type: "FeatureCollection", features: [input as Feature] };
  if (o?.type && "coordinates" in (input as object)) {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: input as Feature["geometry"] }] };
  }
  throw new UploadError("The file is not valid GeoJSON");
}

async function parseKmlText(text: string): Promise<FeatureCollection> {
  const { kml } = await import("@tmcw/togeojson");
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new UploadError("The KML file could not be read");
  return kml(doc) as FeatureCollection;
}

/**
 * Parse an uploaded boundary file in the browser. Nothing is uploaded to a
 * server until the user runs an analysis.
 */
export async function parseBoundaryFile(file: File): Promise<FeatureCollection> {
  const name = file.name.toLowerCase();
  if (file.size > 20 * 1024 * 1024) throw new UploadError("Files larger than 20 MB are not supported");

  if (name.endsWith(".geojson") || name.endsWith(".json")) {
    try {
      return asFeatureCollection(JSON.parse(await file.text()));
    } catch (e) {
      if (e instanceof UploadError) throw e;
      throw new UploadError("The file is not valid JSON");
    }
  }
  if (name.endsWith(".kml")) return parseKmlText(await file.text());
  if (name.endsWith(".kmz")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kmlEntry = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    if (!kmlEntry) throw new UploadError("No .kml file found inside the KMZ");
    return parseKmlText(await kmlEntry.async("text"));
  }
  if (name.endsWith(".zip")) {
    const shp = (await import("shpjs")).default;
    try {
      const out = await shp(await file.arrayBuffer());
      const list = Array.isArray(out) ? out : [out];
      return { type: "FeatureCollection", features: list.flatMap((fc) => fc.features) };
    } catch {
      throw new UploadError("Could not read the zipped shapefile (needs .shp, .shx, .dbf and ideally .prj)");
    }
  }
  throw new UploadError("Unsupported file type — use GeoJSON, KML, KMZ or a zipped shapefile");
}
