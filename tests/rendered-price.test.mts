import assert from "node:assert/strict";
import test from "node:test";
import { scoreRenderedPriceCandidate, selectRenderedPrice, type RenderedPriceCandidate } from "../src/server/extraction/rendered-price.mts";

function candidate(overrides: Partial<RenderedPriceCandidate>): RenderedPriceCandidate {
  return {
    amount: 60_900,
    text: "Rp 60.900",
    parentText: "Rp 101.900 Hemat 41% Rp 60.900",
    className: "product-price sale-price",
    parentClassName: "product-price-wrapper",
    fontSize: 24,
    fontWeight: 700,
    warmColor: true,
    lineThrough: false,
    top: 420,
    titleTop: 260,
    childCount: 0,
    ...overrides,
  };
}

test("selects the product price instead of shipping and previous prices", () => {
  const selected = selectRenderedPrice([
    candidate({ amount: 5_000, text: "Rp 5.000", parentText: "Diproship Rp 5.000", className: "shipping-fee", parentClassName: "shipping-row", fontSize: 14 }),
    candidate({ amount: 101_900, text: "Rp 101.900", lineThrough: true, fontSize: 14, warmColor: false }),
    candidate({}),
  ]);

  assert.equal(selected, 60_900);
});

test("strongly penalizes ancillary shipping amounts", () => {
  const product = candidate({});
  const shipping = candidate({ amount: 5_000, text: "Rp 5.000", parentText: "Ongkir Rp 5.000", fontSize: 28 });

  assert.ok(scoreRenderedPriceCandidate(product) > scoreRenderedPriceCandidate(shipping));
});
