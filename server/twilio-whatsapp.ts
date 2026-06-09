import twilio from "twilio";
import { randomUUID } from "crypto";
import { storage } from "./storage";

interface AuthSession {
	id: string;
	phoneNumber: string;
	verificationCode: string;
	userId?: string;
	createdAt: Date;
	expiresAt: Date;
	verified: boolean;
}

export class TwilioWhatsAppService {
	private client: ReturnType<typeof twilio>;
	private twilioPhoneNumber: string;
	private authSessions: Map<string, AuthSession> = new Map();
	private isConfigured: boolean = false;

	constructor() {
		const accountSid = process.env.TWILIO_ACCOUNT_SID;
		const authToken = process.env.TWILIO_AUTH_TOKEN;
		const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

		if (!accountSid || !authToken || !phoneNumber) {
			console.warn(
				"⚠️ Twilio credentials not configured. WhatsApp login will not work.",
			);
			this.isConfigured = false;
			this.client = null as any;
			this.twilioPhoneNumber = "";
			return;
		}

		this.client = twilio(accountSid, authToken);
		this.twilioPhoneNumber = phoneNumber;
		this.isConfigured = true;
		console.log("✅ Twilio WhatsApp service initialized successfully");
	}

	async initialize() {
		// Twilio doesn't need initialization like whatsapp-web.js
		if (this.isConfigured) {
			console.log("✅ Twilio WhatsApp service ready to use");
		}
	}

	/**
	 * Format phone number for WhatsApp (must include whatsapp: prefix for Twilio)
	 */
	private formatWhatsAppNumber(phoneNumber: string): string {
		// Remove any existing prefixes
		let cleaned = phoneNumber.replace(/^(whatsapp:|tel:|\+)/gi, "");

		// Ensure it has country code
		if (!cleaned.startsWith("91") && cleaned.length === 10) {
			cleaned = "91" + cleaned; // Assume India if 10 digits
		}

		return `whatsapp:+${cleaned}`;
	}

	/**
	 * Send WhatsApp message via Twilio
	 */
	async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
		if (!this.isConfigured) {
			console.error("Twilio WhatsApp not configured");
			return false;
		}

		try {
			const to = this.formatWhatsAppNumber(phoneNumber);
			const from = `whatsapp:${this.twilioPhoneNumber}`;

			await this.client.messages.create({
				body: message,
				from: from,
				to: to,
			});

			console.log(`✅ WhatsApp message sent to ${phoneNumber}`);
			return true;
		} catch (error: any) {
			console.error("Failed to send WhatsApp message:", error.message);
			return false;
		}
	}

	/**
	 * Send login OTP via WhatsApp
	 */
	async sendLoginOTP(phoneNumber: string, otp: string): Promise<boolean> {
		const message =
			`🔐 *FintekPro Login OTP*\n\n` +
			`Your verification code is: *${otp}*\n\n` +
			`This code will expire in 5 minutes.\n` +
			`Do not share this code with anyone.`;

		return await this.sendMessage(phoneNumber, message);
	}

	/**
	 * Create authentication session for WhatsApp login
	 */
	async createAuthSession(phoneNumber: string): Promise<string> {
		if (!this.isConfigured) {
			throw new Error("Twilio WhatsApp not configured");
		}

		// Clean the phone number
		const cleanedNumber = phoneNumber.replace(/\D/g, "");

		// Check if user exists
		const users = await storage.getAllUsers();
		const user = users.find(
			(u) => u.mobile === phoneNumber || u.mobile === cleanedNumber,
		);

		// Generate 6-digit verification code
		const verificationCode = Math.floor(
			100000 + Math.random() * 900000,
		).toString();
		const sessionId = randomUUID();

		const session: AuthSession = {
			id: sessionId,
			phoneNumber: cleanedNumber,
			verificationCode,
			userId: user?.userId,
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
			verified: false,
		};

		this.authSessions.set(sessionId, session);

		// Send verification code via WhatsApp
		const message =
			`🔐 *FintekPro Login*\n\n` +
			`Your verification code is: *${verificationCode}*\n\n` +
			`This code expires in 5 minutes.\n` +
			`Enter this code in the app to complete your login.`;

		const sent = await this.sendMessage(phoneNumber, message);

		if (!sent) {
			this.authSessions.delete(sessionId);
			throw new Error("Failed to send WhatsApp verification code");
		}

		console.log(
			`✅ Auth session created for ${phoneNumber}, session: ${sessionId}`,
		);
		return sessionId;
	}

	/**
	 * Verify the code entered by user
	 */
	async verifyCode(
		sessionId: string,
		code: string,
	): Promise<{ success: boolean; userId?: string; message?: string }> {
		const session = this.authSessions.get(sessionId);

		if (!session) {
			return { success: false, message: "Invalid or expired session" };
		}

		if (session.expiresAt < new Date()) {
			this.authSessions.delete(sessionId);
			return { success: false, message: "Verification code expired" };
		}

		if (session.verificationCode !== code) {
			return { success: false, message: "Invalid verification code" };
		}

		// Mark as verified
		session.verified = true;

		// Send success message
		await this.sendMessage(
			session.phoneNumber,
			"✅ *Login Successful!*\n\n" +
				"You have been successfully authenticated.\n" +
				"You can now access your FintekPro account.",
		);

		console.log(`✅ Code verified for session ${sessionId}`);

		return {
			success: true,
			userId: session.userId,
			message: "Verification successful",
		};
	}

	/**
	 * Send portfolio update via WhatsApp
	 */
	async sendPortfolioUpdate(
		phoneNumber: string,
		portfolioData: any,
	): Promise<boolean> {
		const message =
			`📊 *Portfolio Update*\n\n` +
			`💰 Total Value: ₹${portfolioData.totalValue?.toLocaleString() || "N/A"}\n` +
			`📈 Today's Change: ${portfolioData.change > 0 ? "+" : ""}₹${portfolioData.change?.toLocaleString() || "N/A"}\n` +
			`📊 Performance: ${portfolioData.performance > 0 ? "+" : ""}${portfolioData.performance?.toFixed(2) || "N/A"}%\n\n` +
			`Visit FintekPro for detailed analysis!`;

		return await this.sendMessage(phoneNumber, message);
	}

	/**
	 * Send market alert via WhatsApp
	 */
	async sendMarketAlert(phoneNumber: string, alertData: any): Promise<boolean> {
		const message =
			`🚨 *Market Alert*\n\n` +
			`📈 ${alertData.symbol}: ₹${alertData.price}\n` +
			`${alertData.change > 0 ? "📈" : "📉"} ${alertData.change > 0 ? "+" : ""}${alertData.change}%\n\n` +
			`${alertData.message || "Check FintekPro for more details!"}`;

		return await this.sendMessage(phoneNumber, message);
	}

	/**
	 * Get service status
	 */
	getStatus() {
		return {
			isReady: this.isConfigured,
			provider: "twilio-whatsapp",
			hasQrCode: false, // Twilio doesn't use QR codes
			message: this.isConfigured
				? "Twilio WhatsApp service is ready"
				: "Twilio credentials not configured",
		};
	}

	/**
	 * Check if client is ready
	 */
	isClientReady(): boolean {
		return this.isConfigured;
	}

	/**
	 * Get QR code (not applicable for Twilio)
	 */
	getQrCode(): string | null {
		return null; // Twilio doesn't use QR codes
	}

	/**
	 * Cleanup expired sessions
	 */
	cleanupExpiredSessions() {
		const now = new Date();
		for (const [sessionId, session] of Array.from(
			this.authSessions.entries(),
		)) {
			if (session.expiresAt < now) {
				this.authSessions.delete(sessionId);
			}
		}
	}
}

// Export singleton instance
export const twilioWhatsAppService = new TwilioWhatsAppService();

// Cleanup expired sessions every 5 minutes
setInterval(
	() => {
		twilioWhatsAppService.cleanupExpiredSessions();
	},
	5 * 60 * 1000,
);
