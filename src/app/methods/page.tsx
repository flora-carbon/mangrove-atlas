import type { Metadata } from "next";
import Link from "next/link";
import { DATASETS, citationFor } from "@/lib/datasets";
import { CARBON_FRACTIONS } from "@/lib/analysis/carbon";

export const metadata: Metadata = {
  title: "Methods & data",
  description: "Every dataset, version, licence and formula behind the Flora Mangrove Atlas.",
};

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="mt-10 scroll-mt-6 text-lg font-semibold text-ink">
    {children}
  </h2>
);

export default function MethodsPage() {
  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="border-b border-line bg-surface-1">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-ink">
            ← Flora Mangrove Atlas
          </Link>
          <span className="text-xs text-ink-3">Methods & data</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 text-[15px] leading-relaxed text-ink-2">
        <h1 className="text-2xl font-semibold text-ink">Methods & data</h1>
        <p className="mt-3">
          The Atlas is a screening tool. Every number comes from a published, openly licensed dataset, processed on the fly in Google Earth
          Engine for the exact area you draw. The code is open source (Apache-2.0), so anyone can audit or reproduce a result.
        </p>

        <H2>How each analysis works</H2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Extent.</strong> Mangrove area per year is the sum of pixel areas inside your polygon for three
            independent maps: CGMD (annual, 30 m, 1984–2023), GMW v3 (11 epochs, ≈25 m, 1996–2020) and the GMW 10 m 2020 baseline. Vector
            extents are rasterised at their native resolution before summing. Showing two independent time series side by side gives you a
            visible sense of map uncertainty that a single dataset hides.
          </li>
          <li>
            <strong className="text-ink">Gain & loss.</strong> For each pair of consecutive GMW epochs, gain is “not mangrove → mangrove” and
            loss is “mangrove → not mangrove”. Epochs are unevenly spaced (2010 → 2015 is five years).
          </li>
          <li>
            <strong className="text-ink">Live condition.</strong> Sentinel-2 surface reflectance for the last 24 months, with clouds removed
            where Cloud Score+ <code>cs_cdf</code> &lt; 0.6. For each month we take the median image and report the median NDVI and Mangrove
            Vegetation Index — MVI = (NIR − Green) / (SWIR1 − Green), Baloloy et al. (2020) — inside the GMW 2020 mangrove mask, plus the
            share of the mask with a clear view. “vs. a year earlier” compares the latest three usable months with the same months a year
            before.
          </li>
          <li>
            <strong className="text-ink">Height & biomass.</strong> Mean, median and 90th-percentile canopy height from the 12 m TanDEM-X map
            (2015), area per 5 m height class, mean SRTM-era maximum height, and mean and total aboveground biomass (AGB) from Simard et al.
            (2019).
          </li>
          <li>
            <strong className="text-ink">Screening carbon.</strong> Aboveground carbon = total AGB × carbon fraction; CO₂e = C × 44/12. You can
            choose the carbon fraction:
            <ul className="mt-1 list-[circle] pl-5">
              {CARBON_FRACTIONS.map((c) => (
                <li key={c.value}>{c.label}</li>
              ))}
            </ul>
            Soil organic carbon (0–1 m, Sanderman et al. 2018) is added when the server operator uploads that dataset as an Earth Engine
            asset. Belowground biomass is not estimated.
          </li>
          <li>
            <strong className="text-ink">Tidal wetlands.</strong> Mangrove loss and gain 1999–2019 from Murray et al. (2022), counting only
            pixels whose change type is mangrove, and tidal-flat area (2014–2016).
          </li>
        </ul>

        <H2>Limitations — please read</H2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Global maps have known errors at the scale of individual sites. Small or narrow fringes may be missed or overstated.</li>
          <li>Biomass uses global height–biomass allometry from around 2000 and does not reflect recent growth, planting or degradation.</li>
          <li>Planting younger than about 3–5 years is usually invisible at 10–30 m resolution.</li>
          <li>
            These estimates are <strong className="text-ink">not sufficient for carbon-credit issuance</strong> under Verra VM0033 or Gold
            Standard, which require field plots, stratification, baseline scenarios and uncertainty deductions.
          </li>
        </ul>

        <H2>Datasets</H2>
        <div className="mt-3 space-y-4">
          {Object.values(DATASETS).map((d) => (
            <section key={d.id} id={d.id} className="scroll-mt-6 rounded-lg border border-line bg-surface-1 p-4">
              <h3 className="font-semibold text-ink">{d.name}</h3>
              <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-3">Producer</dt>
                <dd>{d.producer}</dd>
                <dt className="text-ink-3">Version</dt>
                <dd>{d.version}</dd>
                <dt className="text-ink-3">Period</dt>
                <dd>{d.period}</dd>
                <dt className="text-ink-3">Resolution</dt>
                <dd>{d.resolution}</dd>
                <dt className="text-ink-3">Licence</dt>
                <dd>
                  <a className="underline" href={d.licenceUrl}>
                    {d.licence}
                  </a>
                </dd>
                <dt className="text-ink-3">Earth Engine</dt>
                <dd className="break-all font-mono text-xs">{d.eeAssets.length ? d.eeAssets.join(", ") : "your own asset (GEE_SOC_ASSET)"}</dd>
              </dl>
              {d.notes ? <p className="mt-2 text-sm">{d.notes}</p> : null}
              <p className="mt-2 text-xs text-ink-3">{citationFor(d.id)}</p>
            </section>
          ))}
        </div>

        <H2 id="api">Open API</H2>
        <p className="mt-3">
          Every analysis is available as JSON. <code>POST /api/analyze/&#123;module&#125;</code> with a body of{" "}
          <code>{'{ "geometry": <GeoJSON polygon> }'}</code>, where module is <code>extent</code>, <code>change</code>, <code>structure</code>,{" "}
          <code>coastal</code> or <code>condition</code>. Map tiles: <code>GET /api/layers/&#123;layerId&#125;?year=2020</code>. Public
          instances are rate-limited; see the README to self-host.
        </p>

        <H2>Cite the Atlas</H2>
        <p className="mt-3 text-sm">
          Flora Carbon AI ({new Date().getFullYear()}). Flora Mangrove Atlas — open mangrove monitoring. Please also cite the underlying
          datasets listed above.
        </p>
      </main>
    </div>
  );
}
