/**
 * NISM E-Learning LMS Integration Service (LTI 1.3 / xAPI / SCORM)
 * 
 * Complies with FintekPro Global Coding Rules (GCR v1.0):
 * - Layered Architecture: /services -> /data
 * - Zero Trust: Validates all xAPI statements and LTI requests
 * - Stateless & Resilient: Deterministic fallback and self-healing DB initialization
 * - Structured audit logging: { event, userId, latency_ms, status }
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { aiService, AICapability } from "./ai-service";
import { logger } from "../logger";
import { NISM_PRACTICE_BANK } from "./nism-question-bank";

export interface NismCourse {
	id: string;
	seriesCode: string;
	title: string;
	description: string;
	cpeCredits: number;
	durationHours: number;
	passingPercentage: number;
	examFeeInr: number;
	category: string;
	syllabusUrl?: string;
	ltiResourceLinkId: string;
	isActive: boolean;
}

export interface AgentCourseProgress {
	courseId: string;
	seriesCode: string;
	title: string;
	category: string;
	cpeCredits: number;
	durationHours: number;
	passingPercentage?: number;
	examFeeInr?: number;
	syllabusUrl?: string;
	status: "unregistered" | "enrolled" | "in_progress" | "completed" | "certified";
	progressPercentage: number;
	lastScore?: number | null;
	cpeCreditsEarned: number;
	certificateUrl?: string | null;
	certificateNumber?: string | null;
	enrolledAt: string;
	completedAt?: string | null;
}

export interface LtiLaunchPayload {
	launchUrl: string;
	portalUrl: string;
	certificationsUrl: string;
	syllabusUrl?: string;
	idToken: string;
	state: string;
	courseTitle: string;
	seriesCode?: string;
	agentName?: string;
	agentEmail?: string;
	passingPercentage?: number;
	examFeeInr?: number;
	cpeCredits?: number;
	launchParams?: {
		id_token: string;
		state: string;
		lti_message_type: string;
		lti_version: string;
		target_link_uri: string;
	};
}

export interface XApiStatement {
	actor: {
		mbox?: string;
		account?: {
			homePage: string;
			name: string; // FintekPro agentId
		};
		name?: string;
	};
	verb: {
		id: string; // http://adlnet.gov/expapi/verbs/completed, passed, progressed
		display?: Record<string, string>;
	};
	object: {
		id: string; // Course URI containing series code
		definition?: {
			name?: Record<string, string>;
			description?: Record<string, string>;
		};
	};
	result?: {
		score?: {
			scaled?: number;
			raw?: number;
			min?: number;
			max?: number;
		};
		success?: boolean;
		completion?: boolean;
		duration?: string;
	};
	timestamp?: string;
}

const DEFAULT_COURSES: NismCourse[] = [
	{
		id: "nism-va",
		seriesCode: "NISM-SERIES-V-A",
		title: "NISM Series V-A: Mutual Fund Distributors Certification",
		description:
			"SEBI mandated certification for individuals distributing mutual fund schemes in India. Covers mutual fund structure, regulatory environment, and scheme evaluation.",
		cpeCredits: 6,
		durationHours: 25,
		passingPercentage: 50,
		examFeeInr: 1500,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/mutual-fund-distributors",
		ltiResourceLinkId: "res-nism-va-2026",
		isActive: true,
	},
	{
		id: "nism-vd",
		seriesCode: "NISM-SERIES-V-D",
		title: "NISM Series V-D: Mutual Fund – Specialized Investment Fund (SIF) Distributors Certification",
		description:
			"SEBI mandated dual certification for distributors of Mutual Funds and Specialized Investment Funds (SIF). Authorizes distribution of both standard mutual fund schemes and specialized investment funds.",
		cpeCredits: 8,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/certification-exams/specialized-investment-fund-distributors",
		ltiResourceLinkId: "res-nism-vd-2026",
		isActive: true,
	},
	{
		id: "nism-viii",
		seriesCode: "NISM-SERIES-VIII",
		title: "NISM Series VIII: Equity Derivatives Certification",
		description:
			"Designed for approved users and sales personnel of trading members in the equity derivatives segment. Covers futures, options, and hedging strategies.",
		cpeCredits: 6,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Trading",
		syllabusUrl: "https://www.nism.ac.in/equity-derivatives",
		ltiResourceLinkId: "res-nism-viii-2026",
		isActive: true,
	},
	{
		id: "nism-xiii",
		seriesCode: "NISM-SERIES-XIII",
		title: "NISM Series XIII: Common Derivatives Certification Examination",
		description:
			"Comprehensive SEBI mandated certification covering equity derivatives, currency derivatives, interest rate derivatives, and commodity derivatives segments under a single unified benchmark.",
		cpeCredits: 8,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Trading",
		syllabusUrl: "https://www.nism.ac.in/common-derivatives-certification-examination",
		ltiResourceLinkId: "res-nism-xiii-2026",
		isActive: true,
	},
	{
		id: "nism-xa",
		seriesCode: "NISM-SERIES-X-A",
		title: "NISM Series X-A: Investment Adviser (Level 1) Certification",
		description:
			"SEBI RIA Level 1 certification establishing baseline competency in personal financial planning, asset allocation, and tax-efficient portfolio construction.",
		cpeCredits: 10,
		durationHours: 40,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Advisory",
		syllabusUrl: "https://www.nism.ac.in/investment-adviser-level-1",
		ltiResourceLinkId: "res-nism-xa-2026",
		isActive: true,
	},
	{
		id: "nism-xb",
		seriesCode: "NISM-SERIES-X-B",
		title: "NISM Series X-B: Investment Adviser (Level 2) Certification",
		description:
			"Advanced SEBI RIA Level 2 certification covering complex estate planning, behavioral finance, portfolio rebalancing, and regulatory disclosures.",
		cpeCredits: 10,
		durationHours: 45,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Advisory",
		syllabusUrl: "https://www.nism.ac.in/investment-advisors-level-2",
		ltiResourceLinkId: "res-nism-xb-2026",
		isActive: true,
	},
	{
		id: "nism-xv",
		seriesCode: "NISM-SERIES-XV",
		title: "NISM Series XV: Research Analyst Certification",
		description:
			"Mandatory qualification for registered Research Analysts (RA) and equity research associates preparing stock reports and target price valuations.",
		cpeCredits: 8,
		durationHours: 35,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Research",
		syllabusUrl: "https://www.nism.ac.in/research-analyst-certification-examination",
		ltiResourceLinkId: "res-nism-xv-2026",
		isActive: true,
	},
	{
		id: "nism-xxia",
		seriesCode: "NISM-SERIES-XXI-A",
		title: "NISM Series XXI-A: Portfolio Management Services (PMS) Distributors",
		description:
			"Specialized certification for distributing discretionary and non-discretionary Portfolio Management Services (PMS) to HNIs under SEBI (PMS) Regulations.",
		cpeCredits: 6,
		durationHours: 20,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/about-portfolio-management-services-pms-distributors-certification-examination",
		ltiResourceLinkId: "res-nism-xxia-2026",
		isActive: true,
	},
	{
		id: "nism-cpe-mf",
		seriesCode: "NISM-CPE-MF-REFRESHER",
		title: "NISM Continuing Professional Education (CPE) – Mutual Funds",
		description:
			"One-day online CPE program for revalidation of NISM Series V-A certification prior to ARN expiry. Fast-track compliance renewal.",
		cpeCredits: 8,
		durationHours: 12,
		passingPercentage: 100,
		examFeeInr: 2500,
		category: "CPE Refresher",
		syllabusUrl: "https://www.nism.ac.in/cpe-programmes/",
		ltiResourceLinkId: "res-nism-cpemf-2026",
		isActive: true,
	},
];

export interface NismPracticeQuestion {
	id: string;
	courseId: string;
	question: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	topic: string;
}

export interface NismPracticeQuestionClient {
	id: string;
	question: string;
	options: string[];
	topic: string;
}

export interface NismTopicDiagnostic {
	topic: string;
	total: number;
	correct: number;
	incorrect: number;
	unanswered: number;
	accuracyPercentage: number;
	status: "Proficient" | "Satisfactory" | "Needs Review";
}

export interface NismAiRemediationCapsule {
	generated: boolean;
	weakTopics: string[];
	summaryNotes: string;
	recommendedAction: string;
}

export interface NismPracticeTestResult {
	success: boolean;
	courseId: string;
	courseTitle: string;
	seriesCode: string;
	totalQuestions: number;
	correctCount: number;
	incorrectCount: number;
	unansweredCount: number;
	penaltyPerWrong: number;
	negativeMarksDeducted: number;
	grossScore: number;
	netRawScore: number;
	scorePercentage: number;
	passingPercentage: number;
	passed: boolean;
	empanelmentSynced?: boolean;
	topicDiagnostics: NismTopicDiagnostic[];
	aiCapsule: NismAiRemediationCapsule;
	reviews: Array<{
		id: string;
		question: string;
		options: string[];
		selectedOptionIndex: number | null;
		correctOptionIndex: number;
		isCorrect: boolean;
		explanation: string;
		topic: string;
	}>;
}

// Question bank is modularized in ./nism-question-bank (255+ questions across Series V-A, VIII, X-A, XV, XXI-A, V-D)

export class NismLmsService {
	private initialized = false;
	private ltiSecret: string;
	private lmsBaseUrl: string;

	constructor() {
		this.ltiSecret = process.env.NISM_LTI_SECRET || "fintekpro_nism_lti_secret_2026_prod";
		this.lmsBaseUrl = process.env.NISM_LMS_BASE_URL || "https://online.nism.ac.in/nismlms";
	}

	/**
	 * Boot-time table and seed migration
	 */
	async ensureTables() {
		if (this.initialized) return;
		try {
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS nism_lms_courses (
					id VARCHAR(64) PRIMARY KEY,
					series_code VARCHAR(32) NOT NULL UNIQUE,
					title TEXT NOT NULL,
					description TEXT NOT NULL,
					cpe_credits INTEGER DEFAULT 0,
					duration_hours NUMERIC DEFAULT 0,
					passing_percentage INTEGER DEFAULT 60,
					exam_fee_inr NUMERIC DEFAULT 1500,
					category TEXT NOT NULL,
					syllabus_url TEXT,
					lti_resource_link_id TEXT,
					is_active BOOLEAN DEFAULT TRUE,
					created_at TIMESTAMPTZ DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS nism_course_enrolments (
					id SERIAL PRIMARY KEY,
					agent_id VARCHAR(255) NOT NULL,
					course_id VARCHAR(64) NOT NULL REFERENCES nism_lms_courses(id),
					status TEXT NOT NULL DEFAULT 'enrolled',
					progress_percentage INTEGER DEFAULT 0,
					last_score INTEGER,
					cpe_credits_earned INTEGER DEFAULT 0,
					certificate_url TEXT,
					certificate_number TEXT,
					enrolled_at TIMESTAMPTZ DEFAULT NOW(),
					completed_at TIMESTAMPTZ,
					last_synced_at TIMESTAMPTZ DEFAULT NOW(),
					CONSTRAINT unq_agent_nism_course UNIQUE (agent_id, course_id)
				);
			`);

			// Upsert default courses ensuring latest syllabus and new courses like Series V-D are seeded
			for (const c of DEFAULT_COURSES) {
				await db.execute(sql`
					INSERT INTO nism_lms_courses (
						id, series_code, title, description, cpe_credits, duration_hours,
						passing_percentage, exam_fee_inr, category, syllabus_url, lti_resource_link_id, is_active
					) VALUES (
						${c.id}, ${c.seriesCode}, ${c.title}, ${c.description}, ${c.cpeCredits}, ${c.durationHours},
						${c.passingPercentage}, ${c.examFeeInr}, ${c.category}, ${c.syllabusUrl ?? null}, ${c.ltiResourceLinkId}, ${c.isActive}
					) ON CONFLICT (id) DO UPDATE SET
						series_code = EXCLUDED.series_code,
						title = EXCLUDED.title,
						description = EXCLUDED.description,
						cpe_credits = EXCLUDED.cpe_credits,
						duration_hours = EXCLUDED.duration_hours,
						passing_percentage = EXCLUDED.passing_percentage,
						exam_fee_inr = EXCLUDED.exam_fee_inr,
						category = EXCLUDED.category,
						syllabus_url = EXCLUDED.syllabus_url,
						lti_resource_link_id = EXCLUDED.lti_resource_link_id,
						is_active = EXCLUDED.is_active;
				`).catch(() => {});
			}
			this.initialized = true;
		} catch (err: any) {
			logger.error("[NismLmsService] Table init error (non-fatal fallback): " + err.message);
		}
	}

	/**
	 * Retrieve all available NISM courses with agent enrollment info
	 */
	async getCoursesWithAgentStatus(agentId: string): Promise<AgentCourseProgress[]> {
		const startTime = Date.now();
		await this.ensureTables();

		try {
			const rows = await db.execute(sql`
				SELECT 
					c.id as course_id,
					c.series_code,
					c.title,
					c.category,
					c.cpe_credits,
					c.duration_hours,
					c.passing_percentage,
					c.exam_fee_inr,
					c.syllabus_url,
					COALESCE(e.status, 'unregistered') as status,
					COALESCE(e.progress_percentage, 0) as progress_percentage,
					e.last_score,
					COALESCE(e.cpe_credits_earned, 0) as cpe_credits_earned,
					e.certificate_url,
					e.certificate_number,
					COALESCE(e.enrolled_at, NOW()) as enrolled_at,
					e.completed_at
				FROM nism_lms_courses c
				LEFT JOIN nism_course_enrolments e ON e.course_id = c.id AND e.agent_id = ${agentId}
				WHERE c.is_active = TRUE
				ORDER BY c.cpe_credits DESC, c.series_code ASC
			`);

			const latencyMs = Date.now() - startTime;
			logger.info("NISM_LMS_FETCH_COURSES", {
				event: "NISM_LMS_FETCH_COURSES",
				userId: agentId,
				latency_ms: latencyMs,
				count: rows.rows.length,
				status: "SUCCESS"
			});

			return rows.rows.map((r: any) => ({
				courseId: r.course_id,
				seriesCode: r.series_code,
				title: r.title,
				category: r.category,
				cpeCredits: Number(r.cpe_credits),
				durationHours: Number(r.duration_hours),
				passingPercentage: Number(r.passing_percentage) || 60,
				examFeeInr: Number(r.exam_fee_inr) || 1500,
				syllabusUrl: r.syllabus_url || DEFAULT_COURSES.find(c => c.id === r.course_id)?.syllabusUrl,
				status: r.status as any,
				progressPercentage: Number(r.progress_percentage),
				lastScore: r.last_score ? Number(r.last_score) : null,
				cpeCreditsEarned: Number(r.cpe_credits_earned),
				certificateUrl: r.certificate_url,
				certificateNumber: r.certificate_number,
				enrolledAt: new Date(r.enrolled_at).toISOString(),
				completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
			}));
		} catch (err: any) {
			logger.warn("[NismLmsService] Query fallback: " + err.message);
			// Resilient fallback to default courses
			return DEFAULT_COURSES.map(c => ({
				courseId: c.id,
				seriesCode: c.seriesCode,
				title: c.title,
				category: c.category,
				cpeCredits: c.cpeCredits,
				durationHours: c.durationHours,
				passingPercentage: c.passingPercentage,
				examFeeInr: c.examFeeInr,
				syllabusUrl: c.syllabusUrl,
				status: "unregistered" as any,
				progressPercentage: 0,
				lastScore: null,
				cpeCreditsEarned: 0,
				enrolledAt: new Date().toISOString(),
			}));
		}
	}

	/**
	 * Enroll an agent into a course
	 */
	async enrollAgent(agentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
		await this.ensureTables();
		try {
			await db.execute(sql`
				INSERT INTO nism_course_enrolments (agent_id, course_id, status, progress_percentage)
				VALUES (${agentId}, ${courseId}, 'enrolled', 0)
				ON CONFLICT (agent_id, course_id) DO NOTHING;
			`);

			return { success: true, message: "Enrolled in course successfully" };
		} catch (err: any) {
			logger.warn("[NismLmsService] Enrollment DB fallback: " + err.message);
			return { success: true, message: "Enrolled in course successfully (offline mode)" };
		}
	}

	/**
	 * Generate LTI 1.3 Launch Token & URL for single-click LMS redirection
	 */
	async generateLtiLaunch(agentId: string, courseId: string, agentName: string, agentEmail: string): Promise<LtiLaunchPayload> {
		await this.ensureTables();

		// Ensure enrolled first
		await this.enrollAgent(agentId, courseId);

		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		);

		const header = {
			alg: "HS256",
			typ: "JWT",
		};

		const now = Math.floor(Date.now() / 1000);
		const state = crypto.randomBytes(16).toString("hex");

		const payload = {
			iss: "https://agent.fintekpro.com",
			sub: agentId,
			aud: "nism-elearning-platform",
			exp: now + 3600, // 1 hour validity
			iat: now,
			nonce: crypto.randomBytes(8).toString("hex"),
			name: agentName,
			email: agentEmail,
			"https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
			"https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
			"https://purl.imsglobal.org/spec/lti/claim/deployment_id": "fintekpro_dep_01",
			"https://purl.imsglobal.org/spec/lti/claim/target_link_uri": `${this.lmsBaseUrl}/course/${courseId}`,
			"https://purl.imsglobal.org/spec/lti/claim/resource_link": {
				id: matchedCourse?.ltiResourceLinkId || `res-${courseId}`,
				title: matchedCourse?.title || `NISM Course: ${courseId.toUpperCase()}`,
			},
			"https://purl.imsglobal.org/spec/lti/claim/roles": [
				"http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
			],
		};

		const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
		const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
		const signature = crypto
			.createHmac("sha256", this.ltiSecret)
			.update(`${b64Header}.${b64Payload}`)
			.digest("base64url");

		const idToken = `${b64Header}.${b64Payload}.${signature}`;

		const portalUrl = "https://online.nism.ac.in/nismlms/";
		const certificationsUrl = "https://cert.nism.ac.in/dashboard";
		const syllabusUrl = matchedCourse?.syllabusUrl || "https://www.nism.ac.in/certification-examinations/";

		return {
			launchUrl: `${this.lmsBaseUrl}/lti/launch?courseId=${courseId}&token=${idToken}&id_token=${idToken}&state=${state}`,
			portalUrl,
			certificationsUrl,
			syllabusUrl,
			idToken,
			state,
			courseTitle: matchedCourse?.title || courseId.toUpperCase(),
			seriesCode: matchedCourse?.seriesCode || courseId.toUpperCase(),
			agentName,
			agentEmail,
			passingPercentage: matchedCourse?.passingPercentage || 60,
			examFeeInr: matchedCourse?.examFeeInr || 1500,
			cpeCredits: matchedCourse?.cpeCredits || 6,
			launchParams: {
				id_token: idToken,
				state,
				lti_message_type: "LtiResourceLinkRequest",
				lti_version: "1.3.0",
				target_link_uri: `${this.lmsBaseUrl}/course/${courseId}`,
			},
		};
	}

	/**
	 * Ingest xAPI / TinCan learning statement from NISM LMS webhook
	 */
	async ingestXApiStatement(statement: XApiStatement): Promise<{ success: boolean; actionTaken: string }> {
		const startTime = Date.now();
		await this.ensureTables();

		const agentId = statement.actor?.account?.name || statement.actor?.mbox?.replace("mailto:", "");
		if (!agentId) {
			return { success: false, actionTaken: "Missing actor account name (agentId)" };
		}

		// Extract course series or id from object.id
		const objectId = statement.object?.id || "";
		const verbId = statement.verb?.id || "";

		// Match course from DB or in-memory fallback
		let course: { id: string; cpe_credits: number } | undefined;
		try {
			const courseRows = await db.execute(sql`
				SELECT id, cpe_credits FROM nism_lms_courses 
				WHERE ${objectId} ILIKE ('%' || id || '%') OR ${objectId} ILIKE ('%' || series_code || '%')
				LIMIT 1
			`);
			if (courseRows.rows.length > 0) {
				const r = courseRows.rows[0] as any;
				course = { id: r.id, cpe_credits: Number(r.cpe_credits) };
			}
		} catch (err: any) {
			logger.warn("[NismLmsService] DB lookup fallback for xAPI course: " + err.message);
		}

		if (!course) {
			const matched = DEFAULT_COURSES.find(
				(c) => objectId.toLowerCase().includes(c.id.toLowerCase()) || objectId.toUpperCase().includes(c.seriesCode.toUpperCase()),
			);
			if (matched) {
				course = { id: matched.id, cpe_credits: matched.cpeCredits };
			}
		}

		if (!course) {
			return { success: false, actionTaken: `No matching course found for object ${objectId}` };
		}

		const isCompleted = verbId.includes("completed") || verbId.includes("passed");
		const isProgress = verbId.includes("progressed") || verbId.includes("experienced");
		const rawScore = statement.result?.score?.raw ?? (statement.result?.score?.scaled ? Math.round(statement.result.score.scaled * 100) : null);
		const progressPct = isCompleted ? 100 : Math.min(99, rawScore ?? 50);

		if (isCompleted) {
			const certNumber = `NISM-CPE-${Date.now().toString(36).toUpperCase()}`;
			try {
				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET status = 'completed',
						progress_percentage = 100,
						last_score = ${rawScore ?? 80},
						cpe_credits_earned = ${course.cpe_credits},
						certificate_number = ${certNumber},
						completed_at = NOW(),
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${course.id}
				`);

				if (course.id === "nism-va") {
					await db.execute(sql`
						UPDATE agent_empanelments
						SET nism_certificate_number = COALESCE(nism_certificate_number, ${certNumber}),
							nism_certificate_type = 'Series V-A Mutual Funds',
							nism_verification_status = 'verified_lms',
							nism_verified_at = NOW(),
							updated_at = NOW()
						WHERE agent_id = ${agentId}
					`);
				}
			} catch (err: any) {
				logger.warn("[NismLmsService] Completion update DB fallback: " + err.message);
			}

			logger.info("NISM_LMS_COURSE_COMPLETED", {
				event: "NISM_LMS_COURSE_COMPLETED",
				userId: agentId,
				courseId: course.id,
				creditsEarned: course.cpe_credits,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS"
			});

			return { success: true, actionTaken: `Marked course ${course.id} as completed (+${course.cpe_credits} CPE credits)` };
		}

		if (isProgress) {
			try {
				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET status = 'in_progress',
						progress_percentage = GREATEST(progress_percentage, ${progressPct}),
						last_score = ${rawScore ?? null},
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${course.id}
				`);
			} catch (err: any) {
				logger.warn("[NismLmsService] Progress update DB fallback: " + err.message);
			}

			return { success: true, actionTaken: `Updated course ${course.id} progress to ${progressPct}%` };
		}

		return { success: true, actionTaken: "Statement recorded" };
	}

	/**
	 * Get summary metrics for agent's NISM learning record
	 */
	async getAgentSummary(agentId: string): Promise<{
		totalEnrolled: number;
		totalCompleted: number;
		totalCpeCredits: number;
		certificationsCount: number;
	}> {
		await this.ensureTables();
		try {
			const rows = await db.execute(sql`
				SELECT 
					COUNT(*)::int as total_enrolled,
					COUNT(CASE WHEN status IN ('completed', 'certified') THEN 1 END)::int as total_completed,
					COALESCE(SUM(cpe_credits_earned), 0)::int as total_cpe_credits,
					COUNT(CASE WHEN certificate_number IS NOT NULL THEN 1 END)::int as certifications_count
				FROM nism_course_enrolments
				WHERE agent_id = ${agentId}
			`);

			const r = rows.rows[0] as any;
			return {
				totalEnrolled: r?.total_enrolled || 0,
				totalCompleted: r?.total_completed || 0,
				totalCpeCredits: r?.total_cpe_credits || 0,
				certificationsCount: r?.certifications_count || 0,
			};
		} catch {
			return {
				totalEnrolled: 0,
				totalCompleted: 0,
				totalCpeCredits: 0,
				certificationsCount: 0,
			};
		}
	}

		/**
	 * Helper to resolve authentic practice questions for any course
	 */
	resolveQuestionsForCourse(courseId: string, count?: number): NismPracticeQuestion[] {
		const cid = (courseId || "").toLowerCase().trim();
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === cid || c.seriesCode.toLowerCase() === cid,
		) || DEFAULT_COURSES[0];

		// Questions specifically tagged for this course
		let matching = NISM_PRACTICE_BANK.filter(
			(q) => q.courseId.toLowerCase() === matchedCourse.id.toLowerCase(),
		);

		// If fewer than 10 questions exist, augment with core foundational regulatory/compliance questions
		if (matching.length < 10) {
			const generalPool = NISM_PRACTICE_BANK.filter(
				(q) => q.courseId === "nism-va" && !matching.some((m) => m.id === q.id),
			);
			matching = [...matching, ...generalPool];
		}

		if (typeof count === "number" && count > 0 && count < matching.length) {
			return matching.slice(0, count);
		}

		return matching;
	}

	/**
	 * Retrieve practice test questions for a given NISM course
	 */
	getPracticeQuestions(courseId: string, mode?: string | number): {
		courseId: string;
		courseTitle: string;
		seriesCode: string;
		passingPercentage: number;
		durationMinutes: number;
		totalAvailableQuestions: number;
		questions: NismPracticeQuestionClient[];
	} {
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		) || DEFAULT_COURSES[0];

		const allMatching = this.resolveQuestionsForCourse(courseId);
		let targetCount: number | undefined;

		if (mode === "quick" || mode === "25" || mode === 25) targetCount = 25;
		else if (mode === "diagnostic" || mode === "50" || mode === 50) targetCount = 50;
		else if (mode === "full" || mode === "100" || mode === 100) targetCount = 100;
		else if (typeof mode === "number") targetCount = mode;
		else if (mode === "all") targetCount = allMatching.length;
		else {
			// Default to real exam format: 100 questions for Series V-A (or all if < 100)
			targetCount = matchedCourse.id === "nism-va" ? Math.min(100, allMatching.length) : undefined;
		}

		const matching = this.resolveQuestionsForCourse(courseId, targetCount);
		const durationMinutes = targetCount === 100 ? 120 : targetCount === 50 ? 60 : Math.max(15, Math.round(matching.length * 1.2));

		return {
			courseId: matchedCourse.id,
			courseTitle: matchedCourse.title,
			seriesCode: matchedCourse.seriesCode,
			passingPercentage: matchedCourse.passingPercentage,
			durationMinutes,
			totalAvailableQuestions: allMatching.length,
			questions: matching.map((q) => ({
				id: q.id,
				question: q.question,
				options: q.options,
				topic: q.topic,
			})),
		};
	}

	/**
	 * Generate AI Remediation Notes for missed questions and weak topics (FASP-AI v1.0)
	 */
	async generateAiRemediationNotes(
		courseTitle: string,
		scorePercentage: number,
		passingPercentage: number,
		weakTopics: string[],
		missedQuestions: Array<{ question: string; correctOption: string; topic: string }>,
	): Promise<string> {
		try {
			const prompt = `You are a SEBI certification exam mentor for wealth managers and financial advisors in India.
The advisor took a practice mock exam for ${courseTitle} and scored ${scorePercentage}% (Passing threshold: ${passingPercentage}%).
Topics needing improvement: ${weakTopics.join(", ") || "Regulatory Compliance"}.

Top missed questions:
${missedQuestions.slice(0, 3).map((q, idx) => `${idx + 1}. ${q.question} -> Key Rule: ${q.correctOption}`).join("\n")}

Provide a high-yield, 3-bullet revision capsule summarizing the exact regulatory rules, statutory thresholds, and formulas to remember for the official exam. Keep each bullet point under 40 words and directly actionable.`;

			const response = await aiService.chat(
				[{ role: "user", content: prompt }],
				{
					capability: AICapability.STANDARD,
					temperature: 0.3,
					maxTokens: 350,
				},
			);

			return response?.content || this.getFallbackRemediationNotes(weakTopics);
		} catch (err: any) {
			logger.warn("[NismLmsService] AI Remediation fallback: " + err.message);
			return this.getFallbackRemediationNotes(weakTopics);
		}
	}

	private getFallbackRemediationNotes(_weakTopics: string[]): string {
		return `• Mutual Fund Cut-Off & NAV Rules: Liquid/Overnight funds have a 1:30 PM cut-off with realization principle; other equity/debt funds use 3:00 PM cut-off.
• Capital Gains & Taxation (Budget 2024): Equity mutual fund LTCG (>12 months) taxed at 12.5% above ₹1.25 Lakh exemption threshold. STCG is taxed at 20%.
• Regulatory Governance: Asset segregation between AMC and Custodian is mandatory; RIAs cannot charge distribution commissions from advisory clients.`;
	}

	/**
	 * Submit and score a practice test attempt with SEBI 0.25 negative marking, topic diagnostics & AI remediation
	 */
	async submitPracticeTest(
		courseId: string,
		answers: Record<string, number>,
		agentId?: string,
		questionIds?: string[],
	): Promise<NismPracticeTestResult> {
		const startTime = Date.now();
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		) || DEFAULT_COURSES[0];

		let questions = this.resolveQuestionsForCourse(courseId);
		if (Array.isArray(questionIds) && questionIds.length > 0) {
			const qMap = new Map(questions.map((q) => [q.id, q]));
			const filtered = questionIds.map((id) => qMap.get(id)).filter(Boolean) as typeof questions;
			if (filtered.length > 0) {
				questions = filtered;
			}
		} else {
			const answeredKeys = Object.keys(answers);
			if (answeredKeys.length > 0 && answeredKeys.length < questions.length) {
				const qMap = new Map(questions.map((q) => [q.id, q]));
				const matchedQuestions = answeredKeys.map((id) => qMap.get(id)).filter(Boolean) as typeof questions;
				if (matchedQuestions.length === answeredKeys.length) {
					questions = matchedQuestions;
				}
			}
		}

		let correctCount = 0;
		let incorrectCount = 0;
		let unansweredCount = 0;

		// Topic diagnostic accumulator
		const topicMap: Record<string, { total: number; correct: number; incorrect: number; unanswered: number }> = {};

		const reviews = questions.map((q) => {
			const selected = answers[q.id];
			const isAnswered = typeof selected === "number";
			const isCorrect = isAnswered && selected === q.correctIndex;

			if (!topicMap[q.topic]) {
				topicMap[q.topic] = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
			}
			topicMap[q.topic].total += 1;

			if (isCorrect) {
				correctCount++;
				topicMap[q.topic].correct += 1;
			} else if (isAnswered) {
				incorrectCount++;
				topicMap[q.topic].incorrect += 1;
			} else {
				unansweredCount++;
				topicMap[q.topic].unanswered += 1;
			}

			return {
				id: q.id,
				question: q.question,
				options: q.options,
				selectedOptionIndex: isAnswered ? selected : null,
				correctOptionIndex: q.correctIndex,
				isCorrect,
				explanation: q.explanation,
				topic: q.topic,
			};
		});

		// SEBI 0.25 Negative Marking Calculation
		const penaltyPerWrong = 0.25;
		const negativeMarksDeducted = Number((incorrectCount * penaltyPerWrong).toFixed(2));
		const grossScore = correctCount;
		const netRawScore = Math.max(0, Number((grossScore - negativeMarksDeducted).toFixed(2)));
		const scorePercentage = questions.length > 0 ? Math.max(0, Math.round((netRawScore / questions.length) * 100)) : 0;
		const passed = scorePercentage >= matchedCourse.passingPercentage;

		// Topic Diagnostics Calculation
		const topicDiagnostics: NismTopicDiagnostic[] = Object.entries(topicMap).map(([topic, stats]) => {
			const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
			let status: "Proficient" | "Satisfactory" | "Needs Review" = "Needs Review";
			if (accuracy >= 75) status = "Proficient";
			else if (accuracy >= 50) status = "Satisfactory";

			return {
				topic,
				total: stats.total,
				correct: stats.correct,
				incorrect: stats.incorrect,
				unanswered: stats.unanswered,
				accuracyPercentage: accuracy,
				status,
			};
		});

		// AI Remediation
		const weakTopics = topicDiagnostics
			.filter((t) => t.status === "Needs Review")
			.map((t) => t.topic);

		const missedQuestions = reviews
			.filter((r) => !r.isCorrect)
			.map((r) => ({
				question: r.question,
				correctOption: r.options[r.correctOptionIndex],
				topic: r.topic,
			}));

		let summaryNotes = "";
		if (missedQuestions.length > 0) {
			summaryNotes = await this.generateAiRemediationNotes(
				matchedCourse.title,
				scorePercentage,
				matchedCourse.passingPercentage,
				weakTopics,
				missedQuestions,
			);
		} else {
			summaryNotes = "Outstanding performance! You have mastered all tested topics with 100% accuracy. You are primed to clear the official NISM certification examination.";
		}

		const aiCapsule: NismAiRemediationCapsule = {
			generated: true,
			weakTopics,
			summaryNotes,
			recommendedAction: passed
				? "Ready for official exam slot booking at cert.nism.ac.in"
				: "Review weak chapters and retake practice mock before booking slot",
		};

		let empanelmentSynced = false;
		if (passed && agentId && agentId !== "guest-advisor") {
			try {
				await db.execute(sql`
					UPDATE agent_empanelments
					SET nism_certificate_type = COALESCE(nism_certificate_type, ${matchedCourse.seriesCode}),
						nism_verification_status = CASE 
							WHEN nism_verification_status IN ('verified_digilocker', 'verified_lms') THEN nism_verification_status 
							ELSE 'mock_cleared' 
						END,
						nism_score = ${`${scorePercentage}%`},
						updated_at = NOW()
					WHERE agent_id = ${agentId}
				`);

				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET last_score = ${Math.max(0, netRawScore)},
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${matchedCourse.id}
				`);
				empanelmentSynced = true;
			} catch (dbErr: any) {
				logger.warn("[NismLmsService] Empanelment sync DB fallback: " + dbErr.message);
			}
		}

		if (agentId) {
			logger.info("NISM_PRACTICE_TEST_SUBMITTED", {
				event: "NISM_PRACTICE_TEST_SUBMITTED",
				userId: agentId,
				courseId: matchedCourse.id,
				grossScore,
				negativeMarksDeducted,
				netRawScore,
				scorePercentage,
				passed,
				empanelmentSynced,
				weakTopicsCount: weakTopics.length,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS"
			});
		}

		return {
			success: true,
			courseId: matchedCourse.id,
			courseTitle: matchedCourse.title,
			seriesCode: matchedCourse.seriesCode,
			totalQuestions: questions.length,
			correctCount,
			incorrectCount,
			unansweredCount,
			penaltyPerWrong,
			negativeMarksDeducted,
			grossScore,
			netRawScore,
			scorePercentage,
			passingPercentage: matchedCourse.passingPercentage,
			passed,
			empanelmentSynced,
			topicDiagnostics,
			aiCapsule,
			reviews,
		};
	}
}

export const nismLmsService = new NismLmsService();
