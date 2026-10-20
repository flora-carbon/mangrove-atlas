"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import Map, { Layer, NavigationControl, ScaleControl, Source, type MapRef } from "react-map-gl/maplibre";
import type { Feature, MultiPolygon } from "geojson";
import type { Map as MLMap } from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Basemap } from "@/lib/basemaps";
import type { ActiveLayer, ViewState } from "@/lib/urlState";
import { layerKey, type TileState } from "./hooks";

export type DrawMode = "polygon" | "rectangle";

export interface MapHandle {
  startDraw: (mode: DrawMode) => void;
  cancelDraw: () => void;
  fitBounds: (b: [number, number, number, number]) => void;
}

interface Props {
  basemap: Basemap;
  layers: ActiveLayer[];
  tiles: Record<string, TileState>;
  aoi: MultiPolygon | null;
  initialView: ViewState;
  onViewChange: (v: ViewState) => void;
  onDrawn: (f: Feature) => void;
  onDrawingChange: (active: boolean) => void;
}

const BRAND = "#0d6b4f";

export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { basemap, layers, tiles, aoi, initialView, onViewChange, onDrawn, onDrawingChange },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const modeRef = useRef<DrawMode | null>(null);

  const stopDraw = useCallback(() => {
    const d = drawRef.current;
    if (d) {
      try {
        d.clear();
        d.stop();
      } catch {
        /* map may already be gone */
      }
    }
    drawRef.current = null;
    modeRef.current = null;
    onDrawingChange(false);
  }, [onDrawingChange]);

  const startDraw = useCallback(
    (mode: DrawMode) => {
      const map = mapRef.current?.getMap() as MLMap | undefined;
      if (!map) return;
      if (drawRef.current) stopDraw();
      const style = {
        fillColor: "#22c55e" as const,
        fillOpacity: 0.15,
        outlineColor: "#ffffff" as const,
        outlineWidth: 2,
      };
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [new TerraDrawPolygonMode({ styles: style }), new TerraDrawRectangleMode({ styles: style })],
      });
      draw.start();
      draw.setMode(mode);
      draw.on("finish", (id) => {
        const f = draw.getSnapshot().find((x) => x.id === id);
        if (f) onDrawn({ type: "Feature", properties: {}, geometry: f.geometry } as Feature);
        // Defer teardown so terra-draw finishes its own event handling first.
        setTimeout(stopDraw, 0);
      });
      drawRef.current = draw;
      modeRef.current = mode;
      onDrawingChange(true);
    },
    [onDrawn, onDrawingChange, stopDraw],
  );

  useImperativeHandle(
    ref,
    () => ({
      startDraw,
      cancelDraw: stopDraw,
      fitBounds: (b) => mapRef.current?.fitBounds([b[0], b[1], b[2], b[3]], { padding: 60, duration: 900, maxZoom: 14 }),
    }),
    [startDraw, stopDraw],
  );

  useEffect(() => () => stopDraw(), [stopDraw]);

  // Escape cancels drawing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && modeRef.current && stopDraw();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopDraw]);

  const aoiData = useMemo(
    () => (aoi ? ({ type: "Feature", properties: {}, geometry: aoi } as Feature) : null),
    [aoi],
  );

  // Render data layers bottom → top in list order; the AOI always sits on top.
  const visible = layers.filter((l) => l.visible);

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={basemap.style}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      maxPitch={0}
      dragRotate={false}
      onMoveEnd={(e) => onViewChange({ longitude: e.viewState.longitude, latitude: e.viewState.latitude, zoom: e.viewState.zoom })}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <ScaleControl position="bottom-right" unit="metric" />

      {aoiData ? (
        <Source id="aoi" type="geojson" data={aoiData}>
          <Layer id="aoi-fill" type="fill" paint={{ "fill-color": BRAND, "fill-opacity": 0.08 }} />
          <Layer id="aoi-casing" type="line" paint={{ "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.9 }} />
          <Layer id="aoi-line" type="line" paint={{ "line-color": BRAND, "line-width": 2 }} />
        </Source>
      ) : null}

      {visible.map((l) => {
        const t = tiles[layerKey(l)];
        if (t?.status !== "ready") return null;
        const key = layerKey(l);
        return (
          <Source
            key={key}
            id={`src-${key}`}
            type="raster"
            tiles={t.info.tiles}
            tileSize={256}
            minzoom={t.info.minzoom}
            maxzoom={t.info.maxzoom}
            attribution={t.info.attribution}
          >
            <Layer id={`lyr-${l.id}`} type="raster" paint={{ "raster-opacity": l.opacity, "raster-fade-duration": 150 }} beforeId={aoiData ? "aoi-fill" : undefined} />
          </Source>
        );
      })}

    </Map>
  );
});
