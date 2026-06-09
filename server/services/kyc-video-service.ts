// @ts-nocheck
import { db } from "../db";
import { kycVideoSessions, kycAuditLogs, userProfiles } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { kycEncryptionService } from "./kyc-encryption-service";
import crypto from "crypto";

const VCIP_EXPIRY_YEARS_STANDARD = 2;
const VCIP_EXPIRY_YEARS_NRI_HIGH_VALUE = 1;
const VCIP_GRACE_PERIOD_END = new Date("2024-06-01T00:00:00Z");

type VideoKycReason =
	| "HIGH_AML"
	| "ADMIN_REQUEST"
	| "REKYC_ESCALATION"
	| "REGULATOR_MANDATE"
	| "CRITICAL_AML";
type VideoKycStatus =
	| "PENDING"
	| "SCHEDULED"
	| "IN_PROGRESS"
	| "COMPLETED"
	| "FAILED"
	| "EXPIRED";

interface InitiateVideoKycParams {
	sessionId: string;
	userId: string;
	reason: VideoKycReason;
	scheduledAt?: Date;
	initiatedBy: string;
	initiatedByRole: string;
}

interface CompleteVideoKycParams {
	videoKycId: string;
	officerId: string;
	status: "COMPLETED" | "FAILED";
	recordingHash: string;
	officerNotes?: string;
	failureReason?: string;
}

class KycVideoService {
	constructor() {
		console.log("✅ Video KYC Service initialized (provider-agnostic)");
	}

	async initiate(params: InitiateVideoKycParams): Promise<{
		success: boolean;
		videoKycId?: string;
		joinUrl?: string;
		status?: string;
		error?: string;
	}> {
		try {
			const existing = await db
				.select()
				.from(kycVideoSessions)
				.where(
					and(
						eq(kycVideoSessions.userId, params.userId),
						eq(kycVideoSessions.status, "PENDING"),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				return {
					success: true,
					videoKycId: existing[0].id,
					joinUrl: existing[0].joinUrl || undefined,
					status: existing[0].status,
				};
			}

			const joinToken = crypto.randomBytes(32).toString("hex");
			const joinUrl = `/kyc/video/join/${joinToken}`;

			const [videoSession] = await db
				.insert(kycVideoSessions)
				.values({
					sessionId: params.sessionId,
					userId: params.userId,
					reason: params.reason,
					status: params.scheduledAt ? "SCHEDULED" : "PENDING",
					provider: "internal",
					scheduledAt: params.scheduledAt || null,
					joinUrl,
					metadata: {
						initiatedBy: params.initiatedBy,
						initiatedByRole: params.initiatedByRole,
						joinToken,
					},
				})
				.returning();

			await db.insert(kycAuditLogs).values({
				sessionId: params.sessionId,
				userId: params.userId,
				action: "VIDEO_KYC_INITIATED",
				step: "video_kyc",
				performedBy: params.initiatedBy,
				performedByRole: params.initiatedByRole,
				newValue: { reason: params.reason, videoKycId: videoSession.id },
			});

			return {
				success: true,
				videoKycId: videoSession.id,
				joinUrl,
				status: videoSession.status,
			};
		} catch (error) {
			console.error("[VideoKYC] Error initiating:", error);
			return { success: false, error: "Failed to initiate Video KYC session" };
		}
	}

	async complete(params: CompleteVideoKycParams): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			const [session] = await db
				.select()
				.from(kycVideoSessions)
				.where(eq(kycVideoSessions.id, params.videoKycId))
				.limit(1);

			if (!session) {
				return { success: false, error: "Video KYC session not found" };
			}

			if (session.status === "COMPLETED") {
				return { success: false, error: "Video KYC session already completed" };
			}

			if (!params.recordingHash && params.status === "COMPLETED") {
				return {
					success: false,
					error: "Recording hash is mandatory for completed sessions",
				};
			}

			const completedAt = new Date();

			await db
				.update(kycVideoSessions)
				.set({
					status: params.status,
					officerId: params.officerId,
					recordingHash: params.recordingHash,
					officerNotes: params.officerNotes || null,
					failureReason: params.failureReason || null,
					completedAt,
					updatedAt: new Date(),
				})
				.where(eq(kycVideoSessions.id, params.videoKycId));

			if (params.status === "COMPLETED" && session.userId) {
				const [profile] = await db
					.select()
					.from(userProfiles)
					.where(eq(userProfiles.userId, session.userId))
					.limit(1);

				if (profile) {
					const isNriOrHighValue =
						profile.residentStatus?.startsWith("nri") ||
						profile.residentStatus === "oci" ||
						profile.residentStatus === "pio" ||
						profile.isHighRiskCustomer ||
						profile.investorType === "hni";

					const expiryYears = isNriOrHighValue
						? VCIP_EXPIRY_YEARS_NRI_HIGH_VALUE
						: VCIP_EXPIRY_YEARS_STANDARD;

					const expiryDate = new Date(completedAt);
					expiryDate.setFullYear(expiryDate.getFullYear() + expiryYears);

					await db
						.update(userProfiles)
						.set({
							videoKycCompleted: true,
							videoKycCompletedDate:
								profile.videoKycCompletedDate ?? completedAt,
							videoKycExpiryDate: expiryDate,
							videoKycStatus: "completed",
							updatedAt: new Date(),
						})
						.where(eq(userProfiles.userId, session.userId));
				}
			}

			await db.insert(kycAuditLogs).values({
				sessionId: session.sessionId,
				userId: session.userId,
				action:
					params.status === "COMPLETED"
						? "VIDEO_KYC_COMPLETED"
						: "VIDEO_KYC_FAILED",
				step: "video_kyc",
				performedBy: params.officerId,
				performedByRole: "officer",
				previousValue: { status: session.status },
				newValue: {
					status: params.status,
					recordingHash: params.recordingHash,
				},
			});

			return { success: true };
		} catch (error) {
			console.error("[VideoKYC] Error completing:", error);
			return { success: false, error: "Failed to complete Video KYC session" };
		}
	}

	async getSession(videoKycId: string): Promise<{
		success: boolean;
		session?: any;
		error?: string;
	}> {
		try {
			const [session] = await db
				.select()
				.from(kycVideoSessions)
				.where(eq(kycVideoSessions.id, videoKycId))
				.limit(1);

			if (!session) {
				return { success: false, error: "Video KYC session not found" };
			}

			return {
				success: true,
				session: {
					id: session.id,
					userId: session.userId,
					sessionId: session.sessionId,
					reason: session.reason,
					status: session.status,
					provider: session.provider,
					scheduledAt: session.scheduledAt,
					joinUrl: session.joinUrl,
					officerId: session.officerId,
					officerNotes: session.officerNotes,
					completedAt: session.completedAt,
					failureReason: session.failureReason,
					hasRecording: !!session.recordingHash,
					createdAt: session.createdAt,
				},
			};
		} catch (error) {
			console.error("[VideoKYC] Error getting session:", error);
			return { success: false, error: "Failed to get Video KYC session" };
		}
	}

	async getSessionsByUser(userId: string): Promise<any[]> {
		try {
			const sessions = await db
				.select()
				.from(kycVideoSessions)
				.where(eq(kycVideoSessions.userId, userId))
				.orderBy(desc(kycVideoSessions.createdAt));

			return sessions.map((s) => ({
				id: s.id,
				reason: s.reason,
				status: s.status,
				scheduledAt: s.scheduledAt,
				completedAt: s.completedAt,
				hasRecording: !!s.recordingHash,
				createdAt: s.createdAt,
			}));
		} catch (error) {
			console.error("[VideoKYC] Error getting user sessions:", error);
			return [];
		}
	}

	async getPendingSessions(): Promise<any[]> {
		try {
			const sessions = await db
				.select()
				.from(kycVideoSessions)
				.where(eq(kycVideoSessions.status, "PENDING"))
				.orderBy(desc(kycVideoSessions.createdAt));

			return sessions.map((s) => ({
				id: s.id,
				userId: s.userId,
				reason: s.reason,
				status: s.status,
				scheduledAt: s.scheduledAt,
				createdAt: s.createdAt,
			}));
		} catch (error) {
			return [];
		}
	}

	shouldRequireVideoKyc(
		amlRiskLevel: string | null,
		isReKyc: boolean = false,
	): boolean {
		if (!amlRiskLevel) return false;
		const level = amlRiskLevel.toUpperCase();
		return level === "HIGH" || level === "CRITICAL" || isReKyc;
	}

	canFinalizeTier(
		userId: string,
		videoRequired: boolean,
		videoStatus: string | null,
	): boolean {
		if (!videoRequired) return true;
		return videoStatus === "COMPLETED";
	}
}

export const kycVideoService = new KycVideoService();
