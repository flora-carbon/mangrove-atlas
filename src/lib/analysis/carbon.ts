import type { CarbonEstimate } from "./types";

/** Molecular weight ratio CO₂ : C. */
export const CO2_PER_C = 44 / 12;

export const CARBON_FRACTIONS = [
  { value: 0.47, label: "0.47 — IPCC 2006 default (AFOLU Vol. 4, Table 4.3)" },
  { value: 0.451, label: "0.451 — mangrove-specific value used by Global Mangrove Watch" },
] as const;

export const DEFAULT_CARBON_FRACTION = 0.47;

export function carbonEstimate(
  agbTotalMg: number | null,
  socTotalMgC: number | null,
  carbonFraction = DEFAULT_CARBON_FRACTION,
): CarbonEstimate {
  const source = CARBON_FRACTIONS.find((c) => c.value === carbonFraction)?.label ?? `${carbonFraction} (user supplied)`;
  const agcMg = agbTotalMg == null ? null : agbTotalMg * carbonFraction;
  const agcCo2eMg = agcMg == null ? null : agcMg * CO2_PER_C;
  const socCo2eMg = socTotalMgC == null ? null : socTotalMgC * CO2_PER_C;
  const totalCo2eMg = agcCo2eMg == null && socCo2eMg == null ? null : (agcCo2eMg ?? 0) + (socCo2eMg ?? 0);
  return {
    agcMg,
    agcCo2eMg,
    socMg: socTotalMgC,
    socCo2eMg,
    totalCo2eMg,
    factors: { carbonFraction, co2PerC: CO2_PER_C, carbonFractionSource: source },
  };
}
