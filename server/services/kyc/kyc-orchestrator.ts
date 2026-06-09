import { db } from "../../db";
import { users, userProfiles } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { alpacaKycMapper } from "../alpaca/onboarding/alpacaKycMapper";
import { logger } from "../../logger";

export class KycOrchestrator {
	/**
	 * Generates a pre-filled KYC object for a specific broker.
	 * This allows FintekPro to act as the primary identity hub.
	 */
	async getPrefillData(userId: string, brokerId: "ALPACA" | "IIFL" | "ICICI") {
		logger.info(
			`[KycOrchestrator] Generating prefill data for user ${userId} -> Broker: ${brokerId}`,
		);

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});
		const profile = await db.query.userProfiles.findFirst({
			where: eq(userProfiles.userId, userId),
		});

		if (!user || !profile) {
			throw new Error("User profile not found for prefill.");
		}

		switch (brokerId) {
			case "ALPACA":
				return alpacaKycMapper.mapToAlpacaSchema(user as any, profile as any);

			case "IIFL":
				return this.mapToIiflSchema(user, profile);

			case "ICICI":
				return this.mapToIciciSchema(user, profile);

			default:
				throw new Error(`Unsupported broker: ${brokerId}`);
		}
	}

	private mapToIiflSchema(user: any, profile: any) {
		// Skeleton mapping for IIFL (Indian Market)
		return {
			client_name: `${profile.firstName} ${profile.lastName}`,
			pan_number: profile.panNumber,
			aadhaar_number: profile.aadhaarNumber, // FintekPro internal field
			resident_status: "RESIDENT_INDIAN",
			segment_activation: ["EQUITY", "DERIVATIVES", "CURRENCY"],
		};
	}

	private mapToIciciSchema(user: any, profile: any) {
		// Skeleton mapping for ICICI Direct
		return {
			name: profile.firstName,
			middle_name: profile.middleName || "",
			last_name: profile.lastName,
			dob: profile.dateOfBirth,
			pan: profile.panNumber,
			email: user.email,
		};
	}
}

export const kycOrchestrator = new KycOrchestrator();
