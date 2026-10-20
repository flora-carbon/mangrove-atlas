"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import area from "@turf/area";
import bbox from "@turf/bbox";
import { getBasemaps, type BasemapId } from "@/lib/basemaps";
import type { DatasetId } from "@/lib/datasets";
import { buildReport, DISCLAIMER, downloadBlob, reportToCsv, type Results } from "@/lib/export";
import { AoiError, normaliseAoi } from "@/lib/geo/aoi";
import { fmtHa } from "@/lib/format";
import { readUrlState, writeUrlState, type ActiveLayer, type UrlState, type ViewState } from "@/lib/urlState";
import { MODULES } from "@/lib/analysis/types";
import { AreaTools } from "./AreaTools";
import { useAnalysis, useHealth, useLayerTiles } from "./hooks";
import { LayerPanel } from "./LayerPanel";
import { MapView, type DrawMode, type MapHandle } from "./MapView";
import { Button, DatasetDialog, Notice } from "./ui";
import { ChangeWidget, CoastalWidget, ConditionWidget, ExtentWidget, StructureWidget } from "./widgets";

type Tab = "analyse" | "layers";

export default function AtlasApp() {
  const health = useHealth();
  const engineReady = Boolean(health?.configured);
  const basemaps = useMemo(() => getBasemaps(), []);

  // URL state is read once on mount (client only — this component is loaded with ssr:false).
  const [initial] = useState<UrlState>(() => readUrlState(window.location.search));
  const [layers, setLayersState] = useState<ActiveLayer[]>(initial.layers);
  const [basemapId, setBasemapId] = useState<BasemapId>(basemaps.some((b) => b.id === initial.basemap) ? initial.basemap : "satellite");
  const view = useRef<ViewState>(initial.view);

  const [tab, setTab] = useState<Tab>("analyse");
  const [aoi, setAoi] = useState<MultiPolygon | null>(null);
  const [aoiName, setAoiName] = useState("Drawn area");
  const [aoiError, setAoiError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [info, setInfo] = useState<DatasetId | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mapRef = useRef<MapHandle>(null);
  const tiles = useLayerTiles(layers, engineReady);
  const { modules, run, reset } = useAnalysis();

  const basemap = basemaps.find((b) => b.id === basemapId) ?? basemaps[0];

  const syncUrl = useCallback(
    (next?: Partial<UrlState>) => {
      const s: UrlState = { layers, basemap: basemapId, view: view.current, ...next };
      window.history.replaceState(null, "", writeUrlState(s));
    },
    [layers, basemapId],
  );

  useEffect(() => syncUrl(), [syncUrl]);

  const setLayers = useCallback((fn: (prev: ActiveLayer[]) => ActiveLayer[]) => setLayersState(fn), []);

  const acceptAoi = useCallback(
    (input: Feature | FeatureCollection, name: string) => {
      setAoiError(null);
      try {
        const limits = { maxAreaHa: health?.limits.maxAreaHa || 250_000, maxVertices: health?.limits.maxVertices || 20_000 };
        const a = normaliseAoi(input, limits);
        setAoi(a.geometry);
        setAoiName(name);
        setTab("analyse");
        setSidebarOpen(true);
        mapRef.current?.fitBounds(a.bbox);
        if (engineReady) run(a.geometry);
      } catch (e) {
        setAoiError(e instanceof AoiError ? e.message : "That shape could not be used");
      }
    },
    [engineReady, health, run],
  );

  const clearAoi = () => {
    setAoi(null);
    setAoiError(null);
    reset();
  };

  const results: Results = useMemo(() => {
    const out: Results = {};
    for (const m of MODULES) {
      const s = modules[m];
      if (s.status === "done") (out as Record<string, unknown>)[m] = s.data;
    }
    return out;
  }, [modules]);
  const anyDone = Object.keys(results).length > 0;
  const anyLoading = MODULES.some((m) => modules[m].status === "loading");
  const slug = aoiName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "area";

  const exportJson = () => aoi && downloadBlob(`${slug}-mangrove-atlas.json`, JSON.stringify(buildReport(aoiName, aoi, results), null, 2), "application/json");
  const exportCsv = () => aoi && downloadBlob(`${slug}-mangrove-atlas.csv`, reportToCsv(buildReport(aoiName, aoi, results)), "text/csv");
  const exportGeojson = () =>
    aoi &&
    downloadBlob(
      `${slug}.geojson`,
      JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: aoiName }, geometry: aoi }] }),
      "application/geo+json",
    );

  const aoiHa = aoi ? area(aoi) / 10_000 : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="no-print flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-1 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button className="rounded p-1 text-ink-2 hover:bg-surface-2 md:hidden" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle panel">
            ☰
          </button>
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">
            ❦
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">Flora Mangrove Atlas</div>
            <div className="hidden truncate text-[11px] text-ink-3 sm:block">Open mangrove monitoring · by Flora Carbon AI</div>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <a className="rounded px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink" href="/methods">
            Methods & data
          </a>
          <a
            className="hidden rounded px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline"
            href={process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/floracarbon/flora-mangrove-atlas"}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="hidden rounded-md bg-brand-soft px-2.5 py-1 font-medium text-brand-strong hover:opacity-90 sm:inline"
            href={process.env.NEXT_PUBLIC_PRO_URL ?? "https://floracarbon.ai"}
            target="_blank"
            rel="noreferrer"
          >
            Project-grade MRV →
          </a>
        </nav>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`print-area z-10 flex w-full shrink-0 flex-col border-r border-line bg-surface-0 md:w-[420px] ${sidebarOpen ? "absolute inset-0 md:static" : "hidden md:flex"}`}
        >
          <div className="no-print flex shrink-0 border-b border-line bg-surface-1" role="tablist">
            {(["analyse", "layers"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium ${tab === t ? "border-b-2 border-brand text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {t === "analyse" ? "Analyse an area" : `Map layers (${layers.length})`}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {health && !health.configured ? (
              <Notice tone="warning">
                <strong>Earth Engine is not connected on this deployment.</strong> Basemaps work, but data layers and analysis are disabled. Add
                a service account (see README → “Connect Earth Engine”). <span className="opacity-80">({health.reason})</span>
              </Notice>
            ) : null}

            {tab === "layers" ? (
              <LayerPanel
                layers={layers}
                setLayers={setLayers}
                tiles={tiles}
                basemaps={basemaps}
                basemap={basemapId}
                setBasemap={setBasemapId}
                soilCarbonEnabled={Boolean(health?.soilCarbon)}
                engineReady={engineReady}
                drawing={drawing}
                onInfo={setInfo}
              />
            ) : (
              <>
                {!aoi ? (
                  <section className="rounded-lg border border-line bg-surface-1 p-4">
                    <h2 className="mb-1 text-base font-semibold">Analyse any coastline</h2>
                    <p className="mb-3 text-sm text-ink-2">
                      Draw or upload a site to get four decades of mangrove extent, gain and loss, canopy height, biomass, a screening carbon
                      stock and live Sentinel-2 condition — free and open source.
                    </p>
                    <AreaTools
                      drawing={drawing}
                      disabled={!engineReady && health !== null}
                      onDraw={(m: DrawMode) => {
                        // On phones the panel covers the map; get it out of the way while drawing.
                        if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
                        mapRef.current?.startDraw(m);
                      }}
                      onCancelDraw={() => mapRef.current?.cancelDraw()}
                      onUpload={(fc, name) => acceptAoi(fc, name)}
                      onJump={(b) => mapRef.current?.fitBounds(b)}
                    />
                  </section>
                ) : (
                  <section className="rounded-lg border border-line bg-surface-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <input
                          className="w-full truncate rounded bg-transparent text-base font-semibold hover:bg-surface-2 focus:bg-surface-2"
                          value={aoiName}
                          onChange={(e) => setAoiName(e.target.value)}
                          aria-label="Area name"
                        />
                        <div className="text-xs text-ink-3 tabular">
                          {fmtHa(aoiHa)} · {bbox(aoi).map((n) => n.toFixed(3)).join(", ")}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="no-print" onClick={clearAoi}>
                        ✕ Clear
                      </Button>
                    </div>
                    <div className="no-print mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" onClick={() => run(aoi)} disabled={anyLoading || !engineReady}>
                        ↻ Re-run
                      </Button>
                      <Button size="sm" onClick={exportJson} disabled={!anyDone}>
                        JSON
                      </Button>
                      <Button size="sm" onClick={exportCsv} disabled={!anyDone}>
                        CSV
                      </Button>
                      <Button size="sm" onClick={exportGeojson}>
                        GeoJSON
                      </Button>
                      <Button size="sm" onClick={() => window.print()} disabled={!anyDone}>
                        Print / PDF
                      </Button>
                    </div>
                  </section>
                )}

                {aoiError ? <Notice tone="error">{aoiError}</Notice> : null}

                {aoi ? (
                  <>
                    <ExtentWidget state={modules.extent} />
                    <ChangeWidget state={modules.change} />
                    <ConditionWidget state={modules.condition} />
                    <StructureWidget state={modules.structure} />
                    <CoastalWidget state={modules.coastal} />
                    <p className="px-1 text-[11px] leading-snug text-ink-3">{DISCLAIMER}</p>
                    <aside className="no-print rounded-lg border border-brand/40 bg-brand-soft p-4 text-sm">
                      <div className="font-semibold text-ink">Developing a blue carbon project here?</div>
                      <p className="mt-1 text-ink-2">
                        Flora&apos;s FloraScope turns this screening into audit-ready MRV: field-calibrated biomass, soil cores, VM0033
                        calculations and PDD drafting.
                      </p>
                      <a className="mt-2 inline-block font-medium text-brand-strong underline" href={process.env.NEXT_PUBLIC_PRO_URL ?? "https://floracarbon.ai"} target="_blank" rel="noreferrer">
                        Talk to Flora →
                      </a>
                    </aside>
                  </>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <main className="no-print relative min-w-0 flex-1">
          <MapView
            ref={mapRef}
            basemap={basemap}
            layers={layers}
            tiles={tiles}
            aoi={aoi}
            initialView={initial.view}
            onViewChange={(v) => {
              view.current = v;
              syncUrl({ view: v });
            }}
            onDrawn={(f) => acceptAoi(f, "Drawn area")}
            onDrawingChange={setDrawing}
          />
          {drawing ? (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              Drawing — click the first point to finish · Esc to cancel
            </div>
          ) : null}
          <button
            className="absolute bottom-8 left-3 rounded-md border border-line bg-surface-1 px-3 py-1.5 text-sm shadow-sm md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            Open panel
          </button>
        </main>
      </div>
      <DatasetDialog id={info} onClose={() => setInfo(null)} />
    </div>
  );
}
