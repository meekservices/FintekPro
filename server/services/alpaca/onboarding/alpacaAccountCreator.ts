import { logger } from "../../../logger";
import { db } from "../../../db";
import { users } from "../../../../shared/schema";
import { eq } from "drizzle-orm";
import { alpacaClient } from "../core/alpacaClient";
import { alpacaKycMapper } from "./alpacaKycMapper";
import { referralService } from "../../social/referralService";

export class AlpacaAccountCreator {
	/**
	 * Orchestrates the creation of an Alpaca account from a local FintekPro user.
	 *
	 * Purpose  : Provision a Broker API account and optionally record referral attribution.
	 * Inputs   : userId (FintekPro), ipAddress, referredByCode (optional referral code of referrer)
	 * Outputs  : Alpaca account ID (string)
	 * Edge cases: Already has account → returns existing ID; omnibus → links platform account
	 */
	async createAccountForUser(
		userId: string,
		ipAddress: string = "127.0.0.1",
		referredByCode?: string,
	) {
		logger.info(
			`[AlpacaAccountCreator] Initiating Alpaca onboarding for user: ${userId} from IP: ${ipAddress}`,
		);

		// Fetch user and profile from DB
		const userRecord = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		const profileRecord = await db.query.userProfiles.findFirst({
			where: eq(users.userId, userId),
		});

		if (!userRecord || !profileRecord) {
			throw new Error(`User or Profile not found for ID: ${userId}`);
		}

		if (userRecord.alpacaAccountId) {
			logger.info(
				`[AlpacaAccountCreator] User ${userId} already has an Alpaca Account: ${userRecord.alpacaAccountId}`,
			);
			return userRecord.alpacaAccountId;
		}

		// Handle Omnibus account type
		if (userRecord.alpacaAccountType === "omnibus") {
			logger.info(
				`[AlpacaAccountCreator] User ${userId} flagged for OMNIBUS. Linking to platform account.`,
			);

			// Fetch platform omnibus account ID from settings or env
			const omnibusId = process.env.ALPACA_OMNIBUS_ACCOUNT_ID;
			if (!omnibusId) {
				throw new Error(
					"ALPACA_OMNIBUS_ACCOUNT_ID is not configured for omnibus onboarding.",
				);
			}

			await db
				.update(users)
				.set({ alpacaAccountId: omnibusId })
				.where(eq(users.id, userId));

			return omnibusId;
		}

		// Map KYC with real IP
		const payload = alpacaKycMapper.mapToAlpacaSchema(
			userRecord as any,
			profileRecord as any,
			ipAddress,
		);

		try {
			// Call Alpaca API
			const alpacaAccount = await alpacaClient.createAccount(payload);

			logger.info(
				`[AlpacaAccountCreator] Successfully created Alpaca Account ${alpacaAccount.id} for user ${userId}`,
			);

			// Link in DB
			await db
				.update(users)
				.set({ alpacaAccountId: alpacaAccount.id })
				.where(eq(users.id, userId));

			// ── HOOK 3: Referral Attribution ──────────────────────────────────────
			// If this user was referred, record their attribution by generating their
			// own referral code and noting the referrer in logs (extend schema to store
			// referredByUserId if needed in future DB migration).
			if (referredByCode) {
				try {
					const referrer = await db.query.users.findFirst({
						where: eq(users.referralCode, referredByCode),
					});
					if (referrer) {
						// Generate new user's own code immediately so they can refer others
						await referralService.generateReferralCode(userId);
						logger.info(
							"[AlpacaAccountCreator] Referral attribution recorded",
							{
								event: "ALPACA_REFERRAL_ATTRIBUTION",
								new_user_id: userId,
								referred_by_user_id: referrer.id,
								referral_code: referredByCode,
								alpaca_account_id: alpacaAccount.id,
								status: "success",
								latency_ms: 0,
							},
						);
					} else {
						logger.warn(
							"[AlpacaAccountCreator] Referral code not found — attribution skipped",
							{
								event: "ALPACA_REFERRAL_CODE_NOT_FOUND",
								referral_code: referredByCode,
								new_user_id: userId,
								status: "warning",
							},
						);
					}
				} catch (refErr: any) {
					// Non-fatal — account creation already succeeded
					logger.error(
						"[AlpacaAccountCreator] Referral attribution failed (non-fatal)",
						{
							event: "ALPACA_REFERRAL_ATTRIBUTION_ERROR",
							error: refErr.message,
							new_user_id: userId,
							referral_code: referredByCode,
							retryable: false,
							status: "error",
						},
					);
				}
			}

			return alpacaAccount.id;
		} catch (error: any) {
			logger.error(
				`[AlpacaAccountCreator] Alpaca onboarding failed for user ${userId}`,
				error.response?.data || error.message,
			);
			// Fallback: If creation fails due to strict rules, flag for manual review
			// In a real system, you might trigger an admin alert here
			throw new Error(
				`Alpaca Onboarding Failed: ${error.response?.data?.message || error.message}`,
			);
		}
	}
}

export const alpacaAccountCreator = new AlpacaAccountCreator();
