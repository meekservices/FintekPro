import twilio from "twilio";

type VerifyChannel = "sms" | "call" | "email" | "whatsapp";

interface VerificationResult {
	success: boolean;
	status?: string;
	sid?: string;
	error?: string;
	channel?: string;
}

interface VerificationCheckResult {
	success: boolean;
	status?: string;
	valid?: boolean;
	error?: string;
}

class TwilioVerifyService {
	private client: any;
	private serviceSid: string = "";
	private isConfigured: boolean;

	constructor() {
		const accountSid = process.env.TWILIO_ACCOUNT_SID;
		const authToken = process.env.TWILIO_AUTH_TOKEN;
		const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

		if (accountSid && authToken && verifySid) {
			this.client = twilio(accountSid, authToken);
			this.serviceSid = verifySid;
			this.isConfigured = true;
			console.log("✅ Twilio Verify service initialized");
		} else if (accountSid && authToken) {
			this.client = twilio(accountSid, authToken);
			this.isConfigured = false;
			console.log(
				"⚠️ Twilio Verify service partially configured - missing TWILIO_VERIFY_SERVICE_SID",
			);
			console.log(
				"   Create a Verify Service in Twilio Console and set TWILIO_VERIFY_SERVICE_SID",
			);
		} else {
			this.isConfigured = false;
			console.log(
				"⚠️ Twilio Verify service not configured - missing credentials",
			);
		}
	}

	isAvailable(): boolean {
		return this.isConfigured;
	}

	private formatPhoneNumber(mobile: string): string {
		const cleaned = mobile.replace(/\D/g, "");
		if (cleaned.startsWith("91") && cleaned.length === 12) {
			return `+${cleaned}`;
		}
		if (cleaned.length === 10) {
			return `+91${cleaned}`;
		}
		return `+${cleaned}`;
	}

	async sendVerification(
		to: string,
		channel: VerifyChannel = "sms",
		locale: string = "en",
	): Promise<VerificationResult> {
		if (!this.isConfigured) {
			console.log(
				`📱 Verify OTP to ${to.substring(0, 6)}**** via ${channel} (not configured)`,
			);
			return {
				success: false,
				error:
					"Verify service not configured - missing TWILIO_VERIFY_SERVICE_SID",
			};
		}

		try {
			const formattedTo = channel === "email" ? to : this.formatPhoneNumber(to);

			const verification = await this.client.verify.v2
				.services(this.serviceSid)
				.verifications.create({
					to: formattedTo,
					channel,
					locale,
				});

			console.log(
				`✅ Verification sent to ${formattedTo.substring(0, 8)}*** via ${channel} - SID: ${verification.sid}`,
			);

			return {
				success: true,
				status: verification.status,
				sid: verification.sid,
				channel: verification.channel,
			};
		} catch (error: any) {
			console.error(
				`❌ Failed to send verification via ${channel}:`,
				error.message,
			);
			return { success: false, error: error.message };
		}
	}

	async checkVerification(
		to: string,
		code: string,
	): Promise<VerificationCheckResult> {
		if (!this.isConfigured) {
			console.log(
				`🔍 Verify check for ${to.substring(0, 6)}**** with code ${code} (not configured)`,
			);
			return { success: false, error: "Verify service not configured" };
		}

		try {
			const formattedTo = to.includes("@") ? to : this.formatPhoneNumber(to);

			const verificationCheck = await this.client.verify.v2
				.services(this.serviceSid)
				.verificationChecks.create({
					to: formattedTo,
					code,
				});

			const isValid = verificationCheck.status === "approved";
			console.log(
				`🔍 Verification check for ${formattedTo.substring(0, 8)}***: ${verificationCheck.status}`,
			);

			return {
				success: true,
				status: verificationCheck.status,
				valid: isValid,
			};
		} catch (error: any) {
			console.error("❌ Failed to check verification:", error.message);
			return { success: false, error: error.message, valid: false };
		}
	}

	async sendSmsOTP(to: string): Promise<VerificationResult> {
		return this.sendVerification(to, "sms");
	}

	async sendVoiceOTP(to: string): Promise<VerificationResult> {
		return this.sendVerification(to, "call");
	}

	async sendWhatsAppOTP(to: string): Promise<VerificationResult> {
		return this.sendVerification(to, "whatsapp");
	}

	async sendEmailOTP(email: string): Promise<VerificationResult> {
		return this.sendVerification(email, "email");
	}

	async sendOTPWithFallback(
		to: string,
		preferredChannel: VerifyChannel = "sms",
	): Promise<VerificationResult> {
		const channels: VerifyChannel[] = ["sms", "whatsapp", "call"];
		const orderedChannels = [
			preferredChannel,
			...channels.filter((c) => c !== preferredChannel),
		];

		for (const channel of orderedChannels) {
			const result = await this.sendVerification(to, channel);
			if (result.success) {
				return result;
			}
			console.log(`⚠️ ${channel} failed, trying next channel...`);
		}

		return { success: false, error: "All verification channels failed" };
	}
}

export const twilioVerifyService = new TwilioVerifyService();
