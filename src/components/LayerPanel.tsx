"use client";

import type { DatasetId } from "@/lib/datasets";
import { LAYERS, LAYER_GROUPS, type LayerDef, type LayerId, type Legend } from "@/lib/layers";
import type { Basemap, BasemapId } from "@/lib/basemaps";
import { defaultLayer, type ActiveLayer } from "@/lib/urlState";
import { layerKey, type TileState } from "./hooks";

interface Props {
  layers: ActiveLayer[];
  setLayers: (fn: (prev: ActiveLayer[]) => ActiveLayer[]) => void;
  tiles: Record<string, TileState>;
  basemaps: Basemap[];
  basemap: BasemapId;
  setBasemap: (b: BasemapId) => void;
  soilCarbonEnabled: boolean;
  engineReady: boolean;
  drawing: boolean;
  onInfo: (id: DatasetId) => void;
}

export function LegendView({ legend }: { legend: Legend }) {
  if (legend.type === "solid") {
    return (
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {legend.items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ background: it.color }} />
            {it.label}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div>
      <div className="h-2.5 rounded-sm" style={{ background: `linear-gradient(to right, ${legend.colors.join(",")})` }} />
      <div className="mt-0.5 flex justify-between text-[11px] text-ink-3 tabular">
        <span>{legend.min}</span>
        <span>{legend.unit}</span>
        <span>{legend.max}+</span>
      </div>
    </div>
  );
}

function YearControl({ def, layer, onChange }: { def: LayerDef; layer: ActiveLayer; onChange: (p: Partial<ActiveLayer>) => void }) {
  const years = def.years ?? [];
  if (def.yearPair) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-2">
        <label className="flex items-center gap-1">
          From
          <select className="rounded border border-line bg-surface-1 px-1 py-0.5" value={layer.from} onChange={(e) => onChange({ from: Number(e.target.value) })}>
            {years.filter((y) => y < (layer.to ?? Infinity)).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          to
          <select className="rounded border border-line bg-surface-1 px-1 py-0.5" value={layer.to} onChange={(e) => onChange({ to: Number(e.target.value) })}>
            {years.filter((y) => y > (layer.from ?? -Infinity)).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
    );
  }
  const idx = Math.max(0, years.indexOf(layer.year ?? years[years.length - 1]));
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={years.length - 1}
        value={idx}
        aria-label={`${def.title} year`}
        onChange={(e) => onChange({ year: years[Number(e.target.value)] })}
        className="w-full"
      />
      <span className="tabular w-10 text-right text-sm font-semibold">{years[idx]}</span>
    </div>
  );
}

export function LayerPanel({ layers, setLayers, tiles, basemaps, basemap, setBasemap, soilCarbonEnabled, engineReady, drawing, onInfo }: Props) {
  const active = new Map(layers.map((l) => [l.id, l]));
  const update = (id: LayerId, p: Partial<ActiveLayer>) => setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const toggle = (id: LayerId) =>
    setLayers((prev) => (prev.some((l) => l.id === id) ? prev.filter((l) => l.id !== id) : [...prev, defaultLayer(id)]));

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-2">Basemap</legend>
        <div className="flex flex-wrap gap-1.5">
          {basemaps.map((b) => (
            <button
              key={b.id}
              disabled={drawing}
              onClick={() => setBasemap(b.id)}
              aria-pressed={basemap === b.id}
              title={b.note}
              className={`rounded-md border px-2.5 py-1 text-xs ${basemap === b.id ? "border-brand bg-brand-soft font-semibold text-ink" : "border-line bg-surface-1 text-ink-2 hover:bg-surface-2"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </fieldset>

      {LAYER_GROUPS.map((group) => (
        <fieldset key={group}>
          <legend className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-2">{group}</legend>
          <ul className="space-y-1.5">
            {LAYERS.filter((d) => d.group === group).map((def) => {
              const l = active.get(def.id);
              const disabled = !engineReady || (def.id === "soil-carbon" && !soilCarbonEnabled);
              const t = l ? tiles[layerKey(l)] : undefined;
              return (
                <li key={def.id} className={`rounded-md border ${l ? "border-brand/50 bg-surface-1" : "border-line bg-surface-1"}`}>
                  <div className="flex items-start gap-2 p-2">
                    <input
                      id={`chk-${def.id}`}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                      checked={Boolean(l)}
                      disabled={disabled}
                      onChange={() => toggle(def.id)}
                    />
                    <label htmlFor={`chk-${def.id}`} className={`min-w-0 flex-1 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
                      <div className="text-sm font-medium leading-tight text-ink">{def.title}</div>
                      <div className="mt-0.5 text-xs leading-snug text-ink-3">
                        {def.id === "soil-carbon" && !soilCarbonEnabled ? "Not configured on this server." : def.description}
                      </div>
                    </label>
                    <button
                      className="rounded px-1.5 text-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
                      aria-label={`About ${def.title}`}
                      onClick={() => onInfo(def.datasetId)}
                    >
                      ⓘ
                    </button>
                  </div>
                  {l ? (
                    <div className="space-y-2 border-t border-line px-2 pb-2 pt-2">
                      {def.years ? <YearControl def={def} layer={l} onChange={(p) => update(def.id, p)} /> : null}
                      <LegendView legend={def.legend} />
                      <div className="flex items-center gap-2 text-xs text-ink-3">
                        <button className="underline" onClick={() => update(def.id, { visible: !l.visible })}>
                          {l.visible ? "Hide" : "Show"}
                        </button>
                        <span aria-hidden>·</span>
                        <label className="flex flex-1 items-center gap-2">
                          Opacity
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(l.opacity * 100)}
                            onChange={(e) => update(def.id, { opacity: Number(e.target.value) / 100 })}
                            className="flex-1"
                          />
                        </label>
                        {t?.status === "loading" ? <span className="animate-pulse">loading…</span> : null}
                      </div>
                      {t?.status === "error" ? <p className="text-xs text-[var(--critical)]">{t.error}</p> : null}
                      {def.minzoom ? <p className="text-[11px] text-ink-3">Visible from zoom {def.minzoom}.</p> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

