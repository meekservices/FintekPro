import { describe, it, expect, beforeEach } from "vitest";
import {
	SurveillanceIncidentEngine,
	surveillanceIncidentEngine,
} from "../services/surveillance-incident-engine";

describe("SurveillanceIncidentEngine (GCR v1.0 & FASP-AI v1.0)", () => {
	beforeEach(() => {
		// Reset kill switches prior to test runs
		surveillanceIncidentEngine.resetKillSwitch("orders", "test_setup", "Resetting for clean test run");
		surveillanceIncidentEngine.resetKillSwitch("global", "test_setup", "Resetting for clean test run");
	});

	it("initializes with healthy baseline and inactive kill switch", () => {
		expect(surveillanceIncidentEngine).toBeInstanceOf(SurveillanceIncidentEngine);
		expect(surveillanceIncidentEngine.isKillSwitchActive("orders")).toBe(false);
		expect(surveillanceIncidentEngine.isKillSwitchActive("global")).toBe(false);

		const metrics = surveillanceIncidentEngine.getMetrics();
		expect(metrics.engineVersion).toBe("1.0.0");
		expect(metrics.killSwitchStates.orders.active).toBe(false);
	});

	it("immediately actions illegal activities by quarantining and tripping kill switch on critical severity", async () => {
		const result = await surveillanceIncidentEngine.reportIncident({
			domain: "illegal_activity",
			errorCode: "FRONT_RUNNING_SIGNATURE_DETECTED",
			severity: "critical",
			message: "Proprietary order placed within 200ms before client block trade",
			source: "trade-surveillance",
			context: {
				userId: "usr_suspicious_trader",
				orderId: "ord_front_run_123",
				symbol: "RELIANCE",
				amount: 5000000,
			},
		});

		expect(result.mitigated).toBe(true);
		expect(result.haltExecution).toBe(true);
		expect(result.quarantineOrder).toBe(true);
		expect(result.actionsTaken).toContain("TRANSACTION_QUARANTINED");
		expect(result.actionsTaken).toContain("KILL_SWITCH_ENGAGED");
		expect(result.actionsTaken).toContain("IMMUTABLE_AUDIT_LOGGED");

		// Orders kill switch must now be active
		expect(surveillanceIncidentEngine.isKillSwitchActive("orders")).toBe(true);
	});

	it("immediately actions process flow tampering and malformed payloads", async () => {
		const result = await surveillanceIncidentEngine.reportIncident({
			domain: "process_flow_error",
			errorCode: "IDEMPOTENCY_PAYLOAD_MISMATCH",
			severity: "high",
			message: "Idempotency key reused with modified payload parameters",
			source: "execution-guard:/api/orders",
			context: {
				userId: "usr_attacker",
				idempotencyKey: "idem_abc_123",
				url: "/api/orders",
			},
			requiresImmediateHalt: true,
		});

		expect(result.mitigated).toBe(true);
		expect(result.haltExecution).toBe(true);
		expect(result.quarantineOrder).toBe(true);
		expect(result.actionsTaken).toContain("PAYLOAD_REJECTED");
		expect(result.actionsTaken).toContain("TRANSACTION_QUARANTINED");
	});

	it("detects runtime error spikes and triggers immediate operational mitigations", async () => {
		// Report multiple runtime errors to reach threshold
		for (let i = 0; i < 16; i++) {
			await surveillanceIncidentEngine.reportIncident({
				domain: "runtime_error",
				errorCode: "HTTP_500_INTERNAL_SERVER_ERROR",
				severity: "high",
				message: `Upstream database timeout attempt #${i}`,
				source: "execution-engine:order_engine",
			});
		}

		// Because source contains execution/order and error count >= 15, kill switch trips
		expect(surveillanceIncidentEngine.isKillSwitchActive("orders")).toBe(true);
	});

	it("allows manual kill switch trip and disengage with audit tracking", () => {
		surveillanceIncidentEngine.tripKillSwitch(
			"orders",
			"Manual test emergency halt by RIA Compliance Officer",
			"admin_ria_officer",
			false,
		);

		expect(surveillanceIncidentEngine.isKillSwitchActive("orders")).toBe(true);

		const metricsAfterTrip = surveillanceIncidentEngine.getMetrics();
		expect(metricsAfterTrip.killSwitchStates.orders.active).toBe(true);
		expect(metricsAfterTrip.killSwitchStates.orders.triggeredBy).toBe("admin_ria_officer");

		// Reset kill switch
		surveillanceIncidentEngine.resetKillSwitch(
			"orders",
			"admin_ria_officer",
			"All verification checks passed, restoring order routing",
		);

		expect(surveillanceIncidentEngine.isKillSwitchActive("orders")).toBe(false);
	});

	it("supports incident retrieval, filtering, and manual administrative resolution", async () => {
		const report = await surveillanceIncidentEngine.reportIncident({
			domain: "illegal_activity",
			errorCode: "PROHIBITED_DETERMINISTIC_PROFIT_CLAIM",
			severity: "high",
			message: "Advisory brief promised guaranteed 25% annual return",
			source: "ai-governance-validator",
		});

		const incidents = surveillanceIncidentEngine.getIncidents({ domain: "illegal_activity" });
		expect(incidents.length).toBeGreaterThan(0);
		const found = incidents.find((i) => i.id === report.incidentId);
		expect(found).toBeDefined();
		expect(found?.status).toBe("active");

		// Resolve incident
		const resolved = await surveillanceIncidentEngine.resolveIncident(
			report.incidentId,
			"compliance_head",
			"AI prompt adjusted to remove deterministic profit language",
		);

		expect(resolved?.status).toBe("resolved");
		expect(resolved?.resolvedBy).toBe("compliance_head");
	});
});
