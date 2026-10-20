import { CGMD_YEARS, GMW_V3_YEARS, type DatasetId } from "./datasets";

export type LayerId =
  | "gmw-v3-extent"
  | "gmw-v3-change"
  | "gmw-v4-2020"
  | "cgmd-extent"
  | "tandemx-height"
  | "simard-agb"
  | "simard-hmax"
  | "murray-tidal-change"
  | "murray-intertidal"
  | "s2-truecolor"
  | "s2-ndvi"
  | "soil-carbon";

export type LayerGroup = "Extent & change" | "Structure & carbon" | "Coastal context" | "Live imagery";

export type Legend =
  | { type: "solid"; items: { color: string; label: string }[] }
  | { type: "gradient"; colors: string[]; min: number; max: number; unit: string };

export interface LayerDef {
  id: LayerId;
  datasetId: DatasetId;
  title: string;
  group: LayerGroup;
  description: string;
  /** Years the user can pick from (undefined → not time-enabled). */
  years?: readonly number[];
  /** For change layers: the user picks a pair of years. */
  yearPair?: boolean;
  defaultYear?: number;
  legend: Legend;
  defaultOpacity: number;
  minzoom?: number;
}

export const VIRIDIS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
export const BIOMASS = ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"];
export const NDVI = ["#a50026", "#f46d43", "#fee08b", "#a6d96a", "#1a9850", "#004529"];
export const SOC = ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"];

export const LAYERS: LayerDef[] = [
  {
    id: "cgmd-extent",
    datasetId: "cgmd",
    title: "Mangrove extent (annual, 1984–2023)",
    group: "Extent & change",
    description: "Annual 30 m Landsat map from the Continuous Global Mangrove Dynamics dataset.",
    years: CGMD_YEARS,
    defaultYear: 2023,
    legend: { type: "solid", items: [{ color: "#13a36b", label: "Mangrove" }] },
    defaultOpacity: 0.9,
  },
  {
    id: "gmw-v3-extent",
    datasetId: "gmw-v3",
    title: "Mangrove extent (GMW v3, 1996–2020)",
    group: "Extent & change",
    description: "Global Mangrove Watch v3.0 epochs, mapped from L-band radar and Landsat.",
    years: GMW_V3_YEARS,
    defaultYear: 2020,
    legend: { type: "solid", items: [{ color: "#0f766e", label: "Mangrove" }] },
    defaultOpacity: 0.9,
  },
  {
    id: "gmw-v3-change",
    datasetId: "gmw-v3",
    title: "Mangrove gain & loss (GMW v3)",
    group: "Extent & change",
    description: "Pixels that became mangrove (gain) or stopped being mangrove (loss) between two GMW epochs.",
    years: GMW_V3_YEARS,
    yearPair: true,
    legend: {
      type: "solid",
      items: [
        { color: "#2563eb", label: "Gain" },
        { color: "#dc2626", label: "Loss" },
      ],
    },
    defaultOpacity: 1,
  },
  {
    id: "gmw-v4-2020",
    datasetId: "gmw-v4-2020",
    title: "High-resolution extent 2020 (10 m)",
    group: "Extent & change",
    description: "Sentinel-2 based GMW baseline at 10 m.",
    legend: { type: "solid", items: [{ color: "#22c55e", label: "Mangrove (10 m)" }] },
    defaultOpacity: 0.9,
  },
  {
    id: "tandemx-height",
    datasetId: "tandemx-height",
    title: "Canopy height 2015 (12 m)",
    group: "Structure & carbon",
    description: "Maximum canopy height from TanDEM-X radar interferometry, calibrated with GEDI lidar.",
    legend: { type: "gradient", colors: VIRIDIS, min: 0, max: 30, unit: "m" },
    defaultOpacity: 0.9,
  },
  {
    id: "simard-agb",
    datasetId: "simard-agb",
    title: "Aboveground biomass (2000)",
    group: "Structure & carbon",
    description: "Global mangrove aboveground biomass from height–biomass allometry.",
    legend: { type: "gradient", colors: BIOMASS, min: 0, max: 300, unit: "Mg/ha" },
    defaultOpacity: 0.9,
  },
  {
    id: "simard-hmax",
    datasetId: "simard-hmax",
    title: "Maximum canopy height (2000)",
    group: "Structure & carbon",
    description: "SRTM-derived maximum canopy height, for comparison with the 2015 TanDEM-X map.",
    legend: { type: "gradient", colors: VIRIDIS, min: 0, max: 30, unit: "m" },
    defaultOpacity: 0.9,
  },
  {
    id: "soil-carbon",
    datasetId: "soil-carbon",
    title: "Soil organic carbon (0–1 m)",
    group: "Structure & carbon",
    description: "Sanderman et al. 2018 soil carbon stock. Requires your own Earth Engine asset.",
    legend: { type: "gradient", colors: SOC, min: 0, max: 700, unit: "Mg C/ha" },
    defaultOpacity: 0.9,
  },
  {
    id: "murray-tidal-change",
    datasetId: "murray-tidal-change",
    title: "Tidal wetland loss & gain (1999–2019)",
    group: "Coastal context",
    description: "Mangrove, tidal marsh and tidal flat change from Landsat time series.",
    legend: {
      type: "solid",
      items: [
        { color: "#dc2626", label: "Mangrove loss" },
        { color: "#2563eb", label: "Mangrove gain" },
        { color: "#f59e0b", label: "Other tidal wetland loss" },
        { color: "#a855f7", label: "Other tidal wetland gain" },
      ],
    },
    defaultOpacity: 1,
  },
  {
    id: "murray-intertidal",
    datasetId: "murray-intertidal",
    title: "Tidal flats (2014–2016)",
    group: "Coastal context",
    description: "Intertidal mudflats, sandflats and rock platforms.",
    legend: { type: "solid", items: [{ color: "#d6a35c", label: "Tidal flat" }] },
    defaultOpacity: 0.8,
  },
  {
    id: "s2-truecolor",
    datasetId: "sentinel-2",
    title: "Latest Sentinel-2 imagery (90-day cloud-free)",
    group: "Live imagery",
    description: "Cloud-masked median of the last 90 days of Sentinel-2 — see conditions now, not years ago.",
    legend: { type: "solid", items: [{ color: "#64748b", label: "True colour (B4/B3/B2)" }] },
    defaultOpacity: 1,
    minzoom: 8,
  },
  {
    id: "s2-ndvi",
    datasetId: "sentinel-2",
    title: "Latest vegetation greenness (NDVI)",
    group: "Live imagery",
    description: "NDVI from the last 90 days of cloud-masked Sentinel-2.",
    legend: { type: "gradient", colors: NDVI, min: 0, max: 0.9, unit: "NDVI" },
    defaultOpacity: 0.9,
    minzoom: 8,
  },
];

export const LAYER_BY_ID: Record<LayerId, LayerDef> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l]),
) as Record<LayerId, LayerDef>;

export const LAYER_GROUPS: LayerGroup[] = ["Extent & change", "Structure & carbon", "Coastal context", "Live imagery"];

export function isLayerId(v: string): v is LayerId {
  return v in LAYER_BY_ID;
}
