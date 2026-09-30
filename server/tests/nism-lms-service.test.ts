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
			"nism-va-q7": 1,
			"nism-va-q8": 3,
			"nism-va-q9": 1,
			"nism-va-q10": 1,
			"nism-va-q11": 1,
			"nism-va-q12": 2,
			"nism-va-q13": 1,
			"nism-va-q14": 1,
			"nism-va-q15": 1,
		};

		const result = await nismLmsService.submitPracticeTest("nism-va", answers, "agent-test-123");
		expect(result.success).toBe(true);
		expect(result.passed).toBe(true);
		expect(result.scorePercentage).toBe(100);
		expect(result.negativeMarksDeducted).toBe(0);
		expect(result.aiCapsule.recommendedAction).toContain("cert.nism.ac.in");
		expect(result).toHaveProperty("empanelmentSynced");
	});

	it("returns at least 10 questions for any course, including Series XV, V-D, and VIII", () => {
		const practiceXv = nismLmsService.getPracticeQuestions("nism-xv");
		expect(practiceXv.questions.length).toBeGreaterThanOrEqual(10);

		const practiceVd = nismLmsService.getPracticeQuestions("nism-vd");
		expect(practiceVd.questions.length).toBeGreaterThanOrEqual(10);

		const practiceViii = nismLmsService.getPracticeQuestions("nism-viii");
		expect(practiceViii.questions.length).toBeGreaterThanOrEqual(10);

		const practiceXa = nismLmsService.getPracticeQuestions("nism-xa");
		expect(practiceXa.questions.length).toBeGreaterThanOrEqual(10);
	});

	it("serves authentic 150-question examination papers with 180 minutes duration in exam mode", () => {
		const paper1 = nismLmsService.getPracticeQuestions("nism-va", { paperId: "paper-1", testType: "exam" });
		expect(paper1.questions.length).toBe(150);
		expect(paper1.durationMinutes).toBe(180);
		expect(paper1.paperId).toBe("paper-1");
		// Ensure answer keys and rationales are strictly withheld in exam mode
		for (const q of paper1.questions) {
			expect(q.correctIndex).toBeUndefined();
			expect(q.explanation).toBeUndefined();
		}

		const paper2 = nismLmsService.getPracticeQuestions("nism-va", { paperId: "paper-2", testType: "exam" });
		expect(paper2.questions.length).toBe(150);
		expect(paper2.durationMinutes).toBe(180);
		expect(paper2.paperId).toBe("paper-2");

		// Paper 1 and Paper 2 should have distinct leading question IDs
		expect(paper1.questions[0].id).not.toBe(paper2.questions[0].id);

		const paper3 = nismLmsService.getPracticeQuestions("nism-va", { paperId: "paper-3", testType: "exam" });
		expect(paper3.questions.length).toBe(150);
	});

	it("exposes instant correctIndex and explanation when requested in practice mode", () => {
		const practiceSession = nismLmsService.getPracticeQuestions("nism-va", {
			paperId: "paper-1",
			testType: "practice",
			count: 10,
		});

		expect(practiceSession.testType).toBe("practice");
		expect(practiceSession.durationMinutes).toBe(0); // untimed
		expect(practiceSession.questions.length).toBe(10);

		for (const q of practiceSession.questions) {
			expect(typeof q.correctIndex).toBe("number");
			expect(typeof q.explanation).toBe("string");
			expect(q.explanation!.length).toBeGreaterThan(10);
		}
	});

	it("can generate customized NISM question papers from curriculum topics", async () => {
		const generated = await nismLmsService.generateNismQuestionPaperFromCurriculum({
			courseId: "nism-va",
			curriculumTopic: "Chapter 7: Taxation of Mutual Funds & Capital Gains",
			questionCount: 5,
		});

		expect(generated.success).toBe(true);
		expect(generated.paperTitle).toBeDefined();
		expect(generated.questions.length).toBe(5);
		expect(generated.questions[0].options.length).toBe(4);
	});

	it("serves authentic 150-question examination papers across ALL accredited NISM modules", () => {
		const allModules = [
			"nism-va",
			"nism-vd",
			"nism-viii",
			"nism-xiii",
			"nism-xa",
			"nism-xb",
			"nism-xv",
			"nism-xxia",
			"nism-cpe-mf",
		];

		for (const modId of allModules) {
			// Paper 1 in Exam Mode
			const p1Exam = nismLmsService.getPracticeQuestions(modId, { paperId: "paper-1", testType: "exam" });
			expect(p1Exam.questions.length).toBe(150);
			expect(p1Exam.durationMinutes).toBe(180);
			expect(p1Exam.paperTitle).toBeDefined();
			// No answer leakage in exam mode
			expect(p1Exam.questions[0].correctIndex).toBeUndefined();
			expect(p1Exam.questions[0].explanation).toBeUndefined();

			// Paper 2 in Practice Mode
			const p2Practice = nismLmsService.getPracticeQuestions(modId, { paperId: "paper-2", testType: "practice" });
			expect(p2Practice.questions.length).toBe(150);
			expect(p2Practice.durationMinutes).toBe(0); // untimed
			expect(typeof p2Practice.questions[0].correctIndex).toBe("number");
			expect(typeof p2Practice.questions[0].explanation).toBe("string");

			// Paper 3 in Exam Mode
			const p3Exam = nismLmsService.getPracticeQuestions(modId, { paperId: "paper-3", testType: "exam" });
			expect(p3Exam.questions.length).toBe(150);
			expect(p3Exam.durationMinutes).toBe(180);
		}
	});
});
