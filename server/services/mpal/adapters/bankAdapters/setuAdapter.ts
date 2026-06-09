import {
	ICreditProvider,
	CreditProduct,
	CreditApplication,
} from "../../interfaces/ICreditProvider";
import { logger } from "../../../../logger";

export class SetuAdapter implements ICreditProvider {
	public readonly providerId = "SETU_AGGREGATOR";

	async fetchProducts(): Promise<CreditProduct[]> {
		logger.info(`[SetuAdapter] Fetching credit products`);
		return [];
	}

	async checkEligibility(user: any): Promise<any> {
		logger.info(`[SetuAdapter] Checking eligibility for user ${user.id}`);
		return { isEligible: true, maxAmount: 80000 };
	}

	async createApplication(app: CreditApplication): Promise<any> {
		logger.info(`[SetuAdapter] Submitting credit application to Setu`, app);
		return { ...app, status: "SUBMITTED", providerRef: "SETU_APP_456" };
	}

	async getApplicationStatus(appId: string): Promise<any> {
		logger.info(`[SetuAdapter] Fetching status for application ${appId}`);
		return { status: "PENDING" };
	}
}

export const setuAdapter = new SetuAdapter();
