"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MultiPolygon } from "geojson";
import { MODULES, type ModuleId, type ModuleResponse } from "@/lib/analysis/types";
import type { ActiveLayer } from "@/lib/urlState";

export interface Health {
  configured: boolean;
  reason: string | null;
  soilCarbon: boolean;
  limits: { maxAreaHa: number; maxVertices: number; analysesPerHour: number };
}

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth({ configured: false, reason: "Could not reach the server", soilCarbon: false, limits: { maxAreaHa: 0, maxVertices: 0, analysesPerHour: 0 } }));
    return () => {
      alive = false;
    };
  }, []);
  return health;
}

export interface TileInfo {
  tiles: string[];
  minzoom: number;
  maxzoom: number;
  attribution: string;
}

export type TileState = { status: "loading" } | { status: "ready"; info: TileInfo } | { status: "error"; error: string };

export function layerKey(l: ActiveLayer) {
  return `${l.id}|${l.year ?? ""}|${l.from ?? ""}|${l.to ?? ""}`;
}

function layerUrl(l: ActiveLayer) {
  const sp = new URLSearchParams();
  if (l.year != null) sp.set("year", String(l.year));
  if (l.from != null) sp.set("from", String(l.from));
  if (l.to != null) sp.set("to", String(l.to));
  const q = sp.toString();
  return `/api/layers/${l.id}${q ? `?${q}` : ""}`;
}

/** Resolves Earth Engine tile URLs for every visible layer. */
export function useLayerTiles(layers: ActiveLayer[], enabled: boolean): Record<string, TileState> {
  const [fetched, setFetched] = useState<Record<string, { state: TileState; exp: number }>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    for (const l of layers) {
      if (!l.visible) continue;
      const key = layerKey(l);
      const have = fetched[key];
      if ((have && have.exp > Date.now()) || inflight.current.has(key)) continue;
      inflight.current.add(key);
      fetch(layerUrl(l))
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
          const info: TileInfo = { tiles: body.tiles, minzoom: body.minzoom, maxzoom: body.maxzoom, attribution: body.attribution };
          setFetched((s) => ({ ...s, [key]: { state: { status: "ready", info }, exp: Date.now() + 50 * 60 * 1000 } }));
        })
        .catch((e: Error) =>
          // Errors expire quickly so a retry happens when the user toggles the layer again.
          setFetched((s) => ({ ...s, [key]: { state: { status: "error", error: e.message }, exp: Date.now() + 15_000 } })),
        )
        .finally(() => inflight.current.delete(key));
    }
  }, [layers, enabled, fetched]);

  return useMemo(() => {
    const out: Record<string, TileState> = {};
    for (const l of layers) {
      const key = layerKey(l);
      out[key] = enabled ? (fetched[key]?.state ?? { status: "loading" }) : { status: "error", error: "Earth Engine is not connected" };
    }
    return out;
  }, [layers, fetched, enabled]);
}

export type ModuleState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "done"; data: ModuleResponse }
  | { status: "error"; error: string };

const idle = Object.fromEntries(MODULES.map((m) => [m, { status: "idle" }])) as Record<ModuleId, ModuleState>;

export function useAnalysis() {
  const [modules, setModules] = useState<Record<ModuleId, ModuleState>>(idle);
  const runId = useRef(0);
  const controllers = useRef<AbortController[]>([]);

  const cancel = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current = [];
  }, []);

  const reset = useCallback(() => {
    cancel();
    runId.current++;
    setModules(idle);
  }, [cancel]);

  const run = useCallback(
    (geometry: MultiPolygon) => {
      cancel();
      const id = ++runId.current;
      const startedAt = Date.now();
      setModules(Object.fromEntries(MODULES.map((m) => [m, { status: "loading", startedAt }])) as Record<ModuleId, ModuleState>);
      for (const m of MODULES) {
        const ctrl = new AbortController();
        controllers.current.push(ctrl);
        fetch(`/api/analyze/${m}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geometry }),
          signal: ctrl.signal,
        })
          .then(async (r) => {
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
            return body as ModuleResponse;
          })
          .then((data) => id === runId.current && setModules((s) => ({ ...s, [m]: { status: "done", data } })))
          .catch((e: Error) => {
            if (e.name === "AbortError" || id !== runId.current) return;
            setModules((s) => ({ ...s, [m]: { status: "error", error: e.message } }));
          });
      }
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);
  return { modules, run, reset };
}
