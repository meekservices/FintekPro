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
		_bankName: string,
	) {
		logger.info(
			`[AlpacaFundingService] Linking bank for user ${userId} via Plaid token`,
		);

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user?.alpacaAccountId) {
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

		if (!user?.alpacaAccountId) {
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

	/**
	 * Generates institutional RBI LRS wire transfer instructions for an Indian resident
	 * remitting funds to their individual Alpaca US brokerage account.
	 * Complies with RBI FEMA Master Directions (LRS) & Form A2.
	 */
	async getLrsWireInstructions(userId: string) {
		logger.info(
			`[AlpacaFundingService] Generating LRS wire instructions for user ${userId}`,
		);

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user) {
			throw new Error("User not found.");
		}

		// Check us_broker_accounts for canonical Alpaca account number
		const { usBrokerAccounts } = await import("@shared/schema");
		const [usAccount] = await db
			.select()
			.from(usBrokerAccounts)
			.where(eq(usBrokerAccounts.clientId, userId))
			.limit(1);

		const alpacaAccountId = user.alpacaAccountId || usAccount?.alpacaAccountId;
		const alpacaAccountNumber =
			usAccount?.alpacaAccountNumber || user.alpacaAccountId || "PENDING";
		const fullName =
			`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
			user.email?.split("@")[0] ||
			"Investor";

		const wireRef = `${alpacaAccountNumber} / ${fullName}`;

		return {
			beneficiaryBank: {
				bankName: "BMO Harris Bank N.A.",
				swiftBic: "HATRUS44",
				abaRoutingNumber: "071000288",
				bankAddress: "111 W Monroe St, Chicago, IL 60603, USA",
			},
			beneficiaryAccount: {
				accountName: "Alpaca Securities LLC",
				accountNumber: "383-492-1",
				address: "3200 Ash St, Palo Alto, CA 94306, USA",
			},
			remittanceDetails: {
				alpacaAccountId: alpacaAccountId || null,
				alpacaAccountNumber,
				investorName: fullName,
				remittanceReference: wireRef,
				remittanceMemoInstructions:
					"MANDATORY: You MUST include this exact reference in Field 70 (Remittance Information / Beneficiary Reference) of your outward SWIFT wire so Alpaca automatically credits your sub-account within 24-48 hours.",
			},
			femaCompliance: {
				regulatoryScheme: "RBI Liberalised Remittance Scheme (LRS)",
				purposeCode: "S0001",
				purposeDescription:
					"Indian portfolio investment abroad in equity shares",
				annualLrsLimitUsd: 250000,
				lrsUsedUsd: Number(usAccount?.lrsUsedUsd || 0),
				lrsRemainingUsd: Math.max(
					0,
					250000 - Number(usAccount?.lrsUsedUsd || 0),
				),
				currentFinancialYear: usAccount?.lrsFinancialYear || "2024-25",
				tcsDisclosure:
					"As per Section 206C(1G) of the Income Tax Act, TCS @ 20% applies on outward remittances exceeding INR 7,00,000 per financial year for investment purposes.",
				eligibleBanks: [
					"HDFC Bank (RemitNow)",
					"ICICI Bank (Money2World)",
					"State Bank of India (SBI LRS NetBanking)",
					"Axis Bank (Outward Remittance)",
					"Kotak Mahindra Bank",
				],
			},
			formA2Guide: {
				field32A_currency: "USD",
				field50_orderingCustomer: `${fullName} (PAN: ${user.panNumber || "ON_FILE"})`,
				field57_beneficiaryBank: "BMO Harris Bank N.A. (SWIFT: HATRUS44)",
				field59_beneficiary: "Alpaca Securities LLC (A/C: 383-492-1)",
				field70_remittanceInfo: wireRef,
			},
		};
	}
}

export const alpacaFundingService = new AlpacaFundingService();
