import "server-only";
import { getConfig } from "../config";
import type { EE } from "./types";

let initPromise: Promise<EE> | null = null;

/**
 * Lazily authenticates the Earth Engine client with the configured service
 * account and resolves to the initialised `ee` namespace. Concurrent callers
 * share a single initialisation.
 */
export function getEE(): Promise<EE> {
  if (initPromise) return initPromise;
  const cfg = getConfig();
  if (!cfg.gee) return Promise.reject(new EngineNotConfiguredError(cfg.geeError ?? "Earth Engine is not configured"));
  const { serviceAccount, project } = cfg.gee;

  initPromise = (async () => {
    const mod = await import("@google/earthengine");
    const ee: EE = (mod as { default?: EE }).default ?? (mod as unknown as EE);
    await new Promise<void>((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        serviceAccount,
        () => ee.initialize(null, null, () => resolve(), (e: unknown) => reject(toError(e)), null, project),
        (e: unknown) => reject(toError(e)),
      );
    });
    return ee;
  })();

  // Allow a retry on the next request if initialisation failed.
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

export class EngineNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineNotConfiguredError";
  }
}

export function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : JSON.stringify(e));
}

/** Promise wrapper around `ComputedObject.evaluate`. */
export function evaluate<T>(obj: { evaluate: (cb: (v: T, err?: string) => void) => void }, timeoutMs = 120_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Earth Engine computation timed out")), timeoutMs);
    obj.evaluate((value, err) => {
      clearTimeout(timer);
      if (err) reject(new Error(err));
      else resolve(value);
    });
  });
}

export interface MapIdResult {
  urlFormat: string;
}

/** Promise wrapper around `Image.getMapId`. */
export function getMapId(image: { getMapId: (vis: object, cb: (m: MapIdResult | undefined, err?: string) => void) => void }, vis: object = {}): Promise<MapIdResult> {
  return new Promise((resolve, reject) => {
    image.getMapId(vis, (m, err) => {
      if (err || !m) reject(new Error(err ?? "getMapId failed"));
      else resolve(m);
    });
  });
}
