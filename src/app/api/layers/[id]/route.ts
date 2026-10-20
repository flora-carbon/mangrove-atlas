import type { NextRequest } from "next/server";
import { DATASETS } from "@/lib/datasets";
import { LAYER_BY_ID, isLayerId } from "@/lib/layers";
import { getConfig } from "@/lib/server/config";
import { EngineNotConfiguredError } from "@/lib/server/ee/client";
import { LayerParamError, getLayerTiles } from "@/lib/server/ee/tiles";
import { RateLimiter, clientKey } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

const limiter = new RateLimiter(getConfig().tilesPerHour, 60 * 60 * 1000);

function intParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isLayerId(id)) return Response.json({ error: `Unknown layer '${id}'`, code: "bad_request" }, { status: 404 });

  const rl = limiter.check(clientKey(req));
  if (!rl.ok) {
    return Response.json(
      { error: "Too many layer requests — try again shortly.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterS) } },
    );
  }

  const sp = req.nextUrl.searchParams;
  const params = { year: intParam(sp.get("year")), from: intParam(sp.get("from")), to: intParam(sp.get("to")) };
  const def = LAYER_BY_ID[id];
  const ds = DATASETS[def.datasetId];

  try {
    const tiles = await getLayerTiles(id, params);
    return Response.json(
      {
        id,
        tiles: [tiles.url],
        tileSize: 256,
        minzoom: def.minzoom ?? 0,
        maxzoom: 18,
        attribution: `${ds.shortName}: ${ds.producer} (${ds.licence})`,
        expiresAt: new Date(tiles.expiresAt).toISOString(),
      },
      // Let a CDN share map IDs between visitors for an hour.
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } },
    );
  } catch (e) {
    if (e instanceof EngineNotConfiguredError)
      return Response.json({ error: e.message, code: "not_configured" }, { status: 503 });
    if (e instanceof LayerParamError) return Response.json({ error: e.message, code: "bad_request" }, { status: 400 });
    console.error("[layers]", id, e);
    return Response.json({ error: "Earth Engine could not render this layer.", code: "engine_error" }, { status: 502 });
  }
}
