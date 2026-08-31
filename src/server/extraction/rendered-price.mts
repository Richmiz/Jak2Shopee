export type RenderedPriceCandidate = {
  amount: number;
  text: string;
  parentText: string;
  className: string;
  parentClassName: string;
  fontSize: number;
  fontWeight: number;
  warmColor: boolean;
  lineThrough: boolean;
  top: number;
  titleTop: number;
  childCount: number;
};

const ancillaryPrice = /diprosip|diproship|ongkir|shipping|delivery|pengiriman|voucher|cashback|cicilan|per\s*bulan|biaya\s*layanan/i;
const previousPrice = /harga\s*(normal|awal)|sebelum|retail\s*price/i;

export function scoreRenderedPriceCandidate(candidate: RenderedPriceCandidate) {
  const context = `${candidate.className} ${candidate.parentClassName}`;
  const nearbyText = `${candidate.text} ${candidate.parentText}`;
  const priceCount = candidate.parentText.match(/Rp\s*[\d.]+/gi)?.length ?? 0;
  let score = Math.min(candidate.fontSize, 48) * 5;

  if (candidate.fontWeight >= 600) score += 20;
  if (candidate.warmColor) score += 35;
  if (candidate.childCount <= 1) score += 12;
  if (/price|harga/.test(context)) score += 50;
  if (/current|sale|final|special|product|main/.test(context)) score += 25;
  if (candidate.titleTop && candidate.top >= candidate.titleTop - 40 && candidate.top - candidate.titleTop < 420) score += 30;

  if (candidate.lineThrough) score -= 350;
  if (previousPrice.test(candidate.text) || (priceCount <= 1 && previousPrice.test(candidate.parentText))) score -= 180;
  if (ancillaryPrice.test(candidate.text) || (priceCount <= 1 && ancillaryPrice.test(nearbyText))) score -= 320;

  return score;
}

export function selectRenderedPrice(candidates: RenderedPriceCandidate[]) {
  return candidates
    .filter((candidate) => Number.isFinite(candidate.amount) && candidate.amount > 0)
    .map((candidate) => ({ ...candidate, score: scoreRenderedPriceCandidate(candidate) }))
    .sort((left, right) => right.score - left.score || right.fontSize - left.fontSize)[0]?.amount;
}
