const nf = (max: number) => new Intl.NumberFormat(process.env.NEXT_PUBLIC_NUMBER_LOCALE ?? "en", { maximumFractionDigits: max });

/** Hectares with sensible precision. */
export function fmtHa(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return `${nf(a >= 1000 ? 0 : a >= 10 ? 1 : 2).format(v)} ha`;
}

export function fmtNum(v: number | null | undefined, digits = 1, unit = ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${nf(digits).format(v)}${unit ? ` ${unit}` : ""}`;
}

/** Large tonnages: 1.2 Mt, 45.3 kt, 830 t. */
export function fmtTonnes(v: number | null | undefined, suffix = "t"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${nf(2).format(v / 1e6)} M${suffix}`;
  if (a >= 1e3) return `${nf(1).format(v / 1e3)} k${suffix}`;
  return `${nf(0).format(v)} ${suffix}`;
}

export function fmtSigned(v: number | null | undefined, fmt: (n: number) => string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v))}`;
}
