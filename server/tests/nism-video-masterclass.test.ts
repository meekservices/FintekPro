import { describe, it, expect } from "vitest";
import { nismCurriculumService } from "../services/nism-curriculum-service";
import { nismLmsService } from "../services/nism-lms-service";

describe("NISM Series V-D Video Masterclasses & Telemetry", () => {
	it("returns full 22-chapter curriculum with accredited video masterclasses for NISM Series V-D", () => {
		const curriculum = nismCurriculumService.getCurriculum("nism-vd");
		expect(curriculum).not.toBeNull();
		expect(curriculum?.courseId).toBe("nism-vd");
		expect(curriculum?.totalChapters).toBe(22);
		expect(curriculum?.masterclassSeries).toBeDefined();
		expect(curriculum?.masterclassSeries?.totalVideos).toBe(22);
		expect(curriculum?.masterclassSeries?.syllabusEffectiveDate).toBe("July 2026");

		const allChapters = curriculum!.modules.flatMap((m) => m.chapters);
		expect(allChapters.length).toBe(22);

		// Every chapter has a video attached with key timestamps
		for (const ch of allChapters) {
			expect(ch.video).toBeDefined();
			expect(ch.video?.videoUrl).toBeTruthy();
			expect(ch.video?.title).toBeTruthy();
			expect(ch.video?.durationMinutes).toBeGreaterThan(0);
			expect(ch.video?.keyTimestamps.length).toBeGreaterThan(0);
			expect(ch.video?.isInstitutionalAccredited).toBe(true);
		}

		// Specifically check Chapter 22 (Specialized Investment Funds / SIF Framework)
		const ch22 = allChapters.find((c) => c.chapterNumber === 22);
		expect(ch22).toBeDefined();
		expect(ch22?.title).toContain("Specialized Investment Funds (SIF)");
		expect(ch22?.video?.title).toContain("(SIF) Framework");
		const hasTicketSizeTimestamp = ch22?.video?.keyTimestamps.some((t) =>
			t.label.includes("10 Lakhs"),
		);
		expect(hasTicketSizeTimestamp).toBe(true);
	});

	it("records IEEE xAPI video telemetry events (initialized, played, paused, completed)", async () => {
		const res = await nismLmsService.recordVideoTelemetry({
			agentId: "agent-test-institutional",
			courseId: "nism-vd",
			chapterNumber: 22,
			verb: "played",
			currentTimeSec: 420,
			durationSec: 2700,
			playbackSpeed: 1.25,
		});

		expect(res.success).toBe(true);
	});

	it("updates progress upon completing video masterclass", async () => {
		const res = await nismLmsService.recordVideoTelemetry({
			agentId: "agent-test-institutional",
			courseId: "nism-vd",
			chapterNumber: 22,
			verb: "completed",
			currentTimeSec: 2700,
			durationSec: 2700,
		});

		expect(res.success).toBe(true);
		expect(res.progressUpdated).toBe(true);
	});
});
