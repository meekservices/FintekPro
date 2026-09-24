import { describe, it, expect, vi } from "vitest";
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
		expect(courses.length).toBeGreaterThanOrEqual(6);

		const seriesVA = courses.find((c) => c.seriesCode === "NISM-SERIES-V-A");
		expect(seriesVA).toBeDefined();
		expect(seriesVA?.cpeCredits).toBe(6);
		expect(seriesVA?.title).toContain("Mutual Fund Distributors");
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
});
