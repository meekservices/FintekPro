import { SimulationOutputContract } from "../simulation/types";

export interface StressTestThresholds {
  max_drawdown_limit: number;
  var_limit: number; // Note: Value at Risk is typically negative. So a -0.1 limit means we block if VaR < -0.1
}

export class StressTestingGovernanceInterceptor {

  /**
   * 7.1 Pre-Execution Check
   * Operates as an instant middleware interceptor feeding directly into AAGE. 
   * Returns a Governance 'BLOCK' or 'MODIFY' signal if structural math violations exist.
   */
  public evaluateSimulationViolations(simContext: SimulationOutputContract, thresholds: StressTestThresholds): { status: "PASS" | "BLOCK" | "MODIFY", reason?: string } {
    
    // Check 1: Maximum Drawdown Limitation
    if (simContext.max_drawdown > thresholds.max_drawdown_limit) {
      return { 
        status: "BLOCK", 
        reason: `CRITICAL: Simulated Max Drawdown (${(simContext.max_drawdown * 100).toFixed(2)}%) exceeds stringent threshold (${(thresholds.max_drawdown_limit * 100).toFixed(2)}%)` 
      };
    }

    // Check 2: Value at Risk (95% CI) Limitation
    // If threshold is -10% (-0.1), and VaR is -15% (-0.15), it represents a violation.
    if (simContext.value_at_risk_95 < thresholds.var_limit) {
      return { 
        status: "BLOCK", 
        reason: `CRITICAL: Value at Risk P95 (${(simContext.value_at_risk_95 * 100).toFixed(2)}%) exceeds severe downside floor limit (${(thresholds.var_limit * 100).toFixed(2)}%)` 
      };
    }

    // Check 3: Bear Scenario Verification
    // A soft-modifier alert: If Bear scenario dictates a crash beneath standard volatility 
    if (simContext.scenario_results.bear.drawdown > thresholds.max_drawdown_limit) {
      return {
        status: "MODIFY",
        reason: "WARNING: Base metrics passed, but simulated Bear Scenario breached severe drawdown conditions. Appending manual Risk Override UI warnings."
      };
    }

    return { status: "PASS" };
  }
}

export const stressTestingInterceptor = new StressTestingGovernanceInterceptor();
