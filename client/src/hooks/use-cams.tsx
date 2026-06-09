import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// API request helper
async function apiRequest(url: string, data?: any): Promise<any> {
	const options: RequestInit = {
		method: data ? "POST" : "GET",
		headers: {
			"Content-Type": "application/json",
		},
	};

	if (data) {
		options.body = JSON.stringify(data);
	}

	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(
			`API request failed: ${response.status} ${response.statusText}`,
		);
	}
	const result = await response.json();
	return result.data || result;
}

export interface CamsInvestorPortfolio {
	folio: string;
	investorName: string;
	pan: string;
	folios: Array<{
		folioNumber: string;
		schemeCode: string;
		schemeName: string;
		currentUnits: number;
		currentValue: number;
		nav: number;
		navDate: string;
		amc: string;
		category: string;
	}>;
	totalPortfolioValue: number;
	totalGainLoss: number;
	totalGainLossPercentage: number;
}

export interface CamsTransaction {
	transactionId: string;
	folio: string;
	scheme: string;
	amount: number;
	units: number;
	nav: number;
	transactionType:
		| "PURCHASE"
		| "REDEMPTION"
		| "SWITCH_IN"
		| "SWITCH_OUT"
		| "STP"
		| "SWP";
	transactionDate: string;
	settlementDate: string;
	investorName: string;
	pan: string;
	status: "SUCCESS" | "PENDING" | "FAILED";
}

export interface CamsSipDetails {
	sipId: string;
	folio: string;
	schemeCode: string;
	schemeName: string;
	amount: number;
	frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
	startDate: string;
	endDate?: string;
	nextInstallmentDate: string;
	status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
	totalInstallments: number;
	executedInstallments: number;
}

export interface CamsScheme {
	schemeCode: string;
	schemeName: string;
	amc: string;
	category: string;
	nav: number;
	navDate: string;
	minimumInvestment: number;
	sipAvailable: boolean;
	riskLevel: string;
	expenseRatio: number;
}

// Hook to get CAMS investor portfolio
export function useCamsPortfolio(pan: string) {
	return useQuery<CamsInvestorPortfolio>({
		queryKey: ["/api/cams/portfolio", pan],
		queryFn: () => apiRequest(`/api/cams/portfolio/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Hook to get CAMS transaction history
export function useCamsTransactions(
	pan: string,
	fromDate?: string,
	toDate?: string,
) {
	const params = new URLSearchParams();
	if (fromDate) params.append("fromDate", fromDate);
	if (toDate) params.append("toDate", toDate);

	return useQuery<CamsTransaction[]>({
		queryKey: ["/api/cams/transactions", pan, fromDate, toDate],
		queryFn: () =>
			apiRequest(`/api/cams/transactions/${pan}?${params.toString()}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 2 * 60 * 1000, // 2 minutes
	});
}

// Hook to get CAMS SIP details
export function useCamsSips(pan: string) {
	return useQuery<CamsSipDetails[]>({
		queryKey: ["/api/cams/sip", pan],
		queryFn: () => apiRequest(`/api/cams/sip/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Hook to get CAMS schemes
export function useCamsSchemes(amc?: string, category?: string) {
	const params = new URLSearchParams();
	if (amc) params.append("amc", amc);
	if (category) params.append("category", category);

	return useQuery<CamsScheme[]>({
		queryKey: ["/api/cams/schemes", amc, category],
		queryFn: () => apiRequest(`/api/cams/schemes?${params.toString()}`),
		staleTime: 30 * 60 * 1000, // 30 minutes
	});
}

// Hook to get scheme NAV
export function useCamsSchemeNav(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/cams/nav", schemeCode],
		queryFn: () => apiRequest(`/api/cams/nav/${schemeCode}`),
		enabled: !!schemeCode,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Hook to validate investor
export function useCamsInvestorValidation(pan: string) {
	return useQuery({
		queryKey: ["/api/cams/investor/validate", pan],
		queryFn: () => apiRequest(`/api/cams/investor/validate/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 10 * 60 * 1000, // 10 minutes
	});
}

// Mutation hooks for transactions
export function useCamsPurchase() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			schemeCode: string;
			amount: number;
			folioNumber?: string;
			investorName: string;
			bankAccount: string;
			ifscCode: string;
		}) => {
			return apiRequest("/api/cams/transactions/purchase", data);
		},
		onSuccess: (data, variables) => {
			// Invalidate related queries
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/portfolio", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/transactions", variables.pan],
			});
		},
	});
}

export function useCamsRedemption() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			folio: string;
			schemeCode: string;
			units?: number;
			amount?: number;
			redemptionType: "FULL" | "PARTIAL";
			bankAccount: string;
			ifscCode: string;
		}) => {
			return apiRequest("/api/cams/transactions/redemption", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/portfolio", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/transactions", variables.pan],
			});
		},
	});
}

export function useCamsSipSetup() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			schemeCode: string;
			amount: number;
			frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
			startDate: string;
			endDate?: string;
			folioNumber?: string;
			investorName: string;
			bankAccount: string;
			ifscCode: string;
		}) => {
			return apiRequest("/api/cams/sip/setup", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/sip", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/portfolio", variables.pan],
			});
		},
	});
}

export function useCamsSipCancel() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			sipId: string;
			pan: string;
			reason?: string;
		}) => {
			return apiRequest("/api/cams/sip/cancel", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/cams/sip", variables.pan],
			});
		},
	});
}

export function useCamsStatementGeneration() {
	return useMutation({
		mutationFn: async (data: {
			pan: string;
			fromDate: string;
			toDate: string;
			format: "PDF" | "EXCEL";
			email?: string;
		}) => {
			return apiRequest("/api/cams/statement/generate", data);
		},
	});
}
