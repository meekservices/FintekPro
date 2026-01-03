import { Router, Request, Response } from "express";
import { agentProspectWizardService, ProspectPortfolioHolding, ProspectRiskProfile } from "../services/agent-prospect-wizard-service";
import { z } from "zod";

const router = Router();

const createProspectSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  pan: z.string().length(10).optional(),
  clientType: z.string().optional(),
  indicativeRiskProfile: z.string().optional(),
  notes: z.string().optional()
});

const riskProfileSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
  investmentHorizon: z.enum(['short_term', 'medium_term', 'long_term']),
  primaryGoal: z.string(),
  monthlyIncome: z.number().optional(),
  existingInvestments: z.number().optional(),
  liquidityNeeds: z.enum(['low', 'medium', 'high']).optional()
});

const portfolioHoldingSchema = z.object({
  productType: z.string(),
  productName: z.string(),
  quantity: z.number(),
  currentValue: z.number(),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  isin: z.string().optional(),
  category: z.string().optional()
});

const generateProposalSchema = z.object({
  prospectId: z.string(),
  prospectData: z.object({
    name: z.string(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    pan: z.string().optional()
  }),
  holdings: z.array(portfolioHoldingSchema),
  riskProfile: riskProfileSchema,
  freshInvestmentAmount: z.number().min(0)
});

router.post("/prospects", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const data = createProspectSchema.parse(req.body);
    const prospectId = await agentProspectWizardService.createProspect(agentId, data);
    
    res.json({ success: true, prospectId });
  } catch (error: any) {
    console.error("[Agent Wizard] Error creating prospect:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/prospects", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospects = await agentProspectWizardService.getAgentProspects(agentId);
    res.json({ success: true, prospects });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching prospects:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/prospects/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.json({ success: true, prospect });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching prospect:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/prospects/:id/portfolio", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect || prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const holdings = z.array(portfolioHoldingSchema).parse(req.body.holdings);
    await agentProspectWizardService.updateProspectPortfolio(req.params.id, holdings);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating portfolio:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/prospects/:id/risk-profile", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect || prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const riskProfile = riskProfileSchema.parse(req.body);
    await agentProspectWizardService.updateProspectRiskProfile(req.params.id, riskProfile);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating risk profile:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/analyze-portfolio", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { holdings, riskProfile } = req.body;
    const parsedHoldings = z.array(portfolioHoldingSchema).parse(holdings);
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    
    const analysis = agentProspectWizardService.analyzePortfolio(parsedHoldings, parsedRiskProfile);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error("[Agent Wizard] Error analyzing portfolio:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/rebalancing-suggestions", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { holdings, riskProfile, analysis } = req.body;
    const parsedHoldings = z.array(portfolioHoldingSchema).parse(holdings);
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    
    const suggestions = agentProspectWizardService.generateRebalancingRecommendations(
      parsedHoldings, 
      parsedRiskProfile, 
      analysis
    );
    res.json({ success: true, suggestions });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating rebalancing:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/fresh-investment-suggestions", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { riskProfile, investmentAmount, existingHoldings } = req.body;
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    const parsedHoldings = existingHoldings ? z.array(portfolioHoldingSchema).parse(existingHoldings) : [];
    
    const suggestions = await agentProspectWizardService.generateFreshInvestmentSuggestions(
      parsedRiskProfile,
      investmentAmount || 0,
      parsedHoldings
    );
    res.json({ success: true, suggestions });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating fresh investments:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/generate-proposal", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const data = generateProposalSchema.parse(req.body);
    
    const proposal = await agentProspectWizardService.createCombinedProposal(
      agentId,
      data.prospectId,
      data.prospectData,
      data.holdings,
      data.riskProfile,
      data.freshInvestmentAmount
    );
    
    res.json({ success: true, proposal });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating proposal:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/proposals/:id/share", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { channel } = req.body;
    if (!['email', 'whatsapp', 'sms'].includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }

    const result = await agentProspectWizardService.shareProposal(req.params.id, channel, agentId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Agent Wizard] Error sharing proposal:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/public/proposal/:token", async (req: Request, res: Response) => {
  try {
    const proposal = await agentProspectWizardService.getProposalByToken(req.params.token);
    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found or expired" });
    }
    res.json({ success: true, proposal });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching public proposal:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
