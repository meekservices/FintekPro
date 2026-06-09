// @ts-nocheck
/**
 * KYC Upgrade Notification Service
 *
 * Handles persistent notifications to remind users to complete their KYC
 * until full verification is achieved. Supports email, in-app, and SMS channels.
 *
 * Reminder Schedule:
 * - Day 1: Initial reminder after registration/incomplete KYC detected
 * - Day 3: Second reminder with product access info
 * - Day 7: Third reminder with urgency
 * - Day 14: Final reminder before account restrictions
 */

import { db } from "../db";
import {
	kycUpgradeReminders,
	userNotifications,
	users,
	userProfiles,
	kycVault,
} from "@shared/schema";
import { eq, and, lte, isNull, sql, or } from "drizzle-orm";
import { emailService } from "../email-service";
import { twilioVerifyService } from "./twilio-verify-service";

// Reminder schedule in days
const REMINDER_SCHEDULE_DAYS = [1, 3, 7, 14];

// KYC steps and their requirements
const KYC_STEPS = {
	pan_verification: { name: "PAN Verification", tier: "basic" },
	aadhaar_verification: { name: "Aadhaar Verification", tier: "enhanced" },
	bank_verification: { name: "Bank Account Verification", tier: "enhanced" },
	video_kyc: { name: "Video KYC", tier: "accredited" },
	income_proof: { name: "Income Proof Upload", tier: "accredited" },
	address_proof: { name: "Address Verification", tier: "enhanced" },
	ckyc_registration: { name: "CKYC Registration", tier: "enhanced" },
};

// Products blocked by KYC tier
const BLOCKED_PRODUCTS_BY_TIER = {
	basic: [
		"Direct Equity Trading",
		"F&O Trading",
		"Unlisted Shares",
		"IPO Applications",
		"Bonds (except SGB)",
		"Mutual Funds (Direct)",
	],
	enhanced: [
		"F&O Trading",
		"Unlisted Shares (High Value)",
		"SEBI Accredited Investor Products",
	],
};

interface KycStatus {
	userId: string;
	currentTier: "none" | "basic" | "enhanced" | "accredited";
	missingSteps: string[];
	nextRequiredStep: string | null;
	percentComplete: number;
}

interface ReminderResult {
	success: boolean;
	emailSent: boolean;
	inAppCreated: boolean;
	smsSent: boolean;
	reminderId: string;
}

export class KycUpgradeNotificationService {
	private static instance: KycUpgradeNotificationService;

	private constructor() {}

	static getInstance(): KycUpgradeNotificationService {
		if (!KycUpgradeNotificationService.instance) {
			KycUpgradeNotificationService.instance =
				new KycUpgradeNotificationService();
		}
		return KycUpgradeNotificationService.instance;
	}

	/**
	 * Get user's current KYC status and missing steps
	 */
	async getKycStatus(userId: string): Promise<KycStatus> {
		try {
			const [user] = await db
				.select({
					id: users.id,
					panVerifiedViaSandbox: userProfiles.panVerifiedViaSandbox,
					kycTier: userProfiles.kycTier,
					kycLevel: userProfiles.kycLevel,
					isProfileCompleted: userProfiles.isProfileCompleted,
					aadhaarVerifiedViaSmartKyc: userProfiles.aadhaarVerifiedViaSmartKyc,
					ckycFetchedViaAuthBridge: userProfiles.ckycFetchedViaAuthBridge,
					ckycAuthBridgeStatus: userProfiles.ckycAuthBridgeStatus,
				})
				.from(users)
				.leftJoin(userProfiles, eq(users.id, userProfiles.userId))
				.where(eq(users.id, userId));

			if (!user) {
				return {
					userId,
					currentTier: "none",
					missingSteps: Object.keys(KYC_STEPS),
					nextRequiredStep: "pan_verification",
					percentComplete: 0,
				};
			}

			// Check vault for additional verification status
			let vaultData: {
				kycStatus: string | null;
				ckycStatus: string | null;
				panVerifiedAt: Date | null;
				aadhaarVerifiedAt: Date | null;
				addressVerifiedAt: Date | null;
			} | null = null;

			try {
				const vaultResults = await db
					.select({
						kycStatus: kycVault.kycStatus,
						ckycStatus: kycVault.ckycStatus,
						panVerifiedAt: kycVault.panVerifiedAt,
						aadhaarVerifiedAt: kycVault.aadhaarVerifiedAt,
						addressVerifiedAt: kycVault.addressVerifiedAt,
					})
					.from(kycVault)
					.where(eq(kycVault.userId, userId));
				vaultData = vaultResults[0] || null;
			} catch (vaultError) {
				console.log(
					"[KYC Notification] Vault query failed, using user data only:",
					vaultError,
				);
				// Continue with just user data if vault query fails
			}

			const missingSteps: string[] = [];
			let completedSteps = 0;
			const totalSteps = 5; // pan, aadhaar, bank, address, ckyc

			// Check PAN
			if (!user.panVerifiedViaSandbox && !vaultData?.panVerifiedAt) {
				missingSteps.push("pan_verification");
			} else {
				completedSteps++;
			}

			// Check Aadhaar — accept vault timestamp OR profile flag OR CKYC (which bypasses Aadhaar)
			const aadhaarDone = !!(
				vaultData?.aadhaarVerifiedAt ||
				user.aadhaarVerifiedViaSmartKyc ||
				user.ckycFetchedViaAuthBridge ||
				user.ckycAuthBridgeStatus === "found" ||
				user.ckycAuthBridgeStatus === "verified"
			);
			if (!aadhaarDone) {
				missingSteps.push("aadhaar_verification");
			} else {
				completedSteps++;
			}

			// Check Bank (kycLevel >= 2 means bank verification is done)
			if (Number.parseInt(user.kycLevel || "0", 10) < 2) {
				missingSteps.push("bank_verification");
			} else {
				completedSteps++;
			}

			// Check Address
			if (!vaultData?.addressVerifiedAt) {
				missingSteps.push("address_proof");
			} else {
				completedSteps++;
			}

			// Check CKYC — accept vault status OR profile flag
			const ckycDone = !!(
				vaultData?.ckycStatus === "created" ||
				vaultData?.ckycStatus === "verified" ||
				vaultData?.ckycStatus === "found" ||
				user.ckycFetchedViaAuthBridge ||
				user.ckycAuthBridgeStatus === "found" ||
				user.ckycAuthBridgeStatus === "verified"
			);
			if (!ckycDone) {
				missingSteps.push("ckyc_registration");
			} else {
				completedSteps++;
			}

			// Determine current tier
			let currentTier: "none" | "basic" | "enhanced" | "accredited" = "none";
			if (user.kycTier) {
				currentTier = user.kycTier as "basic" | "enhanced" | "accredited";
			} else if (completedSteps >= 4) {
				currentTier = "enhanced";
			} else if (completedSteps >= 1) {
				currentTier = "basic";
			}

			const percentComplete = Math.round((completedSteps / totalSteps) * 100);

			return {
				userId,
				currentTier,
				missingSteps,
				nextRequiredStep: missingSteps[0] || null,
				percentComplete,
			};
		} catch (error) {
			console.error("[KYC Notification] Error getting KYC status:", error);
			return {
				userId,
				currentTier: "none",
				missingSteps: ["pan_verification"],
				nextRequiredStep: "pan_verification",
				percentComplete: 0,
			};
		}
	}

	/**
	 * Schedule reminders for a user with incomplete KYC
	 */
	async scheduleReminders(userId: string): Promise<void> {
		try {
			const kycStatus = await this.getKycStatus(userId);

			// Don't schedule if KYC is complete
			if (kycStatus.missingSteps.length === 0) {
				console.log(
					`[KYC Notification] User ${userId} has complete KYC, no reminders needed`,
				);
				return;
			}

			// Check for existing pending reminders
			const existingReminders = await db
				.select()
				.from(kycUpgradeReminders)
				.where(
					and(
						eq(kycUpgradeReminders.userId, userId),
						eq(kycUpgradeReminders.status, "pending"),
					),
				);

			if (existingReminders.length > 0) {
				console.log(
					`[KYC Notification] User ${userId} already has ${existingReminders.length} pending reminders`,
				);
				return;
			}

			// Schedule reminders for each day in the schedule
			const now = new Date();
			for (let i = 0; i < REMINDER_SCHEDULE_DAYS.length; i++) {
				const daysFromNow = REMINDER_SCHEDULE_DAYS[i];
				const scheduledFor = new Date(
					now.getTime() + daysFromNow * 24 * 60 * 60 * 1000,
				);

				await db.insert(kycUpgradeReminders).values({
					userId,
					reminderType: "email",
					reminderSequence: i + 1,
					currentKycTier: kycStatus.currentTier,
					targetKycTier:
						kycStatus.currentTier === "basic" ? "enhanced" : "accredited",
					missingSteps: kycStatus.missingSteps,
					scheduledFor,
					status: "pending",
					metadata: {
						blockedProducts:
							BLOCKED_PRODUCTS_BY_TIER[
								kycStatus.currentTier as keyof typeof BLOCKED_PRODUCTS_BY_TIER
							] || [],
						percentComplete: kycStatus.percentComplete,
					},
				});
			}

			console.log(
				`[KYC Notification] Scheduled ${REMINDER_SCHEDULE_DAYS.length} reminders for user ${userId}`,
			);
		} catch (error) {
			console.error("[KYC Notification] Error scheduling reminders:", error);
		}
	}

	/**
	 * Send a single reminder (email + in-app + optional SMS)
	 */
	async sendReminder(
		userId: string,
		sequence: number,
	): Promise<ReminderResult> {
		const result: ReminderResult = {
			success: false,
			emailSent: false,
			inAppCreated: false,
			smsSent: false,
			reminderId: "",
		};

		try {
			const kycStatus = await this.getKycStatus(userId);

			// Get user details for email
			const [user] = await db
				.select({
					email: users.email,
					mobile: users.mobile,
					firstName: users.firstName,
				})
				.from(users)
				.where(eq(users.id, userId));

			if (!user) {
				console.error(`[KYC Notification] User ${userId} not found`);
				return result;
			}

			// Create in-app notification
			const [notification] = await db
				.insert(userNotifications)
				.values({
					userId,
					type: sequence >= 3 ? "warning" : "guidance",
					title: this.getNotificationTitle(sequence, kycStatus),
					message: this.getNotificationMessage(sequence, kycStatus),
					actionUrl: "/kyc/complete",
					priority: sequence >= 3 ? "high" : "medium",
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
				})
				.returning();

			result.inAppCreated = true;

			// Send email
			if (user.email) {
				const emailSent = await this.sendKycReminderEmail(
					user.email,
					user.firstName || "Valued Customer",
					sequence,
					kycStatus,
				);
				result.emailSent = emailSent;
			}

			// Send SMS for urgent reminders (sequence 3 and 4)
			if (user.mobile && sequence >= 3) {
				try {
					const smsMessage = this.getSmsMessage(sequence, kycStatus);
					await (twilioVerifyService as any).sendSMS(user.mobile, smsMessage);
					result.smsSent = true;
				} catch (smsError) {
					console.error("[KYC Notification] SMS send failed:", smsError);
				}
			}

			// Update reminder record
			const [reminder] = await db
				.insert(kycUpgradeReminders)
				.values({
					userId,
					reminderType: "combined",
					reminderSequence: sequence,
					currentKycTier: kycStatus.currentTier,
					targetKycTier:
						kycStatus.currentTier === "basic" ? "enhanced" : "accredited",
					missingSteps: kycStatus.missingSteps,
					emailSent: result.emailSent,
					emailSentAt: result.emailSent ? new Date() : null,
					inAppCreated: true,
					inAppNotificationId: notification.id,
					smsSent: result.smsSent,
					smsSentAt: result.smsSent ? new Date() : null,
					scheduledFor: new Date(),
					sentAt: new Date(),
					status: "sent",
					metadata: {
						blockedProducts:
							BLOCKED_PRODUCTS_BY_TIER[
								kycStatus.currentTier as keyof typeof BLOCKED_PRODUCTS_BY_TIER
							] || [],
						percentComplete: kycStatus.percentComplete,
					},
				})
				.returning();

			result.reminderId = reminder.id;
			result.success = true;

			console.log(
				`[KYC Notification] Sent reminder #${sequence} to user ${userId} (email: ${result.emailSent}, in-app: ${result.inAppCreated}, sms: ${result.smsSent})`,
			);

			return result;
		} catch (error) {
			console.error("[KYC Notification] Error sending reminder:", error);
			return result;
		}
	}

	/**
	 * Process all pending scheduled reminders
	 */
	async processScheduledReminders(): Promise<{
		processed: number;
		sent: number;
	}> {
		const stats = { processed: 0, sent: 0 };

		try {
			const now = new Date();

			// Get pending reminders that are due
			const pendingReminders = await db
				.select()
				.from(kycUpgradeReminders)
				.where(
					and(
						eq(kycUpgradeReminders.status, "pending"),
						lte(kycUpgradeReminders.scheduledFor, now),
					),
				)
				.limit(50);

			console.log(
				`[KYC Notification] Processing ${pendingReminders.length} pending reminders`,
			);

			for (const reminder of pendingReminders) {
				stats.processed++;

				// Check if user has completed KYC since scheduling
				const kycStatus = await this.getKycStatus(reminder.userId);

				if (kycStatus.missingSteps.length === 0) {
					// User completed KYC, expire this reminder
					await db
						.update(kycUpgradeReminders)
						.set({ status: "expired", sentAt: now })
						.where(eq(kycUpgradeReminders.id, reminder.id));

					// Expire all other pending reminders for this user
					await db
						.update(kycUpgradeReminders)
						.set({ status: "expired" })
						.where(
							and(
								eq(kycUpgradeReminders.userId, reminder.userId),
								eq(kycUpgradeReminders.status, "pending"),
							),
						);

					console.log(
						`[KYC Notification] User ${reminder.userId} completed KYC, expiring reminders`,
					);
					continue;
				}

				// Send the reminder
				const result = await this.sendReminder(
					reminder.userId,
					reminder.reminderSequence,
				);

				if (result.success) {
					stats.sent++;

					// Update the scheduled reminder as sent
					await db
						.update(kycUpgradeReminders)
						.set({
							status: "sent",
							sentAt: now,
							emailSent: result.emailSent,
							emailSentAt: result.emailSent ? now : null,
							inAppCreated: result.inAppCreated,
							smsSent: result.smsSent,
							smsSentAt: result.smsSent ? now : null,
						})
						.where(eq(kycUpgradeReminders.id, reminder.id));
				}
			}

			console.log(
				`[KYC Notification] Processed ${stats.processed} reminders, sent ${stats.sent}`,
			);
			return stats;
		} catch (error) {
			console.error(
				"[KYC Notification] Error processing scheduled reminders:",
				error,
			);
			return stats;
		}
	}

	/**
	 * Mark reminder as acknowledged when user clicks "Complete KYC"
	 */
	async acknowledgeReminder(
		userId: string,
		reminderId?: string,
	): Promise<void> {
		try {
			const whereClause = reminderId
				? eq(kycUpgradeReminders.id, reminderId)
				: and(
						eq(kycUpgradeReminders.userId, userId),
						eq(kycUpgradeReminders.status, "sent"),
					);

			await db
				.update(kycUpgradeReminders)
				.set({
					userAcknowledged: true,
					acknowledgedAt: new Date(),
					status: "acknowledged",
				})
				.where(whereClause);

			console.log(
				`[KYC Notification] Reminder acknowledged for user ${userId}`,
			);
		} catch (error) {
			console.error("[KYC Notification] Error acknowledging reminder:", error);
		}
	}

	/**
	 * Get pending in-app notifications for a user
	 */
	async getPendingNotifications(userId: string): Promise<{
		hasIncompleteKyc: boolean;
		currentTier: string;
		percentComplete: number;
		missingSteps: string[];
		blockedProducts: string[];
		urgencyLevel: "low" | "medium" | "high";
		notifications: any[];
	}> {
		const kycStatus = await this.getKycStatus(userId);

		// Get unread KYC notifications
		const notifications = await db
			.select()
			.from(userNotifications)
			.where(
				and(
					eq(userNotifications.userId, userId),
					eq(userNotifications.isRead, false),
					or(
						sql`${userNotifications.actionUrl} LIKE '%/kyc%'`,
						sql`${userNotifications.title} LIKE '%KYC%'`,
					),
				),
			)
			.limit(5);

		// Determine urgency based on how many reminders have been sent
		const [reminderCount] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(kycUpgradeReminders)
			.where(
				and(
					eq(kycUpgradeReminders.userId, userId),
					eq(kycUpgradeReminders.status, "sent"),
				),
			);

		const sentCount = Number(reminderCount?.count || 0);
		let urgencyLevel: "low" | "medium" | "high" = "low";
		if (sentCount >= 3) urgencyLevel = "high";
		else if (sentCount >= 2) urgencyLevel = "medium";

		return {
			hasIncompleteKyc: kycStatus.missingSteps.length > 0,
			currentTier: kycStatus.currentTier,
			percentComplete: kycStatus.percentComplete,
			missingSteps: kycStatus.missingSteps.map(
				(step) => KYC_STEPS[step as keyof typeof KYC_STEPS]?.name || step,
			),
			blockedProducts:
				BLOCKED_PRODUCTS_BY_TIER[
					kycStatus.currentTier as keyof typeof BLOCKED_PRODUCTS_BY_TIER
				] || [],
			urgencyLevel,
			notifications,
		};
	}

	// Helper methods for generating content
	private getNotificationTitle(sequence: number, kycStatus: KycStatus): string {
		switch (sequence) {
			case 1:
				return "Complete Your KYC to Unlock All Features";
			case 2:
				return `Your KYC is ${kycStatus.percentComplete}% Complete - Finish Now`;
			case 3:
				return "⚠️ Action Required: Complete KYC to Continue";
			case 4:
				return "🚨 Final Notice: Complete KYC to Avoid Restrictions";
			default:
				return "Complete Your KYC Verification";
		}
	}

	private getNotificationMessage(
		sequence: number,
		kycStatus: KycStatus,
	): string {
		const blockedProducts =
			BLOCKED_PRODUCTS_BY_TIER[
				kycStatus.currentTier as keyof typeof BLOCKED_PRODUCTS_BY_TIER
			] || [];
		const nextStep = kycStatus.missingSteps[0];
		const stepName =
			KYC_STEPS[nextStep as keyof typeof KYC_STEPS]?.name || nextStep;

		switch (sequence) {
			case 1:
				return `Complete your KYC verification to access all FintekPro features. Next step: ${stepName}. Currently blocked: ${blockedProducts.slice(0, 3).join(", ")}.`;
			case 2:
				return `You're ${kycStatus.percentComplete}% done! Just ${kycStatus.missingSteps.length} more step(s) to unlock full trading access. Complete ${stepName} now.`;
			case 3:
				return `Important: Your account has limited access due to incomplete KYC. Complete verification within 7 days to avoid further restrictions.`;
			case 4:
				return `Final reminder: Complete your KYC immediately to maintain account access. Some features may be restricted until verification is complete.`;
			default:
				return `Complete your KYC to access all features. ${kycStatus.missingSteps.length} step(s) remaining.`;
		}
	}

	private getSmsMessage(sequence: number, kycStatus: KycStatus): string {
		if (sequence >= 4) {
			return `[FintekPro] URGENT: Complete your KYC immediately to avoid account restrictions. Visit app to verify now.`;
		}
		return `[FintekPro] Complete your KYC (${kycStatus.percentComplete}% done) to unlock all trading features. Open app to continue.`;
	}

	private async sendKycReminderEmail(
		email: string,
		name: string,
		sequence: number,
		kycStatus: KycStatus,
	): Promise<boolean> {
		const blockedProducts =
			BLOCKED_PRODUCTS_BY_TIER[
				kycStatus.currentTier as keyof typeof BLOCKED_PRODUCTS_BY_TIER
			] || [];
		const urgencyColor = sequence >= 3 ? "#dc2626" : "#1e40af";
		const urgencyBadge = sequence >= 3 ? "⚠️ ACTION REQUIRED" : "📋 REMINDER";

		const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${urgencyColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .progress-bar { background-color: #e5e7eb; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden; }
          .progress-fill { background-color: #10b981; height: 100%; transition: width 0.3s; }
          .step-list { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .step-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .step-item:last-child { border-bottom: none; }
          .step-pending { color: #dc2626; }
          .step-complete { color: #10b981; }
          .blocked-products { background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
          .cta-button { display: inline-block; background-color: ${urgencyColor}; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${urgencyBadge}</h1>
            <h2>Complete Your KYC Verification</h2>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            
            <p>${this.getNotificationMessage(sequence, kycStatus)}</p>
            
            <h3>Your KYC Progress</h3>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${kycStatus.percentComplete}%"></div>
            </div>
            <p style="text-align: center; font-weight: bold; color: ${urgencyColor};">${kycStatus.percentComplete}% Complete</p>
            
            <div class="step-list">
              <h4>Remaining Steps:</h4>
              ${kycStatus.missingSteps
								.map(
									(step) => `
                <div class="step-item step-pending">
                  ❌ ${KYC_STEPS[step as keyof typeof KYC_STEPS]?.name || step}
                </div>
              `,
								)
								.join("")}
            </div>
            
            ${
							blockedProducts.length > 0
								? `
              <div class="blocked-products">
                <h4>🔒 Currently Blocked Products:</h4>
                <ul>
                  ${blockedProducts.map((p) => `<li>${p}</li>`).join("")}
                </ul>
              </div>
            `
								: ""
						}
            
            <div style="text-align: center;">
              <a href="https://fintekpro.com/kyc/complete" class="cta-button">
                Complete KYC Now →
              </a>
            </div>
            
            <p style="margin-top: 20px;">
              <strong>Why complete KYC?</strong>
              <ul>
                <li>Access all trading products (Stocks, F&O, IPO, Bonds)</li>
                <li>Higher transaction limits</li>
                <li>Faster withdrawals</li>
                <li>Priority customer support</li>
              </ul>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} FintekPro. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
            <p>If you've already completed your KYC, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

		const text = `
${urgencyBadge}

Dear ${name},

${this.getNotificationMessage(sequence, kycStatus)}

Your KYC Progress: ${kycStatus.percentComplete}% Complete

Remaining Steps:
${kycStatus.missingSteps.map((step) => `- ${KYC_STEPS[step as keyof typeof KYC_STEPS]?.name || step}`).join("\n")}

${
	blockedProducts.length > 0
		? `
Currently Blocked Products:
${blockedProducts.map((p) => `- ${p}`).join("\n")}
`
		: ""
}

Complete your KYC now at: https://fintekpro.com/kyc/complete

© ${new Date().getFullYear()} FintekPro
    `;

		return emailService.sendEmail({
			to: email,
			subject: this.getNotificationTitle(sequence, kycStatus),
			html,
			text,
		});
	}
}

export const kycUpgradeNotificationService =
	KycUpgradeNotificationService.getInstance();
