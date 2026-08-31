const listedRupiahPrice = /\bharga\s+Rp\s*((?:\d\s*)+(?:\.\s*(?:\d\s*)+)*)/i;

export function extractListedRupiahPrice(value: string) {
  const digits = value.match(listedRupiahPrice)?.[1]?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function formatGroupedInteger(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}
