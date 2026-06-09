import {
	IBankingProvider,
	BankBalance,
	BankTransaction,
	TransferRequest,
	TransferResponse,
} from "./providers/banking-provider.interface";
import { CashfreeProvider } from "./providers/cashfree-provider";

export class BankingService {
	private readonly providers: Map<string, IBankingProvider> = new Map();

	constructor() {
		this.initializeProviders();
	}

	private initializeProviders() {
		const cfClientId =
			process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
		const cfClientSecret =
			process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;

		if (cfClientId && cfClientSecret) {
			this.providers.set(
				"cashfree",
				new CashfreeProvider(
					cfClientId,
					cfClientSecret,
					process.env.CASHFREE_ENVIRONMENT === "production",
				),
			);
		}
	}

	getProvider(providerId: string): IBankingProvider {
		const provider = this.providers.get(providerId);
		if (!provider) {
			throw new Error(`Provider ${providerId} not found`);
		}
		return provider;
	}

	async getAllBalances(
		accounts: { provider: string; accountId: string }[],
	): Promise<BankBalance[]> {
		const balancePromises = accounts.map((acc) => {
			const provider = this.getProvider(acc.provider);
			return provider.getBalances([acc.accountId]);
		});

		const results = await Promise.allSettled(balancePromises);
		const balances: BankBalance[] = [];

		results.forEach((result) => {
			if (result.status === "fulfilled") {
				balances.push(...result.value);
			} else {
				console.error(
					`[BankingService] Failed to fetch balances:`,
					result.reason,
				);
			}
		});

		return balances;
	}

	async syncTransactions(
		providerId: string,
		accountId: string,
		days: number = 30,
	): Promise<BankTransaction[]> {
		const provider = this.getProvider(providerId);
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(endDate.getDate() - days);

		return provider.getTransactions(accountId, startDate, endDate);
	}

	async executeTransfer(
		providerId: string,
		request: TransferRequest,
	): Promise<TransferResponse> {
		const provider = this.getProvider(providerId);
		console.log(
			`[BankingService] Executing transfer of ${request.amount} ${request.currency} via ${providerId}`,
		);
		return provider.initiateTransfer(request);
	}
}

export const bankingService = new BankingService();
