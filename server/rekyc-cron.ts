import cron from "node-cron";
import {
	getUsersRequiringReminders,
	incrementReminderCount,
} from "./rekyc-service";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "./email-service";
import { smsService } from "./services/sms-service";

/**
 * Re-KYC Reminder Cron Job
 * Runs daily at 9:00 AM to check for users requiring KYC renewal reminders
 * Sends reminders at 60, 30, and 15 days before expiry
 */

interface ReminderContent {
	subject: string;
	emailBody: string;
	smsBody: string;
}

/**
 * Get reminder content based on reminder type
 */
function getReminderContent(
	name: string | null,
	daysUntilExpiry: number,
	reminderType: "60_day" | "30_day" | "15_day",
): ReminderContent {
	const displayName = name || "Valued Customer";

	const urgencyMap = {
		"60_day": "2 months",
		"30_day": "30 days",
		"15_day": "15 days",
	};

	const urgency = urgencyMap[reminderType];

	return {
		subject: `⚠️ Re-KYC Required in ${urgency} - FintekPro`,
		emailBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Re-KYC Reminder</h2>
        <p>Dear ${displayName},</p>
        
        <p>This is a friendly reminder that your KYC verification will expire in <strong>${daysUntilExpiry} days</strong>.</p>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <strong>⚠️ Important:</strong> To continue enjoying uninterrupted access to:
          <ul>
            <li>Mutual Fund investments</li>
            <li>Stock trading</li>
            <li>International transactions</li>
          </ul>
          Please complete your Re-KYC before the expiry date.
        </div>
        
        <p><strong>Why Re-KYC is required:</strong><br>
        Regulatory authorities require periodic KYC updates to ensure the security of your account and compliance with financial regulations.</p>
        
        <p><strong>The process is simple:</strong></p>
        <ol>
          <li>Log in to your FintekPro account</li>
          <li>Navigate to Profile → KYC Status</li>
          <li>Click "Complete Re-KYC"</li>
          <li>Update any changed information</li>
          <li>Submit for verification</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.REPLIT_DEV_DOMAIN || "https://app.fintekpro.com"}/profile?tab=kyc" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete Re-KYC Now
          </a>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          If you have any questions, please contact our support team.<br>
          This is an automated reminder. Please do not reply to this email.
        </p>
      </div>
    `,
		smsBody: `FintekPro: Your KYC expires in ${daysUntilExpiry} days. Complete Re-KYC now to avoid service interruption. Visit ${process.env.REPLIT_DEV_DOMAIN || "app.fintekpro.com"}/profile`,
	};
}

/**
 * Send email reminder using the configured email service
 */
async function sendEmailReminder(
	email: string,
	content: ReminderContent,
): Promise<boolean> {
	try {
		console.log(`[Re-KYC Email] Sending to ${email}`);

		const success = await emailService.sendEmail({
			to: email,
			subject: content.subject,
			html: content.emailBody,
			text: content.smsBody, // Fallback plain text version
		});

		if (success) {
			console.log(`[Re-KYC Email] Successfully sent to ${email}`);
		} else {
			console.log(
				`[Re-KYC Email] Simulated send to ${email} (email service not configured)`,
			);
		}

		return true; // Return true even for simulated to continue flow
	} catch (error) {
		console.error(`[Re-KYC Email] Failed to send to ${email}:`, error);
		return false;
	}
}

/**
 * Send SMS reminder using the configured Twilio SMS service
 */
async function sendSMSReminder(
	mobile: string,
	content: ReminderContent,
): Promise<boolean> {
	try {
		console.log(`[Re-KYC SMS] Sending to ${mobile}`);

		const result = await (smsService as any).sendSMS({
			to: mobile,
			message: content.smsBody,
		});

		if (result.success) {
			console.log(
				`[Re-KYC SMS] Successfully sent to ${mobile}, SID: ${result.messageSid}`,
			);
		} else {
			console.log(`[Re-KYC SMS] Failed to send to ${mobile}: ${result.error}`);
		}

		return result.success;
	} catch (error) {
		console.error(`[Re-KYC SMS] Failed to send to ${mobile}:`, error);
		return false;
	}
}

/**
 * Process Re-KYC reminders for all eligible users
 */
export async function processReKYCReminders(): Promise<{
	totalChecked: number;
	remindersSent: number;
	errors: number;
}> {
	console.log("[Re-KYC Cron] Starting daily Re-KYC reminder check...");

	const usersNeedingReminders = await getUsersRequiringReminders();
	console.log(
		`[Re-KYC Cron] Found ${usersNeedingReminders.length} users requiring reminders`,
	);

	let remindersSent = 0;
	let errors = 0;

	for (const userInfo of usersNeedingReminders) {
		try {
			// Get user email and mobile from users table
			const [user] = await db
				.select()
				.from(users)
				.where(eq(users.id, userInfo.userId));

			if (!user) {
				console.warn(
					`[Re-KYC Cron] User ${userInfo.userId} not found in users table`,
				);
				errors++;
				continue;
			}

			const email = user.email;
			const mobile = user.mobile;

			// Get reminder content
			const content = getReminderContent(
				userInfo.name,
				userInfo.daysUntilExpiry,
				userInfo.reminderType,
			);

			// Send email if available
			if (email) {
				const emailSent = await sendEmailReminder(email, content);
				if (emailSent) {
					remindersSent++;
				} else {
					errors++;
				}
			}

			// Send SMS if available
			if (mobile) {
				const smsSent = await sendSMSReminder(mobile, content);
				if (!smsSent) {
					errors++;
				}
			}

			// Increment reminder count in database
			await incrementReminderCount(userInfo.userId);

			console.log(
				`[Re-KYC Cron] Sent ${userInfo.reminderType} reminder to ${userInfo.name || userInfo.userId} (${userInfo.daysUntilExpiry} days until expiry)`,
			);
		} catch (error) {
			console.error(
				`[Re-KYC Cron] Error processing reminder for user ${userInfo.userId}:`,
				error,
			);
			errors++;
		}
	}

	const summary = {
		totalChecked: usersNeedingReminders.length,
		remindersSent,
		errors,
	};

	console.log("[Re-KYC Cron] Daily reminder check complete:", summary);
	return summary;
}

/**
 * Initialize Re-KYC cron job
 * Runs every day at 9:00 AM
 */
export function initReKYCCron() {
	// Schedule: Run at 9:00 AM every day
	// Cron format: minute hour day month dayOfWeek
	cron.schedule("0 9 * * *", async () => {
		console.log(
			"[Re-KYC Cron] Scheduled task triggered at",
			new Date().toISOString(),
		);
		await processReKYCReminders();
	});

	console.log(
		"✅ Re-KYC reminder cron job initialized (runs daily at 9:00 AM)",
	);
}

/**
 * Manual trigger for testing (can be called via API)
 */
export async function triggerReKYCRemindersManually() {
	console.log("[Re-KYC Cron] Manual trigger initiated");
	return await processReKYCReminders();
}
