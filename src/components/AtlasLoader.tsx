"use client";

import dynamic from "next/dynamic";

// MapLibre and terra-draw need the browser; render the app client-side only.
const AtlasApp = dynamic(() => import("./AtlasApp"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center text-sm text-ink-3">Loading the Flora Mangrove Atlas…</div>
  ),
});

export default function AtlasLoader() {
  return <AtlasApp />;
}
