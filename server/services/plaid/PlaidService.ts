import {
	Configuration,
	PlaidApi,
	PlaidEnvironments,
	LinkTokenCreateRequest,
	ProcessorTokenCreateRequest,
} from "plaid";
import { logger } from "../../logger";

const configuration = new Configuration({
	basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
	baseOptions: {
		headers: {
			"PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
			"PLAID-SECRET": process.env.PLAID_SECRET,
		},
	},
});

const plaidClient = new PlaidApi(configuration);

export class PlaidService {
	/**
	 * Creates a Link token for the Plaid Link flow
	 */
	async createLinkToken(userId: string) {
		logger.info(`[PlaidService] Creating link token for user ${userId}`);

		const request: LinkTokenCreateRequest = {
			user: { client_user_id: userId },
			client_name: "FintekPro",
			products: ["auth"] as any, // 'auth' is required for ACH transfers
			country_codes: ["US"] as any,
			language: "en",
		};

		try {
			const response = await plaidClient.linkTokenCreate(request);
			return response.data.link_token;
		} catch (error: any) {
			logger.error(
				"[PlaidService] Error creating link token",
				error.response?.data || error.message,
			);
			throw new Error("Failed to create Plaid link token");
		}
	}

	/**
	 * Exchanges a public token for an access token and then creates an Alpaca processor token
	 */
	async createProcessorToken(publicToken: string, accountId: string) {
		logger.info(
			`[PlaidService] Exchanging public token for processor token (Account: ${accountId})`,
		);

		try {
			// 1. Exchange public token for access token
			const tokenResponse = await plaidClient.itemPublicTokenExchange({
				public_token: publicToken,
			});
			const accessToken = tokenResponse.data.access_token;

			// 2. Create processor token for Alpaca
			const processorRequest: ProcessorTokenCreateRequest = {
				access_token: accessToken,
				account_id: accountId,
				processor: "alpaca" as any,
			};

			const processorResponse =
				await plaidClient.processorTokenCreate(processorRequest);
			return processorResponse.data.processor_token;
		} catch (error: any) {
			logger.error(
				"[PlaidService] Error creating processor token",
				error.response?.data || error.message,
			);
			throw new Error("Failed to exchange Plaid token for processor token");
		}
	}
}

export const plaidService = new PlaidService();
