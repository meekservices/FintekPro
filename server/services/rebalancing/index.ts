// @ts-nocheck
import { v4 as uuidv4 } from "uuid";
import { db } from "../../db";
import { apreAuditLogs } from "../../../shared/schema/ai";
import { RebalanceEvaluationOutput } from "./types";
import { PortfolioTargetModel, driftEngine, AssetWeight } from "../drift";
import { rebalanceOptimizer } from "../../core/rebalance-optimizer";
import { taxEstimationEngine } from "../tax";
import { apseEngine } from "../simulation";
import { stressTestingInterceptor } from "../stress-testing";
import { aiGovernanceEngine } from "../ai-governance";

export class RebalancePlanner {
	/**
	 * Evaluates the active allocation. If Drift is verified, safely builds a sequence of non-destructive mathematical checks, routing through Simulation and Governance.
	 */
	public async evaluatePortfolio(
		portfolioValuation: number,
		currentAllocation: AssetWeight[],
		targetModel: PortfolioTargetModel,
	): Promise<RebalanceEvaluationOutput> {
		const rebalanceAuditId = uuidv4();
		const auditTraceContext = {
			trigger: "drift_threshold",
			governanceDecision: "PENDING",
		};

		try {
			// 24.1 Systemic Resilience: Suspend automated rebalancing during extreme volatility
			if (marketRegimeDetector.detectBlackSwanEvent()) {
				return {
					status: "BLOCK",
					audit_id: rebalanceAuditId,
					governance_reasoning: [
						"SYSTEM SUSPENSION: 10σ Black Swan Trigger Active. Automated Rebalancing Disabled for Capital Protection.",
					],
				};
			}

			// 1. Structural Drift Detection
			const driftMatrix = driftEngine.calculateDrift(
				targetModel,
				currentAllocation,
			);

			if (!driftMatrix.has_drifted) {
				return {
					status: "BLOCK",
					audit_id: rebalanceAuditId,
					governance_reasoning: [
						"No structural drift threshold breached. Avoiding unnecessary churn.",
					],
				};
			}

			// 2. Instantiate Theoretical Optimize Plan & Tax Estimation
			const { plan, taxContexts } = rebalanceOptimizer.generateOptimizedPlan(
				driftMatrix,
				portfolioValuation,
			);
			const taxEstimation =
				taxEstimationEngine.estimateRebalanceImpact(taxContexts);

			// 3. APSE Execution: Simulate Post-Rebalance State securely
			const simulatedState = await apseEngine.runFullSimulation({
				recommendation_id: rebalanceAuditId,
				portfolio: targetModel.target_allocation, // Assuming the post-rebalance perfectly matches target allocations
				time_horizon: "1y",
				risk_profile: "medium", // Pull actual profile from DB mapping safely in prod
				market_assumptions: { base_volatility: 0.15 },
			});

			// 4. Governance Proxy Check: Verify APSE simulation mathematics pass logic parameters
			const stressTestRules = { max_drawdown_limit: 0.25, var_limit: -0.18 };
			const simulatedStressCheck =
				stressTestingInterceptor.evaluateSimulationViolations(
					simulatedState,
					stressTestRules,
				);

			if (simulatedStressCheck.status === "BLOCK") {
				this.persistAudit(
					rebalanceAuditId,
					targetModel.portfolio_id,
					plan,
					simulatedState,
					"BLOCK",
					auditTraceContext.trigger,
				);
				return {
					status: "BLOCK",
					audit_id: rebalanceAuditId,
					governance_reasoning: [
						simulatedStressCheck.reason || "Severe Simulation Override",
					],
				};
			}

			const aageCheck = await aiGovernanceEngine.validateAndResolve({
				user_id: "system-rebalance",
				query: `Rebalancing portfolio ${targetModel.portfolio_id}`,
				ai_output: plan,
				user_profile: { risk_profile: "medium", investment_horizon: "long" },
				trace_id: rebalanceAuditId,
			});

			if (aageCheck.decision === "BLOCK") {
				this.persistAudit(
					rebalanceAuditId,
					targetModel.portfolio_id,
					plan,
					simulatedState,
					"BLOCK",
					auditTraceContext.trigger,
				);
				return {
					status: "BLOCK",
					audit_id: rebalanceAuditId,
					governance_reasoning: ["AAGE Compliance Block: Policy Overreach."],
				};
			}

			// 5. Success Path: Escalate to User/Advisor approval
			this.persistAudit(
				rebalanceAuditId,
				targetModel.portfolio_id,
				plan,
				simulatedState,
				"APPROVE",
				auditTraceContext.trigger,
			);

			return {
				status: "APPROVE_PENDING_USER", // Forces Human-In-The-Loop Execution Guard
				plan,
				tax_impact: taxEstimation,
				simulation_summary: simulatedState,
				audit_id: rebalanceAuditId,
			};
		} catch (e: any) {
			console.error("[APRE ROOT FAULT]", e);
			return {
				status: "BLOCK",
				audit_id: rebalanceAuditId,
				governance_reasoning: [
					"Internal Orchestration Error: Safe Mode Enacted.",
				],
			};
		}
	}

	private persistAudit(
		id: string,
		portfolioId: string,
		plan: any,
		sim: any,
		decision: string,
		trigger: string,
	) {
		db.insert(apreAuditLogs)
			.values({
				id: id,
				portfolioId: portfolioId,
				triggerType: trigger,
				generatedPlan: plan,
				simulationSummary: sim,
				governanceDecision: decision,
				approvalStatus:
					decision === "APPROVE" ? "pending_user_approval" : "blocked",
				executionStatus: "not_started",
			})
			.execute()
			.catch((e) => console.error("Failed to commit APRE audit state", e));
	}
}

export const autonomousRebalancePlanner = new RebalancePlanner();
