import type { DocText, Located } from "./locate";

export type Amount = { value: number; currency: string; display: string; at: Located };

const CURRENCY = /(₹|rs\.?|inr|rupees|usd|us\$|\$|eur|€|gbp|£)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr\.?|million|mn|thousand)?|([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|million)?\s*(?:indian )?(rupees|inr|usd|dollars|euros?)/gi;

const MULT: Record<string, number> = { lakh: 1e5, lac: 1e5, crore: 1e7, cr: 1e7, million: 1e6, mn: 1e6, thousand: 1e3 };

function currencyOf(sym: string): string {
  const s = sym.toLowerCase().replace(".", "");
  if (["₹", "rs", "inr", "rupees"].includes(s)) return "INR";
  if (["usd", "us$", "$", "dollars"].includes(s)) return "USD";
  if (["eur", "€", "euro", "euros"].includes(s)) return "EUR";
  return "GBP";
}

export function formatInr(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(value % 1e7 ? 2 : 0)} crore`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(value % 1e5 ? 2 : 0)} lakh`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function findAmounts(doc: DocText): Amount[] {
  const out: Amount[] = [];
  for (const m of doc.findAll(CURRENCY, 200)) {
    const g = m.match;
    const sym = g[1] ?? g[6];
    const num = Number((g[2] ?? g[4] ?? "").replace(/,/g, ""));
    const unit = (g[3] ?? g[5] ?? "").toLowerCase().replace(/s$|\.$/g, "");
    if (!sym || !Number.isFinite(num) || num === 0) continue;
    const value = num * (MULT[unit] ?? 1);
    const currency = currencyOf(sym);
    if (value < 100) continue; // section numbers, percentages and the like
    out.push({ value, currency, display: currency === "INR" ? formatInr(value) : `${currency} ${value.toLocaleString("en-US")}`, at: m });
  }
  return out;
}
