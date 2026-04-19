import express, { Response } from "express";
import { B2BRequest, b2bAuthMiddleware, b2bRateLimiter } from "../../../middleware/b2b-auth";
import { webhookDispatcher } from "../../../services/b2b-webhook-dispatcher";
import { failEngine } from "../../../services/ai-governance"; // Accessing FAIL Orchestrator logic
import { urcaeEngine } from "../../../services/allocation"; // Direct to URCAE Brain Array
import { v4 as uuidv4 } from "uuid";

export const b2bAdvisoryRouter = express.Router();
export const b2bSimulationRouter = express.Router();

b2bAdvisoryRouter.use(b2bAuthMiddleware);
b2bAdvisoryRouter.use(b2bRateLimiter);

b2bSimulationRouter.use(b2bAuthMiddleware);
b2bSimulationRouter.use(b2bRateLimiter);

/**
 * 1. AI ADVISORY GENERATION (Tenant-Isolated)
 * Request drops directly into the overarching URCAE logic array, intercepting Governance matrices natively.
 */
b2bAdvisoryRouter.post("/generate", async (req: B2BRequest, res: Response) => {
    const { user_profile, market_state, is_partner_override, partner_ria_id } = req.body;

    if (!user_profile || !market_state) {
        return res.status(400).json({ error: "Missing required payload keys (user_profile, market_state)." });
    }

    const tenantId = req.b2bClient!.id;
    const governanceMode = req.b2bClient!.governanceMode as "STRICT" | "DELEGATED";
    const processId = uuidv4();

    // Emitting 202 securely back to caller, dropping compute requirement to asynchronous pipelines
    res.status(202).json({ 
       message: "Advisory processing accepted.",
       process_id: processId,
       tenant_stamp: tenantId
    });

    // --- ASYNC LOGIC LOOP AHEAD ---
    setTimeout(async () => {
        try {
           // Direct input specifically to the Internal Portfolio Brain Module
           const targetAllocation = await urcaeEngine.generateTargetAllocation({
              user_profile: {
                 user_id: `external-${tenantId}-${processId}`,
                 risk_profile: user_profile.risk_profile || "medium",
                 investment_horizon: user_profile.horizon || "long",
                 liquidity_needs: user_profile.liquidity || "medium"
              },
              market_state: {
                 volatility: market_state.volatility || 0.15,
                 interest_rates: market_state.rates || 0.05,
                 macro_regime: market_state.regime || "neutral"
              },
              b2b_context: {
                 is_partner_override: !!is_partner_override,
                 partner_ria_id: partner_ria_id,
                 delegated_governance_mode: governanceMode
              }
           });

           // Push outcome backward onto Partner's webhook array
           await webhookDispatcher.dispatchPayload(tenantId, "ADVISORY.COMPLETED", {
               process_id: processId,
               result: targetAllocation
           });

        } catch (e: any) {
           await webhookDispatcher.dispatchPayload(tenantId, "ADVISORY.FAILED", {
               process_id: processId,
               error: e.message
           });
        }
    }, 100); 
});

/**
 * 2. STRUCTURAL APSE SIMULATION ARRAY
 * Lets third-party platforms directly query standard geometric mappings inside our Monte Carlo array mapping.
 */
b2bSimulationRouter.post("/run", async (req: B2BRequest, res: Response) => {
    return res.status(501).json({ error: "APSE Direct Gateway integration pending Phase 2 deployment pipeline." });
});
