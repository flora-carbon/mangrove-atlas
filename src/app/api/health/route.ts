import { getConfig } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getConfig();
  return Response.json({
    engine: "gee",
    configured: Boolean(cfg.gee),
    reason: cfg.gee ? null : cfg.geeError,
    soilCarbon: Boolean(cfg.socAsset),
    limits: { maxAreaHa: cfg.maxAreaHa, maxVertices: cfg.maxVertices, analysesPerHour: cfg.analysesPerHour },
  });
}
