export type RoundingRule = 0 | 500 | 1000;

export function calculateSellingPrice(sourcePrice: number, policy: { markupPercent: number; minimumMarginPercent?: number; marketplaceBuffer?: number; roundingRule?: RoundingRule }) {
  const safeSourcePrice = Math.max(0, Math.round(sourcePrice));
  const margin = Math.max(policy.markupPercent, policy.minimumMarginPercent ?? 0);
  const unrounded = safeSourcePrice * (1 + margin / 100) + Math.max(0, policy.marketplaceBuffer ?? 0);
  const rule = policy.roundingRule ?? 0;
  return rule ? Math.ceil(unrounded / rule) * rule : Math.round(unrounded);
}
