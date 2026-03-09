export function calculateCAGR(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function formatMarketCap(cap: number | null): string {
  if (!cap) return "N/A";
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `₹${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e7) return `₹${(cap / 1e7).toFixed(2)} Cr`;
  return `₹${cap.toFixed(0)}`;
}

export function formatPercent(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return `${(val * 100).toFixed(2)}%`;
}

export function formatPrice(val: number | null, currency = "INR"): string {
  if (val === null || val === undefined) return "N/A";
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return val.toFixed(2);
}
