/**
 * Dataset registry — the single source of truth for every layer and every
 * number the Atlas shows. Each entry carries its provenance (producer,
 * version, citation, DOI, licence) so the UI, the Methods page, exports and
 * the API can always say exactly where a value came from.
 *
 * Asset IDs were checked against the Google Earth Engine Data Catalog and the
 * awesome-gee-community-catalog (gee-community-catalog.org) in October 2026.
 */

export type DatasetId =
  | "gmw-v3"
  | "gmw-v4-2020"
  | "cgmd"
  | "tandemx-height"
  | "simard-agb"
  | "simard-hmax"
  | "murray-tidal-change"
  | "murray-intertidal"
  | "sentinel-2"
  | "soil-carbon";

export interface Dataset {
  id: DatasetId;
  name: string;
  shortName: string;
  producer: string;
  version: string;
  /** Years covered (inclusive) — informational. */
  period: string;
  resolution: string;
  sensor: string;
  licence: string;
  licenceUrl: string;
  citation: string;
  doi?: string;
  url: string;
  /** Earth Engine asset(s) used. */
  eeAssets: string[];
  notes?: string;
  /** When false the dataset must be enabled with an env variable. */
  enabledByDefault: boolean;
}

export const DATASETS: Record<DatasetId, Dataset> = {
  "gmw-v3": {
    id: "gmw-v3",
    name: "Global Mangrove Watch v3.0 extent",
    shortName: "GMW v3",
    producer: "Aberystwyth University, soloEO, JAXA, Wetlands International, TNC",
    version: "3.0",
    period: "1996, 2007–2010, 2015–2020 (11 epochs)",
    resolution: "≈25 m",
    sensor: "JAXA L-band SAR (JERS-1, ALOS PALSAR, ALOS-2 PALSAR-2) + Landsat",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    citation:
      "Bunting, P. et al. (2022). Global Mangrove Extent Change 1996–2020: Global Mangrove Watch Version 3.0. Remote Sensing 14(15), 3657.",
    doi: "10.3390/rs14153657",
    url: "https://zenodo.org/record/6894273",
    eeAssets: [
      "projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/extent/gmw_v3_{year}_vec",
    ],
    notes: "Reported overall accuracy 87.4%. Vector extents are rasterised at 25 m for area statistics.",
    enabledByDefault: true,
  },
  "gmw-v4-2020": {
    id: "gmw-v4-2020",
    name: "Global Mangrove Watch v4.0.19 — 10 m extent 2020",
    shortName: "GMW 10 m 2020",
    producer: "Aberystwyth University, soloEO, Wetlands International, TNC",
    version: "4.0.19",
    period: "2020",
    resolution: "10 m",
    sensor: "Sentinel-2",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    citation: "Bunting, P. et al. Global Mangrove Watch v4.0.19 Sentinel-2 2020 baseline.",
    url: "https://gee-community-catalog.org/projects/mangrove/",
    eeAssets: ["projects/sat-io/open-datasets/GMW/annual-extent/GMW_MNG_2020"],
    notes: "Used as the mangrove mask for vegetation-condition statistics.",
    enabledByDefault: true,
  },
  cgmd: {
    id: "cgmd",
    name: "Continuous Global Mangrove Dynamics — annual extent",
    shortName: "CGMD",
    producer: "The Mangrove Lab (Zhang, Murray, Song et al.)",
    version: "Extent30",
    period: "1984–2023 (annual)",
    resolution: "30 m",
    sensor: "Landsat",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    citation:
      "Zhang, Z., Murray, N., Song, X. et al. (2026). Unexpected expansion and regrowth in Earth's mangrove forests over the past four decades. Science.",
    doi: "10.1126/science.aec9773",
    url: "https://developers.google.com/earth-engine/datasets/catalog/projects_mangrovedatahub2_assets_CGMD-Extent30",
    eeAssets: ["projects/mangrovedatahub2/assets/CGMD-Extent30"],
    notes:
      "Independent of GMW. Reported ≈90% accuracy for extent and ≈80% for change. Changes late in a year can appear in the next year's map.",
    enabledByDefault: true,
  },
  "tandemx-height": {
    id: "tandemx-height",
    name: "Mangrove canopy height (TanDEM-X)",
    shortName: "Height 12 m",
    producer: "NASA JPL / CMS (Simard et al.)",
    version: "ORNL DAAC 2251",
    period: "2015 (nominal)",
    resolution: "12 m",
    sensor: "TanDEM-X InSAR, calibrated with GEDI",
    licence: "NASA open data (no restrictions)",
    licenceUrl: "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies",
    citation:
      "Simard, M. et al. (2024). CMS: Global Mangrove Canopy Height Maps Derived from TanDEM-X, 2015. ORNL DAAC.",
    doi: "10.3334/ORNLDAAC/2251",
    url: "https://gee-community-catalog.org/projects/mangrove_ht_tandemx/",
    eeAssets: ["projects/sat-io/open-datasets/GLOBAL_MANGROVE_HT_TANDEMX"],
    enabledByDefault: true,
  },
  "simard-agb": {
    id: "simard-agb",
    name: "Mangrove aboveground biomass",
    shortName: "AGB",
    producer: "NASA (Simard et al. 2019)",
    version: "ORNL DAAC 1665 v1.3",
    period: "2000 (nominal)",
    resolution: "30 m",
    sensor: "SRTM + ICESat/GLAS + field allometry",
    licence: "CC0 / public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    citation:
      "Simard, M. et al. (2019). Mangrove canopy height globally related to precipitation, temperature and cyclone frequency. Nature Geoscience 12, 40–45.",
    doi: "10.3334/ORNLDAAC/1665",
    url: "https://gee-community-catalog.org/projects/gmd/",
    eeAssets: ["projects/sat-io/open-datasets/global_mangrove_distribution/agb"],
    notes: "Global allometry; suitable for screening, not for crediting. Calibrate with field plots for MRV.",
    enabledByDefault: true,
  },
  "simard-hmax": {
    id: "simard-hmax",
    name: "Mangrove maximum canopy height (2000)",
    shortName: "Hmax 2000",
    producer: "NASA (Simard et al. 2019)",
    version: "ORNL DAAC 1665 v1.3",
    period: "2000 (nominal)",
    resolution: "30 m",
    sensor: "SRTM + ICESat/GLAS",
    licence: "CC0 / public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    citation:
      "Simard, M. et al. (2019). Mangrove canopy height globally related to precipitation, temperature and cyclone frequency. Nature Geoscience 12, 40–45.",
    doi: "10.3334/ORNLDAAC/1665",
    url: "https://gee-community-catalog.org/projects/gmd/",
    eeAssets: ["projects/sat-io/open-datasets/global_mangrove_distribution/hmax95"],
    enabledByDefault: true,
  },
  "murray-tidal-change": {
    id: "murray-tidal-change",
    name: "Global tidal wetland change",
    shortName: "Tidal change",
    producer: "James Cook University (Murray et al.)",
    version: "v1.0",
    period: "1999–2019",
    resolution: "30 m",
    sensor: "Landsat",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    citation: "Murray, N.J. et al. (2022). High-resolution mapping of losses and gains of Earth's tidal wetlands. Science 376, 744–749.",
    doi: "10.1126/science.abm9583",
    url: "https://developers.google.com/earth-engine/datasets/catalog/JCU_Murray_GIC_global_tidal_wetland_change_2019",
    eeAssets: ["JCU/Murray/GIC/global_tidal_wetland_change/2019"],
    notes: "Only pixels classified as mangrove (type 3) are counted as mangrove loss or gain.",
    enabledByDefault: true,
  },
  "murray-intertidal": {
    id: "murray-intertidal",
    name: "Global intertidal (tidal flat) extent",
    shortName: "Tidal flats",
    producer: "University of Queensland (Murray et al.)",
    version: "v1.1",
    period: "2014–2016",
    resolution: "30 m",
    sensor: "Landsat",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    citation: "Murray, N.J. et al. (2019). The global distribution and trajectory of tidal flats. Nature 565, 222–225.",
    doi: "10.1038/s41586-018-0805-8",
    url: "https://developers.google.com/earth-engine/datasets/catalog/UQ_murray_Intertidal_v1_1_global_intertidal",
    eeAssets: ["UQ/murray/Intertidal/v1_1/global_intertidal"],
    enabledByDefault: true,
  },
  "sentinel-2": {
    id: "sentinel-2",
    name: "Sentinel-2 surface reflectance + Cloud Score+",
    shortName: "Sentinel-2",
    producer: "ESA Copernicus; Cloud Score+ by Google",
    version: "S2_SR_HARMONIZED, CLOUD_SCORE_PLUS V1",
    period: "2017–present (5-day revisit)",
    resolution: "10–20 m",
    sensor: "Sentinel-2 MSI",
    licence: "Copernicus open licence; Cloud Score+ CC BY 4.0",
    licenceUrl: "https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice",
    citation:
      "Contains modified Copernicus Sentinel data. Pasquarella, V.J. et al. (2023). Comprehensive quality assessment of optical satellite imagery using weakly supervised video learning (Cloud Score+). CVPR Workshops.",
    url: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED",
    eeAssets: ["COPERNICUS/S2_SR_HARMONIZED", "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"],
    notes:
      "Monthly medians of NDVI and the Mangrove Vegetation Index (MVI, Baloloy et al. 2020) inside the GMW 2020 mangrove mask; clouds removed where Cloud Score+ cs_cdf < 0.6.",
    enabledByDefault: true,
  },
  "soil-carbon": {
    id: "soil-carbon",
    name: "Mangrove soil organic carbon (0–1 m)",
    shortName: "Soil carbon",
    producer: "Sanderman et al. 2018",
    version: "2018",
    period: "2000 (nominal)",
    resolution: "30 m",
    sensor: "Machine-learning model from soil cores + Landsat covariates",
    licence: "See Harvard Dataverse record",
    licenceUrl: "https://doi.org/10.7910/DVN/OCYUIT",
    citation:
      "Sanderman, J. et al. (2018). A global map of mangrove forest soil carbon at 30 m spatial resolution. Environmental Research Letters 13, 055002.",
    doi: "10.1088/1748-9326/aabe1c",
    url: "https://doi.org/10.7910/DVN/OCYUIT",
    eeAssets: [],
    notes:
      "Not in the public Earth Engine catalogues. Upload the GeoTIFF as your own asset and set GEE_SOC_ASSET (values in Mg C/ha) to enable it.",
    enabledByDefault: false,
  },
};

export const GMW_V3_YEARS = [1996, 2007, 2008, 2009, 2010, 2015, 2016, 2017, 2018, 2019, 2020] as const;
export const CGMD_YEARS = Array.from({ length: 2023 - 1984 + 1 }, (_, i) => 1984 + i);

export function citationFor(id: DatasetId): string {
  const d = DATASETS[id];
  return d.doi ? `${d.citation} https://doi.org/${d.doi}` : `${d.citation} ${d.url}`;
}
