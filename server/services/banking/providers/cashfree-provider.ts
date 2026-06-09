import axios from "axios";
import {
	IBankingProvider,
	BankBalance,
	BankTransaction,
	TransferRequest,
	TransferResponse,
} from "./banking-provider.interface";

export class CashfreeProvider implements IBankingProvider {
	private readonly baseUrl: string;
	private readonly clientId: string;
	private readonly clientSecret: string;

	constructor(
		clientId: string,
		clientSecret: string,
		isProduction: boolean = false,
	) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.baseUrl = isProduction
			? "https://payout-api.cashfree.com/payout/v1.2"
			: "https://payout-gamma.cashfree.com/payout/v1.2";
	}

	getProviderName(): string {
		return "Cashfree";
	}

	private async getAuthToken(): Promise<string> {
		const response = await axios.post(
			`${this.baseUrl}/authorize`,
			{},
			{
				headers: {
					"X-Client-Id": this.clientId,
					"X-Client-Secret": this.clientSecret,
				},
			},
		);
		return response.data.data.token;
	}

	async getBalances(accountIds: string[]): Promise<BankBalance[]> {
		const token = await this.getAuthToken();
		const response = await axios.get(`${this.baseUrl}/getBalance`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		const data = response.data.data;
		return [
			{
				accountId: "primary",
				accountNumber: "N/A", // Cashfree balance is virtual
				currency: "INR",
				ledgerBalance: data.balance.toString(),
				availableBalance: data.availableBalance.toString(),
				lastSyncedAt: new Date(),
			},
		];
	}

	async getTransactions(
		accountId: string,
		startDate: Date,
		endDate: Date,
	): Promise<BankTransaction[]> {
		const token = await this.getAuthToken();
		const response = await axios.get(`${this.baseUrl}/getTransactions`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		return response.data.data.transactions.map((item: any) => ({
			id: item.utr || item.referenceId,
			accountId: accountId,
			amount: item.amount.toString(),
			currency: "INR",
			type: item.type.toLowerCase() === "credit" ? "credit" : "debit",
			status: this.mapStatus(item.status),
			description: item.remarks || "Cashfree Payout",
			transactionDate: new Date(item.addedOn),
			referenceNumber: item.utr,
		}));
	}

	async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
		const token = await this.getAuthToken();
		const payload = {
			beneId: `BENE_${Date.now()}`,
			amount: request.amount,
			transferId: `TRF_${Date.now()}`,
			transferMode: request.paymentRail.toLowerCase(),
			remarks: request.remarks,
		};

		const response = await axios.post(
			`${this.baseUrl}/requestTransfer`,
			payload,
			{
				headers: { Authorization: `Bearer ${token}` },
			},
		);

		return {
			transferId: response.data.data.referenceId,
			status: this.mapTransferStatus(response.data.status),
			referenceNumber: response.data.data.utr,
		};
	}

	async verifyBeneficiary(
		accountNumber: string,
		ifscCode: string,
	): Promise<boolean> {
		const token = await this.getAuthToken();
		const payload = {
			bankAccount: accountNumber,
			ifsc: ifscCode,
		};

		try {
			const response = await axios.post(
				`${this.baseUrl}/validation/bankDetails`,
				payload,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			return (
				response.data.status === "SUCCESS" &&
				response.data.data.accountStatus === "VALID"
			);
		} catch (e) {
			return false;
		}
	}

	private mapStatus(
		status: string,
	): "pending" | "success" | "failed" | "reversed" {
		switch (status.toUpperCase()) {
			case "SUCCESS":
				return "success";
			case "PENDING":
				return "pending";
			case "FAILED":
				return "failed";
			case "REVERSED":
				return "reversed";
			default:
				return "pending";
		}
	}

	private mapTransferStatus(status: string): "pending" | "success" | "failed" {
		switch (status.toUpperCase()) {
			case "SUCCESS":
				return "success";
			case "PENDING":
				return "pending";
			case "FAILED":
				return "failed";
			default:
				return "pending";
		}
	}
}
