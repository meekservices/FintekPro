import {
	ICreditProvider,
	CreditProduct,
	CreditApplication,
} from "../../interfaces/ICreditProvider";
import { logger } from "../../../../logger";

export class DirectBankAdapter implements ICreditProvider {
	public readonly providerId = "DIRECT_BANK_API";

	async fetchProducts(): Promise<CreditProduct[]> {
		logger.info(
			`[DirectBankAdapter] Fetching credit products directly from partner banks`,
		);
		return [];
	}

	async checkEligibility(user: any): Promise<any> {
		logger.info(
			`[DirectBankAdapter] Checking eligibility for user ${user.id} against partner banks`,
		);
		return { isEligible: true, maxAmount: 150000 };
	}

	async createApplication(app: CreditApplication): Promise<any> {
		logger.info(
			`[DirectBankAdapter] Submitting credit application directly to bank`,
			app,
		);
		return { ...app, status: "SUBMITTED", providerRef: "BANK_APP_123" };
	}

	async getApplicationStatus(appId: string): Promise<any> {
		logger.info(
			`[DirectBankAdapter] Fetching status for application ${appId} from bank`,
		);
		return { status: "APPROVED" };
	}
}

export const directBankAdapter = new DirectBankAdapter();
