"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CARBON_FRACTIONS, DEFAULT_CARBON_FRACTION, carbonEstimate } from "@/lib/analysis/carbon";
import type {
  ChangeResult,
  CoastalResult,
  ConditionResult,
  ExtentResult,
  ModuleResponse,
  StructureResult,
} from "@/lib/analysis/types";
import { fmtHa, fmtNum, fmtSigned, fmtTonnes } from "@/lib/format";
import { Card, Notice, Skeleton, SourceLine, Stat } from "./ui";
import type { ModuleState } from "./hooks";

const axis = { fontSize: 11, fill: "var(--text-muted)" };
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)", fontWeight: 600 },
  itemStyle: { color: "var(--text-primary)" },
};

function ModuleShell<T>({
  title,
  state,
  height,
  children,
  actions,
  id,
}: {
  title: string;
  state: ModuleState;
  height: number;
  children: (r: T, resp: ModuleResponse) => ReactNode;
  actions?: ReactNode;
  id: string;
}) {
  return (
    <Card title={title} actions={actions} id={id}>
      {state.status === "loading" ? (
        <div className="space-y-2">
          <Skeleton h={height} />
          <p className="text-xs text-ink-3">Computing in Earth Engine…</p>
        </div>
      ) : state.status === "error" ? (
        <Notice tone="error">{state.error}</Notice>
      ) : state.status === "done" ? (
        <>
          {children(state.data.result as T, state.data)}
          {state.data.warnings.length ? (
            <div className="mt-3 space-y-1">
              {state.data.warnings.map((w) => (
                <Notice key={w} tone="warning">
                  {w}
                </Notice>
              ))}
            </div>
          ) : null}
          <SourceLine ids={state.data.datasets} />
        </>
      ) : null}
    </Card>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button className="rounded px-1.5 py-0.5 text-xs text-ink-3 underline hover:text-ink no-print" onClick={onToggle} aria-expanded={open}>
      {open ? "Chart" : "Table"}
    </button>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-64 overflow-auto rounded border border-line">
      <table className="w-full text-xs tabular">
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ExtentWidget({ state }: { state: ModuleState }) {
  const [table, setTable] = useState(false);
  return (
    <ModuleShell<ExtentResult>
      id="extent"
      title="Mangrove extent"
      state={state}
      height={220}
      actions={state.status === "done" ? <TableToggle open={table} onToggle={() => setTable((t) => !t)} /> : null}
    >
      {(r) => {
        const years = new Map<number, { year: number; cgmd?: number; gmw?: number }>();
        r.cgmd.forEach((y) => years.set(y.year, { year: y.year, cgmd: y.ha }));
        r.gmwV3.forEach((y) => years.set(y.year, { ...(years.get(y.year) ?? { year: y.year }), gmw: y.ha }));
        const data = [...years.values()].sort((a, b) => a.year - b.year);
        const c2020 = r.cgmd.find((y) => y.year === 2020)?.ha;
        const g2020 = r.gmwV3.find((y) => y.year === 2020)?.ha;
        const spread = c2020 != null && g2020 != null && c2020 + g2020 > 0 ? (Math.abs(c2020 - g2020) / ((c2020 + g2020) / 2)) * 100 : null;
        const first = r.cgmd[0];
        const last = r.cgmd[r.cgmd.length - 1];
        const empty = data.every((d) => !d.cgmd && !d.gmw) && !r.gmw10m2020Ha;
        return (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Stat label={`Extent ${r.latest?.year ?? ""}`} value={fmtHa(r.latest?.ha)} sub={r.latest?.dataset === "cgmd" ? "CGMD, 30 m" : "GMW v3"} />
              <Stat label="Extent 2020 (10 m)" value={fmtHa(r.gmw10m2020Ha)} sub="GMW Sentinel-2" />
              <Stat
                label={first && last ? `Change ${first.year}–${last.year}` : "Change"}
                value={first && last ? fmtSigned(last.ha - first.ha, fmtHa) : "—"}
                sub={first && first.ha > 0 && last ? `${fmtSigned(((last.ha - first.ha) / first.ha) * 100, (n) => fmtNum(n, 1))}%` : undefined}
              />
            </div>
            {empty ? (
              <Notice>No mangroves are mapped in this area by any of the three datasets.</Notice>
            ) : table ? (
              <DataTable head={["Year", "CGMD (ha)", "GMW v3 (ha)"]} rows={data.map((d) => [d.year, d.cgmd ?? "", d.gmw ?? ""])} />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer>
                  <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
                    <Tooltip {...tooltipStyle} formatter={(v) => fmtHa(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} iconType="plainline" />
                    <Line name="CGMD (annual)" dataKey="cgmd" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    <Line name="GMW v3 (epochs)" dataKey="gmw" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "var(--surface-1)" }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {spread != null ? (
              <p className="mt-2 text-xs text-ink-2">
                <strong>Dataset agreement:</strong> the two independent 2020 maps differ by {fmtNum(spread, 1)}%. Treat this spread as a floor on
                map uncertainty here.
              </p>
            ) : null}
          </>
        );
      }}
    </ModuleShell>
  );
}

export function ChangeWidget({ state }: { state: ModuleState }) {
  const [table, setTable] = useState(false);
  return (
    <ModuleShell<ChangeResult>
      id="change"
      title="Gain & loss"
      state={state}
      height={200}
      actions={state.status === "done" ? <TableToggle open={table} onToggle={() => setTable((t) => !t)} /> : null}
    >
      {(r) => {
        const data = r.gmwV3.map((s) => ({ label: String(s.to), period: `${s.from}–${s.to}`, gain: s.gainHa, loss: -s.lossHa, net: s.netHa }));
        return (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Stat label="Gain 1996–2020" value={fmtHa(r.overall?.gainHa)} sub="GMW v3" />
              <Stat label="Loss 1996–2020" value={fmtHa(r.overall?.lossHa)} sub="GMW v3" />
              <Stat label="Net 1996–2020" value={fmtSigned(r.overall?.netHa, fmtHa)} sub={r.cgmdNet ? `CGMD ${r.cgmdNet.from}–${r.cgmdNet.to}: ${fmtSigned(r.cgmdNet.netHa, fmtHa)}` : undefined} />
            </div>
            {table ? (
              <DataTable head={["Period", "Gain (ha)", "Loss (ha)", "Net (ha)"]} rows={r.gmwV3.map((s) => [`${s.from}–${s.to}`, s.gainHa, s.lossHa, s.netHa])} />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer>
                  <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(_, p) => (p?.[0]?.payload as { period?: string } | undefined)?.period ?? ""}
                      formatter={(v, n) => [fmtHa(Math.abs(Number(v))), n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Gain" dataKey="gain" stackId="a" fill="var(--pos)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar name="Loss" dataKey="loss" stackId="a" fill="var(--neg)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-xs text-ink-3">Each bar is the change since the previous GMW epoch (labelled by end year). 2010→2015 spans five years, so bars are not equal time steps.</p>
          </>
        );
      }}
    </ModuleShell>
  );
}

export function StructureWidget({ state }: { state: ModuleState }) {
  const [cf, setCf] = useState<number>(DEFAULT_CARBON_FRACTION);
  return (
    <ModuleShell<StructureResult> id="structure" title="Height, biomass & carbon" state={state} height={260}>
      {(r) => <StructureBody r={r} cf={cf} setCf={setCf} />}
    </ModuleShell>
  );
}

function StructureBody({ r, cf, setCf }: { r: StructureResult; cf: number; setCf: (v: number) => void }) {
  const carbon = useMemo(() => carbonEstimate(r.agb.totalMg, r.soc?.totalMgC ?? null, cf), [r, cf]);
  const hasHeight = r.height2015.classes.some((c) => c.ha > 0);
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Mean height 2015" value={fmtNum(r.height2015.meanM, 1, "m")} sub={`90th pct ${fmtNum(r.height2015.p90M, 1, "m")}`} />
        <Stat label="Mean Hmax 2000" value={fmtNum(r.hmax2000MeanM, 1, "m")} sub="SRTM-based" />
        <Stat label="Mean AGB" value={fmtNum(r.agb.meanMgHa, 0, "Mg/ha")} sub={`Total ${fmtTonnes(r.agb.totalMg)}`} />
      </div>
      {hasHeight ? (
        <div className="h-[150px]">
          <ResponsiveContainer>
            <BarChart data={r.height2015.classes} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
              <Tooltip {...tooltipStyle} formatter={(v) => [fmtHa(Number(v)), "Area"]} />
              <Bar dataKey="ha" name="Area" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {r.height2015.classes.map((c) => (
                  <Cell key={c.label} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="-mt-1 text-center text-[11px] text-ink-3">Canopy height classes (TanDEM-X, 12 m)</p>
        </div>
      ) : (
        <Notice>No canopy-height pixels in this area.</Notice>
      )}

      <div className="mt-4 rounded-md bg-surface-2 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Screening carbon stock</h4>
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            Carbon fraction
            <select className="rounded border border-line bg-surface-1 px-1 py-0.5 no-print" value={cf} onChange={(e) => setCf(Number(e.target.value))}>
              {CARBON_FRACTIONS.map((c) => (
                <option key={c.value} value={c.value} title={c.label}>
                  {c.value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Aboveground C" value={fmtTonnes(carbon.agcMg, "t C")} sub={fmtTonnes(carbon.agcCo2eMg, "t CO₂e")} />
          <Stat label="Soil C (0–1 m)" value={carbon.socMg == null ? "—" : fmtTonnes(carbon.socMg, "t C")} sub={carbon.socMg == null ? "not configured" : fmtTonnes(carbon.socCo2eMg, "t CO₂e")} />
          <Stat label="Total" value={fmtTonnes(carbon.totalCo2eMg, "t CO₂e")} sub={carbon.socMg == null ? "aboveground only" : "AGC + SOC"} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">
          AGC = AGB × {cf} ({carbon.factors.carbonFractionSource.split("—")[1]?.trim() ?? "custom"}); CO₂e = C × 44/12. Belowground biomass is
          not included — it needs site allometry. Screening only: not valid for crediting without field plots.
        </p>
      </div>
    </>
  );
}

export function CoastalWidget({ state }: { state: ModuleState }) {
  return (
    <ModuleShell<CoastalResult> id="coastal" title="Tidal wetlands context" state={state} height={90}>
      {(r) => (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Mangrove loss" value={fmtHa(r.mangroveLossHa)} sub={r.period} />
          <Stat label="Mangrove gain" value={fmtHa(r.mangroveGainHa)} sub={r.period} />
          <Stat label="Tidal flats" value={fmtHa(r.tidalFlatHa)} sub="2014–2016" />
          <Stat label="Other tidal loss" value={fmtHa(r.otherTidalLossHa)} sub="marsh & flats" />
          <Stat label="Other tidal gain" value={fmtHa(r.otherTidalGainHa)} sub="marsh & flats" />
        </div>
      )}
    </ModuleShell>
  );
}

function MiniLine({ data, dataKey, name, color, domain }: { data: object[]; dataKey: string; name: string; color: string; domain?: [number, number] }) {
  return (
    <div className="h-[120px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={domain ?? ["auto", "auto"]} />
          <Tooltip {...tooltipStyle} formatter={(v) => [fmtNum(Number(v), 3), name]} />
          <Line dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: color }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConditionWidget({ state }: { state: ModuleState }) {
  const [table, setTable] = useState(false);
  return (
    <ModuleShell<ConditionResult>
      id="condition"
      title="Live condition (Sentinel-2)"
      state={state}
      height={250}
      actions={state.status === "done" ? <TableToggle open={table} onToggle={() => setTable((t) => !t)} /> : null}
    >
      {(r) => {
        const yoy = r.ndviYoY;
        const yoyLabel = yoy == null ? "—" : yoy <= -0.05 ? "▼ greenness down" : yoy >= 0.05 ? "▲ greenness up" : "● stable";
        return (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Stat label="Latest clear month" value={r.latest?.month ?? "—"} sub={r.latest ? `${r.latest.scenes} scenes` : "no clear data"} />
              <Stat label="NDVI (median)" value={fmtNum(r.latest?.ndvi, 2)} sub={`MVI ${fmtNum(r.latest?.mvi, 1)}`} />
              <Stat label="vs. a year earlier" value={yoy == null ? "—" : fmtSigned(yoy, (n) => fmtNum(n, 2))} sub={yoyLabel} />
            </div>
            {table ? (
              <DataTable
                head={["Month", "Scenes", "NDVI", "MVI", "Clear %"]}
                rows={r.months.map((m) => [m.month, m.scenes, m.ndvi ?? "", m.mvi ?? "", m.clearFraction == null ? "" : Math.round(m.clearFraction * 100)])}
              />
            ) : (
              <>
                <MiniLine data={r.months} dataKey="ndvi" name="NDVI" color="var(--series-3)" domain={[0, 1]} />
                <MiniLine data={r.months} dataKey="mvi" name="MVI" color="var(--series-1)" />
              </>
            )}
            <p className="mt-2 text-xs text-ink-3">
              Monthly medians of cloud-free pixels {r.maskUsed === "gmw-10m-2020" ? "inside the 2020 mangrove mask" : "over the whole area"}. Gaps are months with
              no clear view (monsoon cloud). MVI &gt; ~4.5 typically indicates mangrove canopy (Baloloy et al. 2020).
            </p>
          </>
        );
      }}
    </ModuleShell>
  );
}
