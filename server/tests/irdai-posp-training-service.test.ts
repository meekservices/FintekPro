import { describe, it, expect } from "vitest";
import { irdaiPospTrainingService, POSP_QUESTION_BANK } from "../services/irdai-posp-training-service";

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
		const answers: Record<string, number> = {};
		for (const q of POSP_QUESTION_BANK) {
			answers[q.id] = q.correctIndex;
		}
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

	it("provides practice mock questions and evaluates diagnostic practice test", async () => {
		const practice = irdaiPospTrainingService.getPracticeQuestions();
		expect(practice.questions.length).toBeGreaterThanOrEqual(15);
		expect(practice.passingPercentage).toBe(35);
		expect(practice.courseId).toBe("irdai-posp");

		const answers: Record<string, number> = {};
		// Answer 20 questions correctly out of the paper
		for (let i = 0; i < Math.min(20, practice.questions.length); i++) {
			const q = practice.questions[i];
			answers[q.id] = q.correctIndex;
		}

		const result = await irdaiPospTrainingService.submitPracticeTest(answers, "agent-test-posp");

		expect(result.totalQuestions).toBe(practice.questions.length);
		expect(result.correctCount).toBeGreaterThanOrEqual(18);
		expect(result.scorePercentage).toBeGreaterThanOrEqual(35);
		expect(result.passed).toBe(true);
		expect(result.chapterDiagnostics.length).toBeGreaterThan(0);
		expect(result.aiRemediation.summary).toBeDefined();
		expect(result.questionReview.length).toBe(practice.questions.length);
	});
});
