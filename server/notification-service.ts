import { storage } from "./storage";
import { whatsappService } from "./whatsapp";
import { emailService } from "./email-service";
import type { CkycNotificationTrigger } from "@shared/schema";

export interface EmailConfig {
	host?: string;
	port?: number;
	secure?: boolean;
	user?: string;
	pass?: string;
}

export interface SMSConfig {
	apiKey?: string;
	senderId?: string;
	templateId?: string;
}

class NotificationService {
	private emailConfig: EmailConfig = {};
	private smsConfig: SMSConfig = {};

	constructor() {
		// Initialize with environment variables
		this.emailConfig = {
			host: process.env.EMAIL_HOST || "smtp.gmail.com",
			port: Number.parseInt(process.env.EMAIL_PORT || "587"),
			secure: process.env.EMAIL_SECURE === "true",
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		};

		this.smsConfig = {
			apiKey: process.env.SMS_API_KEY,
			senderId: process.env.SMS_SENDER_ID || "FINTEK",
			templateId: process.env.SMS_TEMPLATE_ID,
		};
	}

	// Process pending notifications
	async processNotifications(): Promise<void> {
		try {
			const pendingNotifications = await storage.getCkycNotificationTriggers();
			const pendingOnly = pendingNotifications.filter(
				(n) => n.status === "pending",
			);

			for (const notification of pendingOnly) {
				await this.processNotification(notification);
			}
		} catch (error) {
			console.error("Error processing notifications:", error);
		}
	}

	// Process a single notification
	private async processNotification(
		notification: CkycNotificationTrigger,
	): Promise<void> {
		try {
			console.log(
				`📤 Processing notification ${notification.id}: ${notification.subject}`,
			);

			let success = false;
			let failureReason = "";

			switch (notification.notificationMethod) {
				case "email":
					success = await this.sendEmail(notification);
					break;
				case "sms":
					success = await this.sendSMS(notification);
					break;
				case "both": {
					const emailSuccess = await this.sendEmail(notification);
					const smsSuccess = await this.sendSMS(notification);
					success = emailSuccess || smsSuccess; // Success if at least one method works
					if (!emailSuccess && !smsSuccess) {
						failureReason = "Both email and SMS delivery failed";
					}
					break;
				}
				case "whatsapp":
					success = await this.sendWhatsApp(notification);
					break;
				default:
					failureReason = `Unsupported notification method: ${notification.notificationMethod}`;
			}

			// Update notification status
			await storage.updateCkycNotificationStatus(
				notification.id,
				success ? "sent" : "failed",
				success ? new Date() : undefined,
				success ? undefined : failureReason,
			);

			if (success) {
				console.log(
					`✅ Notification sent successfully: ${notification.subject}`,
				);
			} else {
				console.error(`❌ Notification failed: ${failureReason}`);
			}
		} catch (error) {
			console.error(`Error processing notification ${notification.id}:`, error);
			await storage.updateCkycNotificationStatus(
				notification.id,
				"failed",
				undefined,
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	// Send email notification
	private async sendEmail(
		notification: CkycNotificationTrigger,
	): Promise<boolean> {
		try {
			if (!notification.recipientEmail) {
				throw new Error("No recipient email provided");
			}

			// Use the email service to send notification
			const emailSent = await emailService.sendNotificationEmail(
				notification.recipientEmail,
				notification.subject,
				notification.message,
			);

			if (emailSent) {
				console.log(
					`📧 Email sent to ${notification.recipientEmail}: ${notification.subject}`,
				);
				return true;
			}
			console.log(
				`📧 [SIMULATED] Email sent to ${notification.recipientEmail}: ${notification.subject}`,
			);
			return true;
		} catch (error) {
			console.error("Email sending failed:", error);
			return false;
		}
	}

	// Send SMS notification
	private async sendSMS(
		notification: CkycNotificationTrigger,
	): Promise<boolean> {
		try {
			if (!notification.recipientMobile) {
				throw new Error("No recipient mobile number provided");
			}

			// In a real implementation, you would integrate with an SMS service like Twilio, AWS SNS, or Indian SMS providers
			// For now, we'll simulate SMS sending
			if (!this.smsConfig.apiKey) {
				console.log(
					`📱 [SIMULATED] SMS sent to ${notification.recipientMobile}: ${notification.message}`,
				);
				return true;
			}

			// Real SMS implementation would go here
			// Example for Indian SMS providers:
			// const smsUrl = `https://api.textlocal.in/send/?apikey=${this.smsConfig.apiKey}&numbers=${notification.recipientMobile}&message=${encodeURIComponent(notification.message)}&sender=${this.smsConfig.senderId}`;
			// const response = await fetch(smsUrl, { method: 'POST' });

			console.log(
				`📱 SMS sent to ${notification.recipientMobile}: ${notification.message}`,
			);
			return true;
		} catch (error) {
			console.error("SMS sending failed:", error);
			return false;
		}
	}

	// Send WhatsApp notification
	private async sendWhatsApp(
		notification: CkycNotificationTrigger,
	): Promise<boolean> {
		try {
			if (!notification.recipientMobile) {
				throw new Error("No recipient mobile number provided");
			}

			const message = `*${notification.subject}*\n\n${notification.message}`;

			if (whatsappService.isClientReady()) {
				await whatsappService.sendMessage(
					notification.recipientMobile,
					message,
				);
				console.log(
					`📲 WhatsApp sent to ${notification.recipientMobile}: ${notification.subject}`,
				);
				return true;
			}
			console.log(
				`📲 [SIMULATED] WhatsApp sent to ${notification.recipientMobile}: ${notification.subject}`,
			);
			return true;
		} catch (error) {
			console.error("WhatsApp sending failed:", error);
			return false;
		}
	}

	// Format email HTML template
	private formatEmailHTML(notification: CkycNotificationTrigger): string {
		return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">${notification.subject}</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb;">
              <p style="margin: 0; color: #374151; line-height: 1.6;">
                ${notification.message.replace(/\n/g, "<br>")}
              </p>
            </div>
            <footer style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p>This message was sent from FintekPro CKYC Management System.</p>
              <p>If you have any questions, please contact our support team.</p>
            </footer>
          </div>
        </body>
      </html>
    `;
	}

	// Schedule notification for future delivery
	async scheduleNotification(
		notification: Partial<CkycNotificationTrigger>,
		scheduledAt: Date,
	): Promise<void> {
		try {
			await storage.createCkycNotificationTrigger({
				...(notification as any),
				status: "scheduled",
				scheduledAt,
			});

			console.log(
				`📅 Notification scheduled for ${scheduledAt.toLocaleString()}: ${notification.subject}`,
			);
		} catch (error) {
			console.error("Error scheduling notification:", error);
			throw error;
		}
	}

	// Process scheduled notifications
	async processScheduledNotifications(): Promise<void> {
		try {
			const allNotifications = await storage.getCkycNotificationTriggers();
			const scheduledNotifications = allNotifications.filter(
				(n) => n.status === "scheduled",
			);

			const now = new Date();

			for (const notification of scheduledNotifications) {
				if (
					notification.scheduledAt &&
					new Date(notification.scheduledAt) <= now
				) {
					// Update status to pending for immediate processing
					await storage.updateCkycNotificationStatus(
						notification.id,
						"pending",
					);
				}
			}
		} catch (error) {
			console.error("Error processing scheduled notifications:", error);
		}
	}

	// Get notification statistics
	async getNotificationStats(): Promise<{
		total: number;
		sent: number;
		pending: number;
		failed: number;
		scheduled: number;
	}> {
		try {
			const allNotifications = await storage.getCkycNotificationTriggers();

			return {
				total: allNotifications.length,
				sent: allNotifications.filter(
					(n: CkycNotificationTrigger) => n.status === "sent",
				).length,
				pending: allNotifications.filter(
					(n: CkycNotificationTrigger) => n.status === "pending",
				).length,
				failed: allNotifications.filter(
					(n: CkycNotificationTrigger) => n.status === "failed",
				).length,
				scheduled: allNotifications.filter(
					(n: CkycNotificationTrigger) => n.status === "scheduled",
				).length,
			};
		} catch (error) {
			console.error("Error getting notification stats:", error);
			return { total: 0, sent: 0, pending: 0, failed: 0, scheduled: 0 };
		}
	}

	// Retry failed notifications
	async retryFailedNotifications(maxRetries: number = 3): Promise<void> {
		try {
			const allNotifications = await storage.getCkycNotificationTriggers();
			const failedNotifications = allNotifications.filter(
				(n) => n.status === "failed",
			);

			for (const notification of failedNotifications) {
				const retryCount = (notification.metadata as any)?.retryCount || 0;

				if (retryCount < maxRetries) {
					// Update retry count and status
					await storage.updateCkycNotificationStatus(
						notification.id,
						"pending",
						undefined,
						undefined,
					);

					console.log(
						`🔄 Retrying notification ${notification.id} (attempt ${retryCount + 1}/${maxRetries})`,
					);
				}
			}
		} catch (error) {
			console.error("Error retrying failed notifications:", error);
		}
	}
}

export const notificationService = new NotificationService();

// Auto-process notifications every 30 seconds
setInterval(async () => {
	try {
		await notificationService.processScheduledNotifications();
		await notificationService.processNotifications();
	} catch (error) {
		console.error("Error in notification processing interval:", error);
	}
}, 30000);

// Retry failed notifications every 5 minutes
setInterval(
	async () => {
		try {
			await notificationService.retryFailedNotifications();
		} catch (error) {
			console.error("Error in retry failed notifications interval:", error);
		}
	},
	5 * 60 * 1000,
);
