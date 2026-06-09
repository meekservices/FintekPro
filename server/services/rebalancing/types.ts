import { RebalancePlan } from "../../core/rebalance-optimizer";
import { TaxImpactReport } from "../tax";
import { SimulationOutputContract } from "../simulation/types";

export interface RebalanceEvaluationOutput {
	status: "APPROVE_PENDING_USER" | "MODIFY" | "BLOCK";
	plan?: RebalancePlan;
	tax_impact?: TaxImpactReport;
	simulation_summary?: SimulationOutputContract;
	audit_id: string; // Ties exactly to the apreAuditLogs
	governance_reasoning?: string[];
}
