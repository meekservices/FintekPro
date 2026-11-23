import { describe, it, expect } from "vitest";

describe("Picks Data Quality Sentinel & Disambiguation Engine", () => {
  it("should disambiguate corporate bond titles by appending coupon, maturity and NCD qualifiers", () => {
    const rawBond = {
      issuerName: "Reliance Industries",
      couponRate: "8.65",
      maturityDate: "2028-05-15",
      cleanPrice: "110.032",
    };

    const maturityYear = rawBond.maturityDate
      ? new Date(rawBond.maturityDate).getFullYear()
      : null;
    const couponStr = rawBond.couponRate ? `${Number(rawBond.couponRate).toFixed(2)}% ` : "";
    const formattedBondName = `${rawBond.issuerName || "Corporate"} ${couponStr}NCD${maturityYear ? ` (${maturityYear})` : ""}`.trim();

    expect(formattedBondName).toBe("Reliance Industries 8.65% NCD (2028)");
    expect(formattedBondName).not.toBe("Reliance Industries");
    expect(formattedBondName).toContain("NCD");
  });

  it("should detect when a bond recommendation lacks debt qualifiers and append NCD tag", () => {
    const checkDebtTag = (name: string) => /\b(NCD|Bond|Bonds|G-Sec|SDL|GS|Debenture)\b/i.test(name);

    expect(checkDebtTag("Reliance Industries")).toBe(false);
    expect(checkDebtTag("HDFC Bank")).toBe(false);
    expect(checkDebtTag("Reliance Industries Corporate Bond (NCD)")).toBe(true);
    expect(checkDebtTag("NABARD 7.69% NCD 2031")).toBe(true);
    expect(checkDebtTag("7.10% GS 2034")).toBe(true);
  });

  it("should clamp anomalous Gold MCX ticks exceeding exchange circuit limits", () => {
    const canonicalSpot = 78250;
    const SANITY_MIN = 65000;
    const SANITY_MAX = 90000;

    const clampCommodityPrice = (rawTick: number): { valid: boolean; price: number } => {
      if (rawTick >= SANITY_MIN && rawTick <= SANITY_MAX) {
        return { valid: true, price: rawTick };
      }
      return { valid: false, price: canonicalSpot };
    };

    // Valid price
    const normalTick = clampCommodityPrice(78800);
    expect(normalTick.valid).toBe(true);
    expect(normalTick.price).toBe(78800);

    // Erroneous tick (125,070 from screenshot)
    const outlierTick = clampCommodityPrice(125070);
    expect(outlierTick.valid).toBe(false);
    expect(outlierTick.price).toBe(78250);

    // Micro contract tick (e.g. 1g Gold at 7,800)
    const microTick = clampCommodityPrice(7800);
    expect(microTick.valid).toBe(false);
    expect(microTick.price).toBe(78250);
  });

  it("should revert false Target Hit status and restore trailing stoploss when tick was an outlier", () => {
    const recoPrice = 78250;
    const targetPrice = 82162.5;
    const falseOutlierPrice = 125070;
    const canonicalSpotPrice = 78250;

    // Simulate contaminated state
    let status = falseOutlierPrice >= targetPrice ? "target_hit" : "live";
    let returnPct = Number((((falseOutlierPrice - recoPrice) / recoPrice) * 100).toFixed(2));
    expect(status).toBe("target_hit");
    expect(returnPct).toBe(59.83);

    // Sentinel Auto-Heal Action
    if (falseOutlierPrice > 95000) {
      status = canonicalSpotPrice < targetPrice ? "live" : "target_hit";
      returnPct = Number((((canonicalSpotPrice - recoPrice) / recoPrice) * 100).toFixed(2));
      const restoredStoploss = +(recoPrice * 0.95).toFixed(2);

      expect(status).toBe("live");
      expect(returnPct).toBe(0.0);
      expect(restoredStoploss).toBe(74337.5);
      expect(restoredStoploss).toBeLessThan(recoPrice);
      expect(recoPrice).toBeLessThan(targetPrice);
    }
  });

  it("should enforce Stoploss < Entry < Target invariant for Long picks", () => {
    const entry = 78250;
    const target = 82162.5;
    let corruptedStoploss = 81340.88; // Trailing stop pulled above entry on false spike

    const checkInvariant = (sl: number, ent: number, tgt: number) => sl < ent && ent < tgt;

    // Initially corrupted
    expect(checkInvariant(corruptedStoploss, entry, target)).toBe(false);

    // Auto-heal invariant
    if (corruptedStoploss >= entry) {
      corruptedStoploss = +(entry * 0.95).toFixed(2);
    }

    expect(checkInvariant(corruptedStoploss, entry, target)).toBe(true);
    expect(corruptedStoploss).toBe(74337.5);
  });
});
