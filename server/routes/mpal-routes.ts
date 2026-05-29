import { Router } from "express";
import { investmentRouter } from "../services/mpal/core/investmentRouter";
import { creditRouter } from "../services/mpal/core/creditRouter";
import { financialProfileEngine } from "../services/profile/financialProfileEngine";
import { logger } from "../logger";

export const mpalRouter = Router();

// ==========================================
// MPAL: Financial Profile
// ==========================================
mpalRouter.get("/financial-profile", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Call the engine to build a live profile (Alpaca + IRIS + Credit)
    const profile = await financialProfileEngine.buildProfile(req.user!.id);
    
    // Add additional metadata for UI
    const enrichedProfile = {
      ...profile,
      id: `prof_${req.user!.id}`,
      riskScore: "750", // Still mocked for now, but scoring engine could be called here
      lastUpdated: new Date().toISOString()
    };
    
    res.json(enrichedProfile);
  } catch (error) {
    logger.error("Error fetching financial profile", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// MPAL: Broker / Investments
// ==========================================
mpalRouter.get("/broker/:assetClass/quotes", async (req, res) => {
  try {
    const { assetClass } = req.params;
    const quotes = await investmentRouter.getQuote(assetClass, req.query.symbol as string || "AAPL");
    res.json([quotes]); // Return array to match UI expectation
  } catch (error) {
    logger.error(`Error fetching quotes for ${req.params.assetClass}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.get("/broker/:assetClass/positions", async (req, res) => {
  try {
    const { assetClass } = req.params;
    const positions = await investmentRouter.getPositions(assetClass, req.user);
    res.json(positions);
  } catch (error) {
    logger.error(`Error fetching positions for ${req.params.assetClass}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.post("/broker/:assetClass/orders", async (req, res) => {
  try {
    const { assetClass } = req.params;
    const order = await investmentRouter.executeOrder(assetClass, req.body, req.user);
    res.json(order);
  } catch (error) {
    logger.error(`Error executing order for ${req.params.assetClass}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// MPAL: Credit / Borrowing
// ==========================================
mpalRouter.get("/credit/products", async (req, res) => {
  try {
    // In a real system, you'd fetch from ProviderRegistry or db
    // Mocking 2 products for UI
    const products = [
      {
        id: "prod_1",
        providerId: "M2P_LENDING",
        productType: "PERSONAL_LOAN",
        name: "Portfolio-Backed Express Loan",
        description: "Instant liquidity against your mutual fund portfolio.",
        interestRate: 10.5,
        minAmount: 10000,
        maxAmount: 500000,
        maxTenureMonths: 36,
        isActive: true
      },
      {
        id: "prod_2",
        providerId: "SETU_AGGREGATOR",
        productType: "CREDIT_CARD",
        name: "FintekPro Premium Card",
        description: "High rewards credit card based on your net worth.",
        interestRate: 18.0,
        minAmount: 50000,
        maxAmount: 1000000,
        maxTenureMonths: 0,
        isActive: true
      }
    ];
    res.json(products);
  } catch (error) {
    logger.error("Error fetching credit products", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.get("/credit/eligibility", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const scoring = await creditScoringEngine.scoreUser(req.user!.id);
    res.json(scoring);
  } catch (error) {
    logger.error("Error evaluating credit eligibility", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.post("/credit/applications", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const application = {
      ...req.body,
      userId: req.user!.id
    };
    const result = await creditRouter.routeApplication(application);
    res.json(result);
  } catch (error) {
    logger.error("Error submitting credit application", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.get("/credit/applications", async (req, res) => {
  try {
    // Returning empty array for now since we haven't wired the db fetch
    res.json([]);
  } catch (error) {
    logger.error("Error fetching credit applications", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
