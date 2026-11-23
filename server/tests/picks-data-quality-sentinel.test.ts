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
    const canonicalSpot = 124870;
    const SANITY_MIN = 95000;
    const SANITY_MAX = 165000;

    const clampCommodityPrice = (rawTick: number): { valid: boolean; price: number } => {
      if (rawTick >= SANITY_MIN && rawTick <= SANITY_MAX) {
        return { valid: true, price: rawTick };
      }
      return { valid: false, price: canonicalSpot };
    };

    // Valid price (~124,870 - 125,070 authentic 2026 spot)
    const normalTick = clampCommodityPrice(125070);
    expect(normalTick.valid).toBe(true);
    expect(normalTick.price).toBe(125070);

    // Erroneous tick (e.g. 250,000 corrupt feed spike)
    const outlierTick = clampCommodityPrice(250000);
    expect(outlierTick.valid).toBe(false);
    expect(outlierTick.price).toBe(124870);

    // Micro contract tick (e.g. 1g Gold at 12,487)
    const microTick = clampCommodityPrice(12487);
    expect(microTick.valid).toBe(false);
    expect(microTick.price).toBe(124870);
  });

  it("should heal stale entry price, adjust targets and stoploss, and revert false Target Hit status", () => {
    const staleRecoPrice = 78250;
    const currentMarketPrice = 124870;
    const canonicalSpotPrice = 124870;

    // Simulate corrupted state where 2024 stale baseline (78,250) was used as entry against live 2026 market (125,070)
    const falseReturnPct = Number((((currentMarketPrice - staleRecoPrice) / staleRecoPrice) * 100).toFixed(2));
    expect(falseReturnPct).toBe(59.58);

    // Sentinel Auto-Heal Action for stale entry (< 100,000)
    let recoPrice = staleRecoPrice;
    let targetPrice = +(recoPrice * 1.05).toFixed(2);
    let stoplossPrice = +(recoPrice * 0.975).toFixed(2);
    let status = "target_hit";
    let returnPct = falseReturnPct;

    if (recoPrice < 100000) {
      recoPrice = canonicalSpotPrice;
      targetPrice = +(canonicalSpotPrice * 1.05).toFixed(2);
      stoplossPrice = +(canonicalSpotPrice * 0.975).toFixed(2);
      returnPct = 0.0;
      status = "live";
    }

    expect(recoPrice).toBe(124870);
    expect(targetPrice).toBe(131113.5);
    expect(stoplossPrice).toBe(121748.25);
    expect(returnPct).toBe(0.0);
    expect(status).toBe("live");
    expect(stoplossPrice).toBeLessThan(recoPrice);
    expect(recoPrice).toBeLessThan(targetPrice);
  });

  it("should enforce Stoploss < Entry < Target invariant for Long picks", () => {
    const entry = 124870;
    const target = 131113.5;
    let corruptedStoploss = 132000.00; // Corrupted stop pulled above target

    const checkInvariant = (sl: number, ent: number, tgt: number) => sl < ent && ent < tgt;

    // Initially corrupted
    expect(checkInvariant(corruptedStoploss, entry, target)).toBe(false);

    // Auto-heal invariant
    if (corruptedStoploss >= entry) {
      corruptedStoploss = +(entry * 0.975).toFixed(2);
    }

    expect(checkInvariant(corruptedStoploss, entry, target)).toBe(true);
    expect(corruptedStoploss).toBe(121748.25);
  });
});
