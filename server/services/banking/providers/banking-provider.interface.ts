export interface BankBalance {
	accountId: string;
	accountNumber: string;
	currency: string;
	ledgerBalance: string;
	availableBalance: string;
	lastSyncedAt: Date;
}

export interface BankTransaction {
	id: string;
	accountId: string;
	amount: string;
	currency: string;
	type: "credit" | "debit";
	status: "pending" | "success" | "failed" | "reversed";
	description: string;
	transactionDate: Date;
	referenceNumber: string;
	metadata?: Record<string, any>;
}

export interface TransferRequest {
	fromAccountId: string;
	toAccountDetails: {
		accountNumber: string;
		ifscCode: string;
		beneficiaryName: string;
	};
	amount: string;
	currency: string;
	remarks?: string;
	paymentRail: "NEFT" | "RTGS" | "IMPS" | "UPI";
}

export interface TransferResponse {
	transferId: string;
	status: "pending" | "success" | "failed";
	referenceNumber?: string;
	error?: string;
}

export interface IBankingProvider {
	getProviderName(): string;
	getBalances(accountIds: string[]): Promise<BankBalance[]>;
	getTransactions(
		accountId: string,
		startDate: Date,
		endDate: Date,
	): Promise<BankTransaction[]>;
	initiateTransfer(request: TransferRequest): Promise<TransferResponse>;
	verifyBeneficiary(accountNumber: string, ifscCode: string): Promise<boolean>;
}
