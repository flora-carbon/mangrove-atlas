import { LAYER_BY_ID, isLayerId, type LayerId } from "./layers";
import type { BasemapId } from "./basemaps";

export interface ActiveLayer {
  id: LayerId;
  visible: boolean;
  opacity: number;
  year?: number;
  from?: number;
  to?: number;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface UrlState {
  layers: ActiveLayer[];
  basemap: BasemapId;
  view: ViewState;
}

export const DEFAULT_VIEW: ViewState = { longitude: 88.85, latitude: 21.95, zoom: 8.6 }; // Sundarbans

export const DEFAULT_STATE: UrlState = {
  layers: [defaultLayer("cgmd-extent")],
  basemap: "satellite",
  view: DEFAULT_VIEW,
};

export function defaultLayer(id: LayerId): ActiveLayer {
  const def = LAYER_BY_ID[id];
  const l: ActiveLayer = { id, visible: true, opacity: def.defaultOpacity };
  if (def.yearPair && def.years) {
    l.from = def.years[0];
    l.to = def.years[def.years.length - 1];
  } else if (def.years) {
    l.year = def.defaultYear ?? def.years[def.years.length - 1];
  }
  return l;
}

/** layers=cgmd-extent~2023~90~1,gmw-v3-change~1996-2020~100~0 */
export function encodeLayers(layers: ActiveLayer[]): string {
  return layers
    .map((l) => {
      const t = l.from != null && l.to != null ? `${l.from}-${l.to}` : (l.year ?? "");
      return `${l.id}~${t}~${Math.round(l.opacity * 100)}~${l.visible ? 1 : 0}`;
    })
    .join(",");
}

export function decodeLayers(s: string | null): ActiveLayer[] | null {
  if (!s) return null;
  const out: ActiveLayer[] = [];
  for (const part of s.split(",")) {
    const [id, t, op, vis] = part.split("~");
    if (!id || !isLayerId(id) || out.some((l) => l.id === id)) continue;
    const def = LAYER_BY_ID[id];
    const l = defaultLayer(id);
    const opacity = Number(op);
    if (Number.isFinite(opacity)) l.opacity = Math.min(1, Math.max(0, opacity / 100));
    l.visible = vis !== "0";
    if (def.yearPair && t?.includes("-")) {
      const [a, b] = t.split("-").map(Number);
      if (def.years?.includes(a) && def.years?.includes(b) && a < b) {
        l.from = a;
        l.to = b;
      }
    } else if (def.years && t) {
      const y = Number(t);
      if (def.years.includes(y)) l.year = y;
    }
    out.push(l);
  }
  return out;
}

export function decodeView(s: string | null): ViewState | null {
  if (!s) return null;
  const [lng, lat, z] = s.split(",").map(Number);
  if (![lng, lat, z].every(Number.isFinite)) return null;
  if (Math.abs(lat) > 85 || Math.abs(lng) > 180 || z < 0 || z > 22) return null;
  return { longitude: lng, latitude: lat, zoom: z };
}

export function encodeView(v: ViewState): string {
  return `${v.longitude.toFixed(4)},${v.latitude.toFixed(4)},${v.zoom.toFixed(2)}`;
}

export function readUrlState(search: string): UrlState {
  const sp = new URLSearchParams(search);
  const bm = sp.get("basemap");
  return {
    layers: decodeLayers(sp.get("layers")) ?? DEFAULT_STATE.layers,
    basemap: bm === "streets" || bm === "satellite" || bm === "esri" ? bm : DEFAULT_STATE.basemap,
    view: decodeView(sp.get("view")) ?? DEFAULT_STATE.view,
  };
}

export function writeUrlState(state: UrlState): string {
  const sp = new URLSearchParams();
  sp.set("layers", encodeLayers(state.layers));
  sp.set("basemap", state.basemap);
  sp.set("view", encodeView(state.view));
  // Keep "~" and "," readable so shared links stay short and legible.
  return `?${sp.toString().replace(/%7E/gi, "~").replace(/%2C/gi, ",")}`;
}
