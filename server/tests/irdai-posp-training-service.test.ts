import { describe, it, expect } from "vitest";
import { irdaiPospTrainingService } from "../services/irdai-posp-training-service";

describe("IRDAI POSP 15-Hour Training Service", () => {
	it("returns all 6 statutory modules totaling exactly 15 hours (900 minutes)", async () => {
		const { modules, summary } = await irdaiPospTrainingService.getModulesWithProgress("agent-test-posp");

		expect(modules).toHaveLength(6);
		expect(summary.totalRequiredMinutes).toBe(900); // 15 statutory hours
		expect(summary.hoursCompletedFormatted).toContain("15.0 hrs");

		// Module 1 must be unlocked by default
		expect(modules[0].isUnlocked).toBe(true);
		expect(modules[0].title).toContain("Principles of Insurance");
	});

	it("records active engagement heartbeat for an agent", async () => {
		const res = await irdaiPospTrainingService.recordHeartbeat("agent-test-posp", "posp-mod-1");
		expect(res.success).toBe(true);
		expect(res.minutesSpent).toBeGreaterThanOrEqual(1);
	});

	it("scores POSP exam, rejects failing score (< 35%)", async () => {
		// Submit incorrect answers
		const answers = { q1: 0, q2: 0, q3: 0, q4: 1 };
		const res = await irdaiPospTrainingService.submitExam(
			"agent-test-posp",
			answers,
			"Test Agent",
		);

		expect(res.passed).toBe(false);
		expect(res.scorePercentage).toBeLessThan(35);
		expect(res.certificateNumber).toBeUndefined();
	});

	it("scores POSP exam, approves passing score (>= 35%) and issues digital certificate", async () => {
		// Submit correct answers for q1, q2, q3, q4, q5
		const answers = {
			q1: 1, // correct
			q2: 2, // correct
			q3: 1, // correct
			q4: 0, // correct
			q5: 1, // correct
		};
		const res = await irdaiPospTrainingService.submitExam(
			"agent-test-posp",
			answers,
			"Sunita Verma",
		);

		expect(res.passed).toBe(true);
		expect(res.scorePercentage).toBeGreaterThanOrEqual(35);
		expect(res.certificateNumber).toBeDefined();
		expect(res.certificateNumber).toMatch(/^POSP-IRDAI-\d{4}-[A-F0-9]{6}$/);
	});
});
