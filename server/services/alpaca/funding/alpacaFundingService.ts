import { logger } from "../../../logger";
import { db } from "../../../db";
import { users } from "../../../../shared/schema";
import { eq } from "drizzle-orm";
import { alpacaClient } from "../core/alpacaClient";

export class AlpacaFundingService {
	/**
	 * Links a bank account using a Plaid processor token
	 */
	async linkBankWithPlaid(
		userId: string,
		processorToken: string,
		bankName: string,
	) {
		logger.info(
			`[AlpacaFundingService] Linking bank for user ${userId} via Plaid token`,
		);

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user || !user.alpacaAccountId) {
			throw new Error("User does not have an active Alpaca account.");
		}

		const achData = {
			processor_token: processorToken,
			bank_account_type: "checking", // Default for Plaid integration
		};

		try {
			const relationship = await alpacaClient.createAchRelationship(
				user.alpacaAccountId,
				achData,
			);
			logger.info(
				`[AlpacaFundingService] ACH relationship created: ${relationship.id}`,
			);
			return relationship;
		} catch (error: any) {
			logger.error(
				`[AlpacaFundingService] Failed to link bank`,
				error.response?.data || error.message,
			);
			throw new Error(
				`Bank linking failed: ${error.response?.data?.message || error.message}`,
			);
		}
	}

	/**
	 * Initiates a deposit from linked bank account to Alpaca
	 */
	async depositFunds(userId: string, amount: number) {
		logger.info(
			`[AlpacaFundingService] User ${userId} initiating deposit: $${amount}`,
		);

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user || !user.alpacaAccountId) {
			throw new Error("User does not have an active Alpaca account.");
		}

		// Get active ACH relationship
		const relationships = await alpacaClient.getAchRelationships(
			user.alpacaAccountId,
		);
		const primaryRelationship = (relationships as any[]).find(
			(r) => r.status === "APPROVED",
		);

		if (!primaryRelationship) {
			throw new Error(
				"No approved ACH relationship found. Please link a bank account first.",
			);
		}

		const transferData = {
			relationship_id: primaryRelationship.id,
			amount: amount.toString(),
			direction: "INCOMING",
			timing: "immediate",
		};

		try {
			const transfer = await alpacaClient.initiateTransfer(
				user.alpacaAccountId,
				transferData,
			);
			logger.info(`[AlpacaFundingService] Transfer initiated: ${transfer.id}`);
			return transfer;
		} catch (error: any) {
			logger.error(
				`[AlpacaFundingService] Transfer failed`,
				error.response?.data || error.message,
			);
			throw new Error(
				`Transfer failed: ${error.response?.data?.message || error.message}`,
			);
		}
	}
}

export const alpacaFundingService = new AlpacaFundingService();
