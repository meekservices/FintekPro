import { describe, it, expect } from "vitest";
import { nismLmsService, type XApiStatement } from "../services/nism-lms-service";

describe("NISM LMS Service (LTI 1.3 & xAPI)", () => {
	it("generates an authentic LTI 1.3 launch token with valid HMAC signature", async () => {
		const launch = await nismLmsService.generateLtiLaunch(
			"agent-test-123",
			"nism-va",
			"Rajesh Sharma",
			"rajesh@fintekpro.com",
		);

		expect(launch).toBeDefined();
		expect(launch.launchUrl).toContain("courseId=nism-va");
		expect(launch.launchUrl).toContain("token=");
		expect(launch.launchUrl).toContain("state=");
		expect(launch.idToken.split(".")).toHaveLength(3); // JWT 3-part structure
	});

	it("returns accredited NISM courses for an agent", async () => {
		const courses = await nismLmsService.getCoursesWithAgentStatus("agent-test-123");
		expect(courses).toBeInstanceOf(Array);
		expect(courses.length).toBeGreaterThanOrEqual(8);

		const seriesVA = courses.find((c) => c.seriesCode === "NISM-SERIES-V-A");
		expect(seriesVA).toBeDefined();
		expect(seriesVA?.cpeCredits).toBe(6);
		expect(seriesVA?.title).toContain("Mutual Fund Distributors");

		const seriesVD = courses.find((c) => c.seriesCode === "NISM-SERIES-V-D");
		expect(seriesVD).toBeDefined();
		expect(seriesVD?.cpeCredits).toBe(8);
		expect(seriesVD?.title).toContain("Specialized Investment Fund");

		const seriesXIII = courses.find((c) => c.seriesCode === "NISM-SERIES-XIII");
		expect(seriesXIII).toBeDefined();
		expect(seriesXIII?.cpeCredits).toBe(8);
		expect(seriesXIII?.title).toContain("Common Derivatives");
	});

	it("processes an xAPI statement for course progression", async () => {
		const statement: XApiStatement = {
			actor: {
				account: {
					homePage: "https://agent.fintekpro.com",
					name: "agent-test-123",
				},
			},
			verb: {
				id: "http://adlnet.gov/expapi/verbs/progressed",
			},
			object: {
				id: "https://elearning.nism.ac.in/course/nism-va",
			},
			result: {
				score: {
					raw: 75,
				},
				completion: false,
			},
		};

		const res = await nismLmsService.ingestXApiStatement(statement);
		expect(res.success).toBe(true);
	});

	it("processes an xAPI statement for course completion and awards CPE credits", async () => {
		const statement: XApiStatement = {
			actor: {
				account: {
					homePage: "https://agent.fintekpro.com",
					name: "agent-test-123",
				},
			},
			verb: {
				id: "http://adlnet.gov/expapi/verbs/completed",
			},
			object: {
				id: "https://elearning.nism.ac.in/course/nism-va",
			},
			result: {
				score: {
					raw: 88,
				},
				completion: true,
			},
		};

		const res = await nismLmsService.ingestXApiStatement(statement);
		expect(res.success).toBe(true);
		expect(res.actionTaken).toContain("completed");
	});

	it("retrieves practice test questions for NISM Series V-A without exposing answer keys", () => {
		const practice = nismLmsService.getPracticeQuestions("nism-va");
		expect(practice).toBeDefined();
		expect(practice.courseId).toBe("nism-va");
		expect(practice.questions.length).toBeGreaterThan(0);
		expect(practice.passingPercentage).toBe(50);

		const q1 = practice.questions[0];
		expect(q1.question).toBeDefined();
		expect(q1.options).toHaveLength(4);
		expect((q1 as unknown as Record<string, unknown>).correctIndex).toBeUndefined(); // Answer key is protected
	});

	it("evaluates a submitted practice test with negative marking, topic diagnostics, and AI remediation", async () => {
		const practice = nismLmsService.getPracticeQuestions("nism-va");
		const answers: Record<string, number> = {};
		for (const q of practice.questions) {
			answers[q.id] = 0; // Choose option index 0
		}

		const result = await nismLmsService.submitPracticeTest("nism-va", answers, "agent-test-123");
		expect(result.success).toBe(true);
		expect(result.totalQuestions).toBe(practice.questions.length);
		expect(typeof result.scorePercentage).toBe("number");
		expect(result.reviews.length).toBe(practice.questions.length);
		expect(result.reviews[0].explanation).toBeDefined();

		// Negative marking verification
		expect(result.penaltyPerWrong).toBe(0.25);
		expect(typeof result.negativeMarksDeducted).toBe("number");
		expect(typeof result.netRawScore).toBe("number");

		// Topic diagnostics verification
		expect(result.topicDiagnostics).toBeInstanceOf(Array);
		expect(result.topicDiagnostics.length).toBeGreaterThan(0);
		expect(result.topicDiagnostics[0].topic).toBeDefined();
		expect(result.topicDiagnostics[0].status).toMatch(/Proficient|Satisfactory|Needs Review/);

		// AI remediation capsule verification
		expect(result.aiCapsule).toBeDefined();
		expect(result.aiCapsule.generated).toBe(true);
		expect(result.aiCapsule.summaryNotes.length).toBeGreaterThan(0);
	});

	it("evaluates a passing practice test and triggers empanelment readiness sync", async () => {
		// Answer with all correct options for Series V-A
		const answers: Record<string, number> = {
			"nism-va-q1": 1,
			"nism-va-q2": 0,
			"nism-va-q3": 1,
			"nism-va-q4": 1,
			"nism-va-q5": 0,
			"nism-va-q6": 1,
		};

		const result = await nismLmsService.submitPracticeTest("nism-va", answers, "agent-test-123");
		expect(result.success).toBe(true);
		expect(result.passed).toBe(true);
		expect(result.scorePercentage).toBe(100);
		expect(result.negativeMarksDeducted).toBe(0);
		expect(result.aiCapsule.recommendedAction).toContain("cert.nism.ac.in");
		expect(result).toHaveProperty("empanelmentSynced");
	});
});
