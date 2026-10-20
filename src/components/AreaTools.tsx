"use client";

import { useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { ACCEPTED_UPLOADS, UploadError, parseBoundaryFile } from "@/lib/geo/upload";
import { PLACES, type Place } from "@/lib/places";
import { Button, Notice } from "./ui";
import type { DrawMode } from "./MapView";

interface Props {
  drawing: boolean;
  onDraw: (m: DrawMode) => void;
  onCancelDraw: () => void;
  onUpload: (fc: FeatureCollection, name: string) => void;
  onJump: (bbox: [number, number, number, number]) => void;
  disabled: boolean;
}

interface GeoResult {
  name: string;
  detail: string;
  bbox: [number, number, number, number];
}

const GEOCODER = process.env.NEXT_PUBLIC_GEOCODER_URL ?? "https://photon.komoot.io/api/";

async function geocode(q: string, signal: AbortSignal): Promise<GeoResult[]> {
  const url = `${GEOCODER}?q=${encodeURIComponent(q)}&limit=6`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("Search is unavailable right now");
  const body = (await r.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: { name?: string; state?: string; country?: string; extent?: number[] } }[];
  };
  return body.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const e = f.properties.extent;
    const bbox: [number, number, number, number] =
      e && e.length === 4
        ? [Math.min(e[0], e[2]), Math.min(e[1], e[3]), Math.max(e[0], e[2]), Math.max(e[1], e[3])]
        : [lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05];
    return {
      name: f.properties.name ?? "Unnamed place",
      detail: [f.properties.state, f.properties.country].filter(Boolean).join(", "),
      bbox,
    };
  });
}

export function AreaTools({ drawing, onDraw, onCancelDraw, onUpload, onJump, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    try {
      setError(null);
      setResults(await geocode(q.trim(), ctrl.current.signal));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const fc = await parseBoundaryFile(f);
      onUpload(fc, f.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "Could not read that file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {drawing ? (
          <Button className="col-span-3" onClick={onCancelDraw}>
            Cancel drawing (Esc)
          </Button>
        ) : (
          <>
            <Button variant="primary" disabled={disabled} onClick={() => onDraw("polygon")}>
              ✎ Polygon
            </Button>
            <Button disabled={disabled} onClick={() => onDraw("rectangle")}>
              ▭ Box
            </Button>
            <Button disabled={disabled} onClick={() => fileRef.current?.click()}>
              ⤒ Upload
            </Button>
          </>
        )}
      </div>
      {drawing ? <p className="text-xs text-ink-2">Click on the map to add points; click the first point (or double-click) to finish.</p> : null}
      <input ref={fileRef} type="file" accept={ACCEPTED_UPLOADS} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="text-[11px] text-ink-3">Upload GeoJSON, KML, KMZ or a zipped shapefile. Files are read in your browser.</p>

      <form onSubmit={search} className="flex gap-1.5" role="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          aria-label="Search a place"
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface-1 px-3 text-sm placeholder:text-ink-3"
        />
        <Button type="submit">Go</Button>
      </form>
      {results ? (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface-1">
          {results.length === 0 ? <li className="px-3 py-2 text-xs text-ink-3">No results</li> : null}
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-2"
                onClick={() => {
                  onJump(r.bbox);
                  setResults(null);
                }}
              >
                {r.name} <span className="text-xs text-ink-3">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-2">Jump to</div>
        <div className="flex flex-wrap gap-1">
          {PLACES.map((p: Place) => (
            <button
              key={p.name}
              title={p.region}
              onClick={() => onJump(p.bbox)}
              className="rounded-full border border-line bg-surface-1 px-2 py-0.5 text-xs text-ink-2 hover:border-brand hover:text-ink"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
