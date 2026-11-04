import { describe, it, expect } from "vitest";
import {
  marqueeBrokerageService,
  MARQUEE_BROKERAGES,
} from "../services/screener/marquee-brokerage-service";

describe("FintekPro Marquee Institutional Brokerage Engine (GCR v1.0 & FASP-AI v1.0)", () => {
  describe("1. Marquee Catalog Integrity & Tier Demarcation", () => {
    it("includes premier global bulge bracket desks", () => {
      const globalDesks = MARQUEE_BROKERAGES.filter(
        (b) => b.tier === "GLOBAL_BULGE_BRACKET"
      );
      const names = globalDesks.map((d) => d.name);

      expect(names).toContain("Goldman Sachs");
      expect(names).toContain("Morgan Stanley");
      expect(names).toContain("Jefferies");
      expect(names).toContain("JPMorgan");
      expect(names).toContain("Nomura");
      expect(names).toContain("UBS");
      expect(names).toContain("CLSA");
    });

    it("includes top domestic tier-1 institutional desks", () => {
      const domesticDesks = MARQUEE_BROKERAGES.filter(
        (b) => b.tier === "DOMESTIC_TIER_1"
      );
      const names = domesticDesks.map((d) => d.name);

      expect(names).toContain("Kotak Institutional Equities");
      expect(names).toContain("Motilal Oswal");
      expect(names).toContain("ICICI Securities");
      expect(names).toContain("Axis Capital");
      expect(names).toContain("HDFC Securities");
      expect(names).toContain("Nuvama Institutional Equities");
    });
  });

  describe("2. Headline NLP Extraction & Target Parsing", () => {
    it("parses target price, firm name, action, and rating from standard news headlines", () => {
      const sampleNews = [
        {
          title: "Morgan Stanley raises target to ₹3,400 on Reliance Industries; reiterates Overweight",
          summary: "Morgan Stanley maintains positive outlook with price target ₹3,400 citing telecom ARPU expansion.",
          published_at: "2026-11-01T08:00:00Z",
          source: "Financial Express",
        },
        {
          title: "Jefferies cuts target price of Infosys to Rs 1,750, maintains Hold",
          summary: "Jefferies reduces FY27 growth estimate and sets TP of Rs 1,750.",
          published_at: "2026-11-02T09:00:00Z",
          source: "CNBC TV18",
        },
        {
          title: "Kotak Institutional Equities starts coverage on Zomato with Add rating, TP ₹320",
          summary: "Kotak initiates coverage with ₹320 target price.",
          published_at: "2026-11-03T10:00:00Z",
          source: "Economic Times",
        },
      ];

      const parser = (marqueeBrokerageService as any).parseMarqueeViewsFromNews.bind(
        marqueeBrokerageService
      );
      const views = parser(sampleNews, 3000);

      expect(views.length).toBeGreaterThanOrEqual(2);

      const msCall = views.find((v: any) => v.firm === "Morgan Stanley");
      expect(msCall).toBeDefined();
      expect(msCall.targetPrice).toBe(3400);
      expect(msCall.rating).toBe("BUY");
      expect(msCall.action).toBe("UPGRADE");
      expect(msCall.tier).toBe("GLOBAL_BULGE_BRACKET");

      const jefferiesCall = views.find((v: any) => v.firm === "Jefferies");
      expect(jefferiesCall).toBeDefined();
      expect(jefferiesCall.targetPrice).toBe(1750);
      expect(jefferiesCall.rating).toBe("HOLD");
      expect(jefferiesCall.action).toBe("DOWNGRADE");
    });
  });

  describe("3. Quoting Summary & Explainability (FASP-AI v1.0)", () => {
    it("generates deterministic synthesis with explicit analyst count, average target, and top houses", () => {
      const summaryGen = (marqueeBrokerageService as any).generateQuotingSummary.bind(
        marqueeBrokerageService
      );

      const mockViews = [
        {
          firm: "Goldman Sachs",
          tier: "GLOBAL_BULGE_BRACKET",
          rating: "BUY",
          targetPrice: 3200,
          upsidePercent: 18.5,
          headline: "GS sees strong growth",
          quoteSnippet: "GS sees strong growth",
          publishedDate: "2026-11-01",
          source: "Media",
        },
        {
          firm: "Kotak Institutional Equities",
          tier: "DOMESTIC_TIER_1",
          rating: "BUY",
          targetPrice: 3100,
          upsidePercent: 14.8,
          headline: "Kotak maintains Buy",
          quoteSnippet: "Kotak maintains Buy",
          publishedDate: "2026-11-01",
          source: "Media",
        },
      ];

      const summary = summaryGen("RELIANCE", 3150, 16.7, 34, mockViews);

      expect(summary).toContain("Street consensus across 34 analysts");
      expect(summary).toContain("₹3,150");
      expect(summary).toContain("+16.7% upside");
      expect(summary).toContain("Goldman Sachs (Target: ₹3,200)");
      expect(summary).toContain("Kotak Institutional Equities (Target: ₹3,100)");
    });
  });

  describe("4. GCR v1.0 Compliance & Error Handling", () => {
    it("gracefully returns null for empty or invalid symbol", async () => {
      const res = await marqueeBrokerageService.getMarqueeReference("");
      expect(res).toBeNull();
    });
  });
});
