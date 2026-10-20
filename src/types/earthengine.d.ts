declare module "@google/earthengine" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ee: any;
  export default ee;
}

declare module "shpjs" {
  import type { FeatureCollection } from "geojson";
  type ShpResult = FeatureCollection | (FeatureCollection & { fileName?: string })[];
  export default function shp(input: ArrayBuffer | Uint8Array | string): Promise<ShpResult>;
}
