import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { ANALYSIS_SCHEMA_VERSION, MODULES, isModuleId, type ModuleResponse } from "@/lib/analysis/types";
import { AoiError, aoiKey, normaliseAoi } from "@/lib/geo/aoi";
import { getConfig } from "@/lib/server/config";
import { runModule } from "@/lib/server/ee/analyze";
import { EngineNotConfiguredError } from "@/lib/server/ee/client";
import { RateLimiter, TtlCache, clientKey } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cfg = getConfig();
// One "analysis" = one request per module, so budget accordingly.
const limiter = new RateLimiter(cfg.analysesPerHour * MODULES.length, 60 * 60 * 1000);
const cache = new TtlCache<ModuleResponse>(300, 12 * 60 * 60 * 1000);

const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const { module } = await ctx.params;
  if (!isModuleId(module)) {
    return Response.json({ error: `Unknown module '${module}'. Use one of: ${MODULES.join(", ")}`, code: "bad_request" }, { status: 404 });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return Response.json({ error: "Request body too large (5 MB max)", code: "too_large" }, { status: 413 });

  let body: { geometry?: unknown; carbonFraction?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON: { geometry: GeoJSON }", code: "bad_request" }, { status: 400 });
  }

  let aoi;
  try {
    aoi = normaliseAoi(body.geometry, { maxAreaHa: cfg.maxAreaHa, maxVertices: cfg.maxVertices });
  } catch (e) {
    if (e instanceof AoiError) return Response.json({ error: e.message, code: "bad_request" }, { status: 400 });
    throw e;
  }

  const cf = typeof body.carbonFraction === "number" && body.carbonFraction >= 0.3 && body.carbonFraction <= 0.6 ? body.carbonFraction : undefined;
  const key = createHash("sha256").update(`${ANALYSIS_SCHEMA_VERSION}|${module}|${cf ?? ""}|${aoiKey(aoi)}`).digest("hex");
  const hit = cache.get(key);
  if (hit) return Response.json({ ...hit, cached: true });

  const rl = limiter.check(clientKey(req));
  if (!rl.ok) {
    return Response.json(
      { error: `Hourly analysis limit reached — try again in ${Math.ceil(rl.retryAfterS / 60)} min, or self-host the Atlas.`, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterS) } },
    );
  }

  try {
    const out = await runModule(module, aoi, { carbonFraction: cf });
    const response: ModuleResponse = {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      module,
      engine: "gee",
      generatedAt: new Date().toISOString(),
      aoi: { areaHa: Math.round(aoi.areaHa * 100) / 100, bbox: aoi.bbox },
      datasets: out.datasets,
      result: out.result,
      warnings: out.warnings,
      partial: out.partial,
      cached: false,
    };
    // Only cache complete results.
    if (!out.partial) cache.set(key, response);
    return Response.json(response);
  } catch (e) {
    if (e instanceof EngineNotConfiguredError)
      return Response.json({ error: e.message, code: "not_configured" }, { status: 503 });
    console.error("[analyze]", module, e);
    return Response.json({ error: "Earth Engine could not complete this analysis.", code: "engine_error" }, { status: 502 });
  }
}
