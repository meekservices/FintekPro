import nodemailer from "nodemailer";
import { db } from "../db";
import {
	users,
	userNotifications,
	notificationPreferences,
} from "@shared/schema";
import { eq } from "drizzle-orm";

interface UsOrderNotificationContext {
	userId: string;
	orderId: string;
	symbol: string;
	side: "buy" | "sell";
	quantity: number;
	priceUsd: number;
	status: string;
	filledAt?: Date;
}

interface RebalanceNotificationContext {
	userId: string;
	suggestionId: string;
	summary: string;
	potentialImpact: string;
}

class UsOrderNotificationService {
	private emailTransporter: nodemailer.Transporter | null = null;
	private isEmailConfigured: boolean = false;
	private fromEmail: string = "noreply@fintekpro.com";

	constructor() {
		this.initializeEmailService();
	}

	private initializeEmailService() {
		const emailHost = process.env.EMAIL_HOST;
		const emailPort = process.env.EMAIL_PORT || "587";
		const emailUser = process.env.EMAIL_USER;
		const emailPass = process.env.EMAIL_PASS;

		if (emailHost && emailUser && emailPass) {
			this.emailTransporter = nodemailer.createTransport({
				host: emailHost,
				port: Number.parseInt(emailPort),
				secure: Number.parseInt(emailPort) === 465,
				auth: {
					user: emailUser,
					pass: emailPass,
				},
			});
			this.isEmailConfigured = true;
			console.log("✅ US Order Notification email service configured");
		} else {
			console.log(
				"⚠️ US Order Notification email not configured - missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS",
			);
		}
	}

	private async getUserPreferences(userId: string) {
		try {
			const [prefs] = await db
				.select()
				.from(notificationPreferences)
				.where(eq(notificationPreferences.userId, userId));
			return (
				prefs || {
					emailEnabled: true,
					pushEnabled: true,
					usOrderFilled: true,
					usOrderCancelled: true,
					usOrderRejected: true,
					usRebalancingSuggestions: true,
				}
			);
		} catch {
			return {
				emailEnabled: true,
				pushEnabled: true,
				usOrderFilled: true,
				usOrderCancelled: true,
				usOrderRejected: true,
				usRebalancingSuggestions: true,
			};
		}
	}

	private async getUserDetails(userId: string) {
		const [user] = await db
			.select({
				email: users.email,
				firstName: users.firstName,
				mobile: users.mobile,
			})
			.from(users)
			.where(eq(users.id, userId));
		return user;
	}

	private async createInAppNotification(
		userId: string,
		type: string,
		title: string,
		message: string,
		entityType?: string,
		entityId?: string,
		metadata?: Record<string, any>,
	) {
		try {
			await db.insert(userNotifications).values({
				userId,
				type,
				title,
				message,
				actionUrl:
					entityType === "order" ? "/us-trading?tab=orders" : undefined,
				priority: type.includes("rejected") ? "high" : "medium",
			});
			console.log(
				`📱 Created in-app notification for user ${userId}: ${title}`,
			);
		} catch (error) {
			console.error("Failed to create in-app notification:", error);
		}
	}

	private async sendEmail(
		to: string,
		subject: string,
		html: string,
	): Promise<boolean> {
		if (!this.isEmailConfigured || !this.emailTransporter) {
			console.log(`📧 US Trading Email (mock): ${subject} to ${to}`);
			return false;
		}

		try {
			await this.emailTransporter.sendMail({
				from: this.fromEmail,
				to,
				subject,
				html,
			});
			console.log(`📧 Sent US Trading email: ${subject} to ${to}`);
			return true;
		} catch (error) {
			console.error("Failed to send US Trading email:", error);
			return false;
		}
	}

	async notifyOrderFilled(context: UsOrderNotificationContext): Promise<void> {
		const prefs = await this.getUserPreferences(context.userId);
		if (!prefs.usOrderFilled) return;

		const user = await this.getUserDetails(context.userId);
		if (!user) return;

		const title = `Order Filled: ${context.side.toUpperCase()} ${context.symbol}`;
		const message = `Your ${context.side} order for ${context.quantity} shares of ${context.symbol} at $${context.priceUsd.toFixed(2)} has been filled.`;

		if (prefs.pushEnabled) {
			await this.createInAppNotification(
				context.userId,
				"us_order_filled",
				title,
				message,
				"order",
				context.orderId,
				{
					symbol: context.symbol,
					side: context.side,
					quantity: context.quantity,
					price: context.priceUsd,
				},
			);
		}

		if (prefs.emailEnabled && user.email) {
			const html = this.generateOrderEmailHtml({
				title,
				message,
				details: [
					{ label: "Symbol", value: context.symbol },
					{ label: "Action", value: context.side.toUpperCase() },
					{ label: "Quantity", value: context.quantity.toString() },
					{ label: "Price", value: `$${context.priceUsd.toFixed(2)}` },
					{
						label: "Total Value",
						value: `$${(context.quantity * context.priceUsd).toFixed(2)}`,
					},
					{ label: "Status", value: "Filled" },
				],
				actionUrl: "/us-trading?tab=orders",
				actionText: "View Order Details",
			});
			await this.sendEmail(user.email, `[FintekPro] ${title}`, html);
		}
	}

	async notifyOrderCancelled(
		context: UsOrderNotificationContext,
	): Promise<void> {
		const prefs = await this.getUserPreferences(context.userId);
		if (!prefs.usOrderCancelled) return;

		const user = await this.getUserDetails(context.userId);
		if (!user) return;

		const title = `Order Cancelled: ${context.symbol}`;
		const message = `Your ${context.side} order for ${context.quantity} shares of ${context.symbol} has been cancelled.`;

		if (prefs.pushEnabled) {
			await this.createInAppNotification(
				context.userId,
				"us_order_cancelled",
				title,
				message,
				"order",
				context.orderId,
			);
		}

		if (prefs.emailEnabled && user.email) {
			const html = this.generateOrderEmailHtml({
				title,
				message,
				details: [
					{ label: "Symbol", value: context.symbol },
					{ label: "Action", value: context.side.toUpperCase() },
					{ label: "Quantity", value: context.quantity.toString() },
					{ label: "Status", value: "Cancelled" },
				],
				actionUrl: "/us-trading?tab=orders",
				actionText: "View Orders",
			});
			await this.sendEmail(user.email, `[FintekPro] ${title}`, html);
		}
	}

	async notifyOrderRejected(
		context: UsOrderNotificationContext,
		reason?: string,
	): Promise<void> {
		const prefs = await this.getUserPreferences(context.userId);
		if (!prefs.usOrderRejected) return;

		const user = await this.getUserDetails(context.userId);
		if (!user) return;

		const title = `Order Rejected: ${context.symbol}`;
		const message = `Your ${context.side} order for ${context.quantity} shares of ${context.symbol} was rejected.${reason ? ` Reason: ${reason}` : ""}`;

		if (prefs.pushEnabled) {
			await this.createInAppNotification(
				context.userId,
				"us_order_rejected",
				title,
				message,
				"order",
				context.orderId,
				{ reason },
			);
		}

		if (prefs.emailEnabled && user.email) {
			const html = this.generateOrderEmailHtml({
				title,
				message,
				details: [
					{ label: "Symbol", value: context.symbol },
					{ label: "Action", value: context.side.toUpperCase() },
					{ label: "Quantity", value: context.quantity.toString() },
					{ label: "Status", value: "Rejected" },
					...(reason ? [{ label: "Reason", value: reason }] : []),
				],
				actionUrl: "/us-trading?tab=orders",
				actionText: "View Orders",
				isAlert: true,
			});
			await this.sendEmail(user.email, `[FintekPro] ${title}`, html);
		}
	}

	async notifyRebalancingSuggestion(
		context: RebalanceNotificationContext,
	): Promise<void> {
		const prefs = await this.getUserPreferences(context.userId);
		if (!prefs.usRebalancingSuggestions) return;

		const user = await this.getUserDetails(context.userId);
		if (!user) return;

		const title = "New Portfolio Rebalancing Suggestion";
		const message = context.summary;

		if (prefs.pushEnabled) {
			await this.createInAppNotification(
				context.userId,
				"rebalancing_suggestion",
				title,
				message,
				"rebalancing",
				context.suggestionId,
				{ potentialImpact: context.potentialImpact },
			);
		}

		if (prefs.emailEnabled && user.email) {
			const html = this.generateRebalanceEmailHtml({
				title,
				summary: context.summary,
				potentialImpact: context.potentialImpact,
				actionUrl: "/us-trading?tab=portfolio",
				actionText: "View Suggestion",
			});
			await this.sendEmail(user.email, `[FintekPro] ${title}`, html);
		}
	}

	private generateOrderEmailHtml(options: {
		title: string;
		message: string;
		details: Array<{ label: string; value: string }>;
		actionUrl: string;
		actionText: string;
		isAlert?: boolean;
	}): string {
		const bgColor = options.isAlert ? "#FEF3F2" : "#F0FDF4";
		const borderColor = options.isAlert ? "#FCA5A5" : "#86EFAC";

		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">FintekPro US Trading</h1>
            </div>
            
            <div style="padding: 24px;">
              <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 18px;">${options.title}</h2>
                <p style="margin: 0; color: #4b5563;">${options.message}</p>
              </div>
              
              <table style="width: 100%; border-collapse: collapse;">
                ${options.details
									.map(
										(d) => `
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 40%;">${d.label}</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 500;">${d.value}</td>
                  </tr>
                `,
									)
									.join("")}
              </table>
              
              <div style="margin-top: 24px; text-align: center;">
                <a href="${options.actionUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500;">${options.actionText}</a>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from FintekPro.</p>
              <p style="margin: 8px 0 0 0;">You can manage your notification preferences in Settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}

	private generateRebalanceEmailHtml(options: {
		title: string;
		summary: string;
		potentialImpact: string;
		actionUrl: string;
		actionText: string;
	}): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">FintekPro AI Insights</h1>
            </div>
            
            <div style="padding: 24px;">
              <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 18px;">${options.title}</h2>
                <p style="margin: 0; color: #4b5563;">${options.summary}</p>
              </div>
              
              <div style="background: #F0FDF4; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">Potential Impact</h3>
                <p style="margin: 0; color: #15803d;">${options.potentialImpact}</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${options.actionUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500;">${options.actionText}</a>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">AI-powered portfolio analysis from FintekPro.</p>
              <p style="margin: 8px 0 0 0;">You can manage your notification preferences in Settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}

	async getUnreadCount(userId: string): Promise<number> {
		try {
			const notifications = await db
				.select({ id: userNotifications.id })
				.from(userNotifications)
				.where(eq(userNotifications.userId, userId));
			return notifications.filter((n: any) => !n.isRead).length;
		} catch {
			return 0;
		}
	}

	async getNotifications(userId: string, limit: number = 20): Promise<any[]> {
		try {
			const notifications = await db
				.select()
				.from(userNotifications)
				.where(eq(userNotifications.userId, userId))
				.orderBy(userNotifications.createdAt)
				.limit(limit);
			return notifications;
		} catch {
			return [];
		}
	}

	async markAsRead(notificationId: string): Promise<boolean> {
		try {
			await db
				.update(userNotifications)
				.set({ isRead: true })
				.where(eq(userNotifications.id, notificationId));
			return true;
		} catch {
			return false;
		}
	}

	async markAllAsRead(userId: string): Promise<boolean> {
		try {
			await db
				.update(userNotifications)
				.set({ isRead: true })
				.where(eq(userNotifications.userId, userId));
			return true;
		} catch {
			return false;
		}
	}
}

export const usOrderNotificationService = new UsOrderNotificationService();
