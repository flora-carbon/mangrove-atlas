"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { DATASETS, citationFor, type DatasetId } from "@/lib/datasets";

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "h-7 px-2.5 text-xs", md: "h-9 px-3 text-sm" };
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-strong dark:text-[#06140e]",
    secondary: "border border-line bg-surface-1 text-ink hover:bg-surface-2",
    ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ title, actions, children, id }: { title: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-lg border border-line bg-surface-1 p-4 break-inside-avoid">
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{title}</h3>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="tabular break-words text-lg font-semibold leading-snug text-ink">{value}</div>
      {sub ? <div className="text-xs text-ink-3">{sub}</div> : null}
    </div>
  );
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="animate-pulse rounded-md bg-surface-2" style={{ height: h }} aria-hidden />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-line bg-surface-2 text-ink-2",
    warning: "border-transparent bg-[var(--warning-bg)] text-[var(--warning-ink)]",
    error: "border-[var(--critical)]/40 bg-[var(--critical)]/10 text-ink",
  };
  const icon = { info: "ℹ", warning: "⚠", error: "✕" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${styles[tone]}`}>
      <span aria-hidden className="font-bold">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SourceLine({ ids }: { ids: DatasetId[] }) {
  return (
    <p className="mt-3 text-[11px] leading-snug text-ink-3">
      Source: {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? "; " : ""}
          <a className="underline decoration-dotted hover:text-ink-2" href={`/methods#${id}`}>
            {DATASETS[id].shortName} {DATASETS[id].version}
          </a>{" "}
          ({DATASETS[id].licence})
        </span>
      ))}
    </p>
  );
}

export function DatasetDialog({ id, onClose }: { id: DatasetId | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
  }, [id]);
  const ds = id ? DATASETS[id] : null;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-xl border border-line bg-surface-1 p-0 text-ink backdrop:bg-black/40"
    >
      {ds ? (
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">{ds.name}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              ✕
            </Button>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
            {(
              [
                ["Producer", ds.producer],
                ["Version", ds.version],
                ["Period", ds.period],
                ["Resolution", ds.resolution],
                ["Sensor", ds.sensor],
                ["Licence", ds.licence],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {ds.notes ? <p className="mt-3 text-sm text-ink-2">{ds.notes}</p> : null}
          <p className="mt-3 rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">{citationFor(ds.id)}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a className="text-brand underline" href={ds.url} target="_blank" rel="noreferrer">
              Dataset page ↗
            </a>
            <a className="text-brand underline" href={ds.licenceUrl} target="_blank" rel="noreferrer">
              Licence ↗
            </a>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
