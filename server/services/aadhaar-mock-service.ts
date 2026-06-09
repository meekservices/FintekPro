/**
 * Aadhaar OTP Mock Service
 *
 * Mock implementation of Aadhaar OTP verification for demo purposes.
 * In production, this should be replaced with actual UIDAI API integration.
 *
 * Features:
 * - Send OTP to masked Aadhaar number
 * - Verify OTP
 * - Return mock user data after verification
 */

export interface AadhaarOTPResponse {
	success: boolean;
	message: string;
	transactionId: string;
	maskedAadhaar: string;
}

export interface AadhaarVerificationResponse {
	success: boolean;
	message: string;
	verified: boolean;
	data?: {
		name: string;
		dob: string;
		gender: string;
		address: {
			house: string;
			street: string;
			landmark: string;
			locality: string;
			city: string;
			state: string;
			pincode: string;
			country: string;
		};
		photoUrl?: string;
	};
}

export class AadhaarMockService {
	private static otpStore = new Map<
		string,
		{ otp: string; aadhaarNumber: string; expiresAt: number }
	>();

	/**
	 * Send OTP to Aadhaar number (Mock)
	 */
	static async sendOTP(aadhaarNumber: string): Promise<AadhaarOTPResponse> {
		// Validate Aadhaar number format (12 digits)
		if (!/^\d{12}$/.test(aadhaarNumber)) {
			return {
				success: false,
				message: "Invalid Aadhaar number format. Must be 12 digits.",
				transactionId: "",
				maskedAadhaar: "",
			};
		}

		// Generate random OTP
		const otp = Math.floor(100000 + Math.random() * 900000).toString();

		// Generate transaction ID
		const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

		// Store OTP for verification (expires in 10 minutes)
		AadhaarMockService.otpStore.set(transactionId, {
			otp,
			aadhaarNumber,
			expiresAt: Date.now() + 10 * 60 * 1000,
		});

		// Mask Aadhaar number (show only last 4 digits)
		const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

		// In production, send actual OTP via SMS/Email
		console.log(`[AADHAAR MOCK] OTP for ${maskedAadhaar}: ${otp}`);

		return {
			success: true,
			message: `OTP sent successfully to registered mobile number ending with ${aadhaarNumber.slice(-4)}`,
			transactionId,
			maskedAadhaar,
		};
	}

	/**
	 * Verify OTP (Mock)
	 */
	static async verifyOTP(
		transactionId: string,
		otp: string,
	): Promise<AadhaarVerificationResponse> {
		const otpData = AadhaarMockService.otpStore.get(transactionId);

		if (!otpData) {
			return {
				success: false,
				message: "Invalid or expired transaction ID",
				verified: false,
			};
		}

		// Check if OTP expired
		if (Date.now() > otpData.expiresAt) {
			AadhaarMockService.otpStore.delete(transactionId);
			return {
				success: false,
				message: "OTP has expired. Please request a new OTP.",
				verified: false,
			};
		}

		// Verify OTP
		if (otpData.otp !== otp) {
			return {
				success: false,
				message: "Invalid OTP. Please try again.",
				verified: false,
			};
		}

		// OTP verified successfully - cleanup and return mock data
		AadhaarMockService.otpStore.delete(transactionId);

		throw new Error(
			"Aadhaar verification service not configured. UIDAI API integration required for Aadhaar data.",
		);
	}

	/**
	 * Cleanup expired OTPs (call periodically)
	 */
	static cleanupExpiredOTPs() {
		const now = Date.now();
		for (const [txnId, data] of AadhaarMockService.otpStore.entries()) {
			if (now > data.expiresAt) {
				AadhaarMockService.otpStore.delete(txnId);
			}
		}
	}
}

// Cleanup expired OTPs every 5 minutes
setInterval(
	() => {
		AadhaarMockService.cleanupExpiredOTPs();
	},
	5 * 60 * 1000,
);
