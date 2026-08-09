import { RebalancePlan } from "../../core/rebalance-optimizer";
import { TaxImpactReport } from "../tax";
import { SimulationOutputContract } from "../simulation/types";

/**
 * Summary of profit-guard analysis attached to every rebalance evaluation.
 * Surfaces notional profit at risk, tax costs, and deferral recommendations.
 * All monetary values in ₹ (INR).
 */
export interface ProfitGuardSummary {
  /** Sum of unrealized gains across all SELL actions in the plan. */
  total_notional_profit_at_risk: number;
  /** Estimated total tax if all SELL actions execute today (STCG + LTCG). */
  total_tax_if_sold_now: number;
  /** Estimated total tax if all SELLs deferred until LTCG threshold is crossed. */
  total_tax_if_deferred: number;
  /** = total_tax_if_sold_now − total_tax_if_deferred (positive = deferral saves money). */
  total_tax_saving_by_deferral: number;
  /** Sum of exit load costs (₹) across all MF SELL actions. */
  total_exit_load_cost: number;
  /** = total_tax_if_sold_now + total_exit_load_cost */
  total_friction_cost: number;
  /** Holdings for which the SELL was blocked/deferred by profit-guard guardrails. */
  deferred_actions: string[];
  /**
   * If true, the engine recommends directing new SIP/cash inflows into underweight
   * positions instead of selling overweight ones — avoids triggering a tax event.
   */
  cash_deploy_recommended: boolean;
  /**
   * Unused portion of the ₹1.25L annual LTCG exemption that could be harvested
   * tax-free via a sell+rebuy of qualifying LTCG holdings this financial year.
   */
  ltcg_exemption_opportunity?: number;
  /** ISO 8601 timestamp — when the profit-guard analysis was computed. */
  analysis_timestamp: string;
}

export interface RebalanceEvaluationOutput {
  status: "APPROVE_PENDING_USER" | "MODIFY" | "BLOCK";
  plan?: RebalancePlan;
  tax_impact?: TaxImpactReport;
  simulation_summary?: SimulationOutputContract;
  audit_id: string; // Ties exactly to the apreAuditLogs
  governance_reasoning?: string[];
  /** Profit-guard analysis — attached to every evaluation for advisor review. */
  profit_guard_summary?: ProfitGuardSummary;
}
