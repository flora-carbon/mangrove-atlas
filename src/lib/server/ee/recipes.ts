/**
 * Earth Engine "recipes": pure functions that build EE images and reductions.
 *
 * These functions take the `ee` namespace as their first argument and use only
 * the Earth Engine API, so the same logic can be pasted into the Earth Engine
 * Code Editor for review (see scripts/ee/build-code-editor-script.mjs). Keep them
 * free of Node/Next imports.
 */
import type { EE, EEObject } from "./types";

export const ASSETS = {
  gmwV3Vector: (year: number) =>
    `projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/extent/gmw_v3_${year}_vec`,
  gmwV4_2020: "projects/sat-io/open-datasets/GMW/annual-extent/GMW_MNG_2020",
  cgmd: "projects/mangrovedatahub2/assets/CGMD-Extent30",
  tandemx: "projects/sat-io/open-datasets/GLOBAL_MANGROVE_HT_TANDEMX",
  simardAgb: "projects/sat-io/open-datasets/global_mangrove_distribution/agb",
  simardHmax: "projects/sat-io/open-datasets/global_mangrove_distribution/hmax95",
  murrayChange: "JCU/Murray/GIC/global_tidal_wetland_change/2019",
  murrayIntertidal: "UQ/murray/Intertidal/v1_1/global_intertidal",
  s2: "COPERNICUS/S2_SR_HARMONIZED",
  cloudScorePlus: "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
} as const;

/** Cloud Score+ threshold recommended by Google for "clear" pixels. */
export const CS_CDF_THRESHOLD = 0.6;
const HA = 10_000;

// ---------------------------------------------------------------------------
// Layers (images)
// ---------------------------------------------------------------------------

/** Binary mask (1 = mangrove) rasterised from a GMW v3 epoch. */
export function gmwV3Extent(ee: EE, year: number, region?: EEObject): EEObject {
  let fc = ee.FeatureCollection(ASSETS.gmwV3Vector(year));
  if (region) fc = fc.filterBounds(region);
  return ee.Image(0).byte().paint(fc, 1).selfMask().rename("mangrove");
}

/** Binary mask (1 = mangrove) from the CGMD annual vector extent. */
export function cgmdExtent(ee: EE, year: number, region?: EEObject): EEObject {
  let fc = ee.FeatureCollection(ASSETS.cgmd).filter(ee.Filter.eq("year", year));
  if (region) fc = fc.filterBounds(region);
  return ee.Image(0).byte().paint(fc, 1).selfMask().rename("mangrove");
}

/** Binary mask (1 = mangrove) from the GMW v4.0.19 10 m 2020 baseline. */
export function gmwV4_2020(ee: EE, region?: EEObject): EEObject {
  let ic = ee.ImageCollection(ASSETS.gmwV4_2020);
  if (region) ic = ic.filterBounds(region);
  return ic.mosaic().select(0).eq(1).selfMask().rename("mangrove");
}

/** Gain (value 1) and loss (value 2) between two GMW v3 epochs. */
export function gmwV3Change(ee: EE, from: number, to: number, region?: EEObject): EEObject {
  const a = gmwV3Extent(ee, from, region).unmask(0);
  const b = gmwV3Extent(ee, to, region).unmask(0);
  const gain = a.eq(0).and(b.eq(1));
  const loss = a.eq(1).and(b.eq(0));
  return ee.Image(0).where(gain, 1).where(loss, 2).selfMask().rename("change");
}

export function tandemxHeight(ee: EE, region?: EEObject): EEObject {
  let ic = ee.ImageCollection(ASSETS.tandemx);
  if (region) ic = ic.filterBounds(region);
  const h = ic.mosaic().select(0).rename("height");
  return h.updateMask(h.gt(0));
}

export function simardAgb(ee: EE, region?: EEObject): EEObject {
  let ic = ee.ImageCollection(ASSETS.simardAgb);
  if (region) ic = ic.filterBounds(region);
  const agb = ic.mosaic().select(0).rename("agb");
  return agb.updateMask(agb.gt(0));
}

export function simardHmax(ee: EE, region?: EEObject): EEObject {
  let ic = ee.ImageCollection(ASSETS.simardHmax);
  if (region) ic = ic.filterBounds(region);
  const h = ic.mosaic().select(0).rename("hmax");
  return h.updateMask(h.gt(0));
}

/** Soil organic carbon (Mg C/ha) from a user-supplied asset (Image or ImageCollection). */
export function soilCarbon(ee: EE, assetId: string, assetType: "Image" | "ImageCollection" = "Image"): EEObject {
  const img = assetType === "ImageCollection" ? ee.ImageCollection(assetId).mosaic() : ee.Image(assetId);
  const soc = img.select(0).rename("soc");
  return soc.updateMask(soc.gt(0));
}

/**
 * Tidal wetland change classes:
 * 1 = mangrove loss, 2 = mangrove gain, 3 = other tidal wetland loss, 4 = other tidal wetland gain.
 */
export function murrayTidalChange(ee: EE): EEObject {
  const img = ee.Image(ASSETS.murrayChange);
  const loss = img.select("loss").unmask(0).eq(1);
  const gain = img.select("gain").unmask(0).eq(1);
  const lossMangrove = loss.and(img.select("lossType").unmask(0).eq(3));
  const gainMangrove = gain.and(img.select("gainType").unmask(0).eq(3));
  return ee
    .Image(0)
    .where(loss, 3)
    .where(gain, 4)
    .where(lossMangrove, 1)
    .where(gainMangrove, 2)
    .selfMask()
    .rename("tidal_change");
}

/** Most recent tidal-flat map (2014–2016). */
export function murrayIntertidal(ee: EE): EEObject {
  const latest = ee.ImageCollection(ASSETS.murrayIntertidal).sort("system:time_start", false).first();
  return ee.Image(latest).select("classification").bitwiseAnd(1).eq(1).selfMask().rename("tidal_flat");
}

/** Sentinel-2 SR collection with Cloud Score+ masking applied. */
export function s2Clear(ee: EE, start: EEObject, end: EEObject, region?: EEObject): EEObject {
  let s2 = ee.ImageCollection(ASSETS.s2).filterDate(start, end);
  if (region) s2 = s2.filterBounds(region);
  return s2
    .linkCollection(ee.ImageCollection(ASSETS.cloudScorePlus), ["cs_cdf"])
    .map((img: EEObject) => img.updateMask(img.select("cs_cdf").gte(CS_CDF_THRESHOLD)));
}

export function ndvi(img: EEObject): EEObject {
  return img.normalizedDifference(["B8", "B4"]).rename("ndvi");
}

/** Mangrove Vegetation Index, Baloloy et al. (2020): (NIR − Green) / (SWIR1 − Green). */
export function mvi(img: EEObject): EEObject {
  return img
    .expression("(NIR - G) / (SWIR - G)", { NIR: img.select("B8"), G: img.select("B3"), SWIR: img.select("B11") })
    .rename("mvi");
}

// ---------------------------------------------------------------------------
// Statistics (return ee.Dictionary objects; evaluate on the server)
// ---------------------------------------------------------------------------

const reduceOpts = (geometry: EEObject, scale: number) => ({
  geometry,
  scale,
  maxPixels: 1e11,
  tileScale: 4,
});

/** Mangrove area (m²) per epoch for GMW v3. Keys: y1996, y2007, … */
export function gmwV3AreaByYear(ee: EE, aoi: EEObject, years: readonly number[]): EEObject {
  const bands = years.map((y) => ee.Image.pixelArea().updateMask(gmwV3Extent(ee, y, aoi)).rename(`y${y}`));
  return ee.Image.cat(bands).reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 25) });
}

/** Mangrove area (m²) per year for CGMD. Keys: y1984 … y2023 */
export function cgmdAreaByYear(ee: EE, aoi: EEObject, years: readonly number[]): EEObject {
  const bands = years.map((y) => ee.Image.pixelArea().updateMask(cgmdExtent(ee, y, aoi)).rename(`y${y}`));
  return ee.Image.cat(bands).reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 30) });
}

/** Mangrove area (m²) in the 10 m 2020 map. Key: area */
export function gmwV4AreaM2(ee: EE, aoi: EEObject, scale = 10): EEObject {
  return ee.Image.pixelArea()
    .updateMask(gmwV4_2020(ee, aoi))
    .rename("area")
    .reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, scale) });
}

/** Gain/loss area (m²) between consecutive GMW v3 epochs. Keys: gain_1996_2007, loss_1996_2007, … */
export function gmwV3ChangeAreas(ee: EE, aoi: EEObject, pairs: readonly [number, number][]): EEObject {
  const bands: EEObject[] = [];
  for (const [from, to] of pairs) {
    const c = gmwV3Change(ee, from, to, aoi);
    bands.push(ee.Image.pixelArea().updateMask(c.eq(1)).rename(`gain_${from}_${to}`));
    bands.push(ee.Image.pixelArea().updateMask(c.eq(2)).rename(`loss_${from}_${to}`));
  }
  return ee.Image.cat(bands).reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 25) });
}

export const HEIGHT_CLASS_EDGES = [0, 5, 10, 15, 20, 25] as const;

/** TanDEM-X height: mean, max and area (m²) per 5 m class. */
export function tandemxStats(ee: EE, aoi: EEObject): EEObject {
  const h = tandemxHeight(ee, aoi);
  const cls = h.divide(5).floor().min(HEIGHT_CLASS_EDGES.length - 1).int().rename("cls");
  const byClass = ee.Image.pixelArea()
    .updateMask(h.mask())
    .addBands(cls)
    .reduceRegion({ reducer: ee.Reducer.sum().group(1, "cls"), ...reduceOpts(aoi, 12) });
  const summary = h.reduceRegion({
    reducer: ee.Reducer.mean().combine(ee.Reducer.max(), "", true).combine(ee.Reducer.percentile([50, 90]), "", true),
    ...reduceOpts(aoi, 12),
  });
  return ee.Dictionary({ byClass, summary });
}

/** Simard AGB (Mg/ha) mean, total (Mg) and Hmax mean (m). */
export function simardStats(ee: EE, aoi: EEObject): EEObject {
  const agb = simardAgb(ee, aoi);
  const hmax = simardHmax(ee, aoi);
  const mean = agb.reduceRegion({ reducer: ee.Reducer.mean(), ...reduceOpts(aoi, 30) });
  const total = agb
    .multiply(ee.Image.pixelArea())
    .divide(HA)
    .rename("agb_total")
    .reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 30) });
  const area = ee.Image.pixelArea()
    .updateMask(agb.mask())
    .rename("agb_area")
    .reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 30) });
  const hmaxMean = hmax.reduceRegion({ reducer: ee.Reducer.mean(), ...reduceOpts(aoi, 30) });
  return ee.Dictionary({ mean, total, area, hmaxMean });
}

/** Soil organic carbon: mean (Mg C/ha) and total (Mg C). */
export function socStats(ee: EE, aoi: EEObject, soc: EEObject): EEObject {
  const mean = soc.reduceRegion({ reducer: ee.Reducer.mean(), ...reduceOpts(aoi, 30) });
  const total = soc
    .multiply(ee.Image.pixelArea())
    .divide(HA)
    .rename("soc_total")
    .reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 30) });
  return ee.Dictionary({ mean, total });
}

/** Tidal wetland change areas (m²) by class and tidal-flat area (m²). */
export function coastalStats(ee: EE, aoi: EEObject): EEObject {
  const tc = murrayTidalChange(ee);
  const change = ee.Image.cat([
    ee.Image.pixelArea().updateMask(tc.eq(1)).rename("mangrove_loss"),
    ee.Image.pixelArea().updateMask(tc.eq(2)).rename("mangrove_gain"),
    ee.Image.pixelArea().updateMask(tc.eq(3)).rename("other_loss"),
    ee.Image.pixelArea().updateMask(tc.eq(4)).rename("other_gain"),
    ee.Image.pixelArea().updateMask(murrayIntertidal(ee)).rename("tidal_flat"),
  ]).reduceRegion({ reducer: ee.Reducer.sum(), ...reduceOpts(aoi, 30) });
  return change;
}

/** Number of 20 m pixels inside the 10 m GMW 2020 mangrove mask. Key: mangrove */
export function maskPixelCount(ee: EE, aoi: EEObject): EEObject {
  return gmwV4_2020(ee, aoi).reduceRegion({ reducer: ee.Reducer.count(), ...reduceOpts(aoi, 20) });
}

/**
 * Monthly Sentinel-2 condition series. Returns an ee.List of dictionaries with
 * month, scenes, ndvi_median, mvi_median, ndvi_count (clear pixels).
 * `useMangroveMask` restricts statistics to the GMW 2020 mangrove mask.
 */
export function conditionSeries(
  ee: EE,
  aoi: EEObject,
  startIso: string,
  months: number,
  useMangroveMask: boolean,
): EEObject {
  const start = ee.Date(startIso);
  const end = start.advance(months, "month");
  const col = s2Clear(ee, start, end, aoi);
  const mask = useMangroveMask ? gmwV4_2020(ee, aoi) : ee.Image(1).clip(aoi);
  const reducer = ee.Reducer.median().combine(ee.Reducer.count(), "", true);

  return ee.List.sequence(0, months - 1).map((m: EEObject) => {
    const s = start.advance(m, "month");
    const e = s.advance(1, "month");
    const monthly = col.filterDate(s, e);
    const n = monthly.size();
    const base = ee.Dictionary({ month: s.format("YYYY-MM"), scenes: n });
    return ee.Algorithms.If(
      n.gt(0),
      base.combine(
        (() => {
          const med = monthly.median();
          return ndvi(med)
            .addBands(mvi(med))
            .updateMask(mask)
            .reduceRegion({ reducer, ...reduceOpts(aoi, 20) });
        })(),
      ),
      base,
    );
  });
}
