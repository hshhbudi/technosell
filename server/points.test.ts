import { describe, expect, it } from "vitest";
import {
  appPointPriceCents,
  appPointsStep,
  appPointsTotalCents,
  appPointsValue,
} from "@shared/points";

describe("app points pricing", () => {
  const product = {
    supplierPriceCents: 800,
    markupPercent: 8,
    quantity: 1000,
    points: null,
  };

  it("derives the point price from the supplier price and the adopted markup", () => {
    expect(appPointPriceCents(product)).toBeCloseTo(0.864, 10);
  });

  it("keeps the supplier base price unchanged when points equal the minimum quantity", () => {
    expect(appPointsTotalCents(product, 1000)).toBe(864);
  });

  it("recalculates the price for any points count", () => {
    expect(appPointsTotalCents(product, 2500)).toBe(2160);
    expect(appPointsTotalCents(product, 1)).toBe(1);
  });

  it("uses the owner points when saved, otherwise the supplier minimum", () => {
    expect(appPointsValue(product)).toBe(1000);
    expect(appPointsValue({ ...product, points: 1500 })).toBe(1500);
  });

  it("offers practical increments without fixed quantity options", () => {
    expect(appPointsStep(5)).toBe(1);
    expect(appPointsStep(500)).toBe(10);
    expect(appPointsStep(1500)).toBe(100);
  });
});
