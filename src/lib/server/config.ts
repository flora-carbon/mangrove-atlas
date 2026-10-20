import "server-only";
import { z } from "zod";

const ServiceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  project_id: z.string().optional(),
});

export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

export interface ServerConfig {
  gee: { serviceAccount: ServiceAccount; project: string } | null;
  geeError: string | null;
  socAsset: string | null;
  maxAreaHa: number;
  maxVertices: number;
  analysesPerHour: number;
  tilesPerHour: number;
}

function parseServiceAccount(raw: string | undefined): { value: ServiceAccount | null; error: string | null } {
  if (!raw || !raw.trim()) return { value: null, error: "GEE_SERVICE_ACCOUNT_KEY is not set" };
  let text = raw.trim();
  // Accept either the raw JSON key file or its base64 encoding (easier to paste into hosting dashboards).
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      return { value: null, error: "GEE_SERVICE_ACCOUNT_KEY is neither JSON nor base64" };
    }
  }
  try {
    const parsed = ServiceAccountSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return { value: null, error: "GEE_SERVICE_ACCOUNT_KEY is missing client_email or private_key" };
    return { value: parsed.data, error: null };
  } catch {
    return { value: null, error: "GEE_SERVICE_ACCOUNT_KEY is not valid JSON" };
  }
}

function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

let cached: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (cached) return cached;
  const sa = parseServiceAccount(process.env.GEE_SERVICE_ACCOUNT_KEY);
  const project = process.env.GEE_PROJECT?.trim() || sa.value?.project_id || "";
  let geeError = sa.error;
  if (!geeError && !project) geeError = "GEE_PROJECT is not set";
  cached = {
    gee: sa.value && project ? { serviceAccount: sa.value, project } : null,
    geeError,
    socAsset: process.env.GEE_SOC_ASSET?.trim() || null,
    maxAreaHa: intEnv("ANALYSIS_MAX_AREA_HA", 250_000),
    maxVertices: intEnv("ANALYSIS_MAX_VERTICES", 20_000),
    analysesPerHour: intEnv("RATE_LIMIT_ANALYSES_PER_HOUR", 30),
    tilesPerHour: intEnv("RATE_LIMIT_LAYER_REQUESTS_PER_HOUR", 600),
  };
  return cached;
}

/** For tests only. */
export function resetConfigForTests() {
  cached = null;
}
