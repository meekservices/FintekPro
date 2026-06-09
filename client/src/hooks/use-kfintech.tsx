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

export interface KfintechInvestorPortfolio {
	investorId: string;
	investorName: string;
	pan: string;
	folios: Array<{
		folioNumber: string;
		schemeCode: string;
		schemeName: string;
		units: number;
		nav: number;
		currentValue: number;
		investmentValue: number;
		gainLoss: number;
		gainLossPercentage: number;
		amc: string;
		category: string;
	}>;
	totalPortfolioValue: number;
	totalInvestmentValue: number;
	totalGainLoss: number;
	totalGainLossPercentage: number;
}

export interface KfintechTransaction {
	transactionId: string;
	folioNumber: string;
	schemeCode: string;
	schemeName: string;
	transactionType:
		| "PURCHASE"
		| "REDEMPTION"
		| "SWITCH_IN"
		| "SWITCH_OUT"
		| "STP"
		| "SWP";
	amount: number;
	units: number;
	nav: number;
	transactionDate: string;
	settlementDate: string;
	status: "SUCCESS" | "PENDING" | "FAILED";
}

export interface KfintechSipDetails {
	sipId: string;
	folioNumber: string;
	schemeCode: string;
	schemeName: string;
	amount: number;
	frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
	startDate: string;
	endDate?: string;
	nextInstallmentDate: string;
	status: "ACTIVE" | "PAUSED" | "STOPPED";
	totalInstallments: number;
	executedInstallments: number;
}

export interface KfintechScheme {
	schemeCode: string;
	schemeName: string;
	amc: string;
	category: string;
	nav: number;
	navDate: string;
	minimumInvestment: number;
	sipMinimum: number;
	sipAvailable: boolean;
	riskLevel: string;
	expenseRatio: number;
	exitLoad: string;
}

// Hook to validate Kfintech investor
export function useKfintechInvestorValidation(pan: string) {
	return useQuery({
		queryKey: ["/api/kfintech/investor/validate", pan],
		queryFn: () => apiRequest(`/api/kfintech/investor/validate/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 10 * 60 * 1000, // 10 minutes
	});
}

// Hook to get Kfintech investor portfolio
export function useKfintechPortfolio(pan: string) {
	return useQuery<KfintechInvestorPortfolio>({
		queryKey: ["/api/kfintech/portfolio", pan],
		queryFn: () => apiRequest(`/api/kfintech/portfolio/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Hook to get Kfintech transaction history
export function useKfintechTransactions(
	pan: string,
	fromDate?: string,
	toDate?: string,
) {
	const params = new URLSearchParams();
	if (fromDate) params.append("fromDate", fromDate);
	if (toDate) params.append("toDate", toDate);

	return useQuery<KfintechTransaction[]>({
		queryKey: ["/api/kfintech/transactions", pan, fromDate, toDate],
		queryFn: () =>
			apiRequest(`/api/kfintech/transactions/${pan}?${params.toString()}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 2 * 60 * 1000, // 2 minutes
	});
}

// Hook to get Kfintech SIP details
export function useKfintechSips(pan: string) {
	return useQuery<KfintechSipDetails[]>({
		queryKey: ["/api/kfintech/sip", pan],
		queryFn: () => apiRequest(`/api/kfintech/sip/${pan}`),
		enabled: !!pan && pan.length === 10,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Hook to get Kfintech schemes
export function useKfintechSchemes(amc?: string, category?: string) {
	const params = new URLSearchParams();
	if (amc) params.append("amc", amc);
	if (category) params.append("category", category);

	return useQuery<KfintechScheme[]>({
		queryKey: ["/api/kfintech/schemes", amc, category],
		queryFn: () => apiRequest(`/api/kfintech/schemes?${params.toString()}`),
		staleTime: 30 * 60 * 1000, // 30 minutes
	});
}

// Hook to get scheme NAV
export function useKfintechSchemeNav(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/kfintech/nav", schemeCode],
		queryFn: () => apiRequest(`/api/kfintech/nav/${schemeCode}`),
		enabled: !!schemeCode,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
}

// Mutation hooks for transactions
export function useKfintechPurchase() {
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
			nomineeDetails?: {
				name: string;
				relationship: string;
				dateOfBirth?: string;
			};
		}) => {
			return apiRequest("/api/kfintech/transactions/purchase", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/portfolio", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/transactions", variables.pan],
			});
		},
	});
}

export function useKfintechRedemption() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			folioNumber: string;
			schemeCode: string;
			units?: number;
			amount?: number;
			redemptionType: "FULL" | "PARTIAL";
			bankAccount: string;
			ifscCode: string;
		}) => {
			return apiRequest("/api/kfintech/transactions/redemption", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/portfolio", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/transactions", variables.pan],
			});
		},
	});
}

export function useKfintechSipSetup() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			schemeCode: string;
			amount: number;
			frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
			startDate: string;
			endDate?: string;
			folioNumber?: string;
			investorName: string;
			bankAccount: string;
			ifscCode: string;
			nomineeDetails?: {
				name: string;
				relationship: string;
			};
		}) => {
			return apiRequest("/api/kfintech/sip/setup", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/sip", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/portfolio", variables.pan],
			});
		},
	});
}

export function useKfintechSipCancel() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			sipId: string;
			pan: string;
			reason?: string;
		}) => {
			return apiRequest("/api/kfintech/sip/cancel", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/sip", variables.pan],
			});
		},
	});
}

export function useKfintechStatementGeneration() {
	return useMutation({
		mutationFn: async (data: {
			pan: string;
			fromDate: string;
			toDate: string;
			format: "PDF" | "EXCEL";
			email?: string;
		}) => {
			return apiRequest("/api/kfintech/statement/generate", data);
		},
	});
}

export function useKfintechSwitchTransaction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: {
			pan: string;
			fromSchemeCode: string;
			toSchemeCode: string;
			fromFolioNumber: string;
			toFolioNumber?: string;
			units?: number;
			amount?: number;
			switchType: "FULL" | "PARTIAL";
		}) => {
			return apiRequest("/api/kfintech/transactions/switch", data);
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/portfolio", variables.pan],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/kfintech/transactions", variables.pan],
			});
		},
	});
}
// ─── IRIS API hooks ────────────────────────────────────────────────────────

async function irisRequest(
	url: string,
	data?: any,
	method = data ? "POST" : "GET",
): Promise<any> {
	const options: RequestInit = {
		method,
		headers: { "Content-Type": "application/json" },
	};
	if (data) options.body = JSON.stringify(data);
	const response = await fetch(url, options);
	const result = await response.json();
	if (!response.ok)
		throw new Error(result.message || `Request failed: ${response.status}`);
	return result.data ?? result;
}

// STP hooks
export function useIrisStp() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/stp/register", data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/iris"] });
		},
	});
}
export function useIrisStpCancel() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/stp/cancel", data),
	});
}
export function useIrisStpPause() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/stp/pause", data),
	});
}

// SWP hooks
export function useIrisSwp() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/swp/register", data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/iris"] });
		},
	});
}
export function useIrisSwpCancel() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/swp/cancel", data),
	});
}
export function useIrisSwpPause() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/swp/pause", data),
	});
}

// Additional Purchase
export function useIrisAdditionalPurchase() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/additional-purchase", data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/iris"] });
		},
	});
}

// eNACH Mandate
export function useIrisCreateMandate() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/mandates", data),
	});
}
export function useIrisMandateStatus(mandateId: string) {
	return useQuery({
		queryKey: ["/api/iris/transactions/mandates", mandateId],
		queryFn: () => irisRequest(`/api/iris/transactions/mandates/${mandateId}`),
		enabled: !!mandateId,
	});
}

// FD Orders
export function useIrisFdOrder() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/products/fixed-deposits/order", data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/iris/products/fixed-deposits/orders"],
			});
		},
	});
}
export function useIrisFdOrders(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/products/fixed-deposits/orders", pan],
		queryFn: () =>
			irisRequest(
				`/api/iris/products/fixed-deposits/orders?pan=${encodeURIComponent(pan)}`,
			),
		enabled: !!pan,
	});
}
export function useIrisFdProducts() {
	return useQuery({
		queryKey: ["/api/iris/products/fixed-deposits"],
		queryFn: () => irisRequest("/api/iris/products/fixed-deposits"),
		staleTime: 30 * 60 * 1000,
	});
}

// NPS
export function useIrisNpsSubscriber(pran: string) {
	return useQuery({
		queryKey: ["/api/iris/nps/subscriber", pran],
		queryFn: () => irisRequest(`/api/iris/nps/subscriber/${pran}`),
		enabled: !!pran && pran.length >= 12,
	});
}
export function useIrisNpsPortfolio(pran: string) {
	return useQuery({
		queryKey: ["/api/iris/nps/subscriber", pran, "portfolio"],
		queryFn: () => irisRequest(`/api/iris/nps/subscriber/${pran}/portfolio`),
		enabled: !!pran && pran.length >= 12,
	});
}
export function useIrisNpsOnboarding() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/nps/subscriber/onboarding", data),
	});
}
export function useIrisNpsContribution() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/nps/transactions/contribution", data),
	});
}

// Non-Financial Transactions
export function useIrisUpdateNominee() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/nominee`, body),
	});
}
export function useIrisUpdateEmail() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/email`, body),
	});
}
export function useIrisUpdateMobile() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/mobile`, body),
	});
}
export function useIrisUpdateFatca() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/fatca`, body),
	});
}
export function useIrisUpdateIdcw() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/idcw`, body),
	});
}
export function useIrisUpdateBank() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/bank`, body),
	});
}
export function useIrisManageBankMandate() {
	return useMutation({
		mutationFn: ({ pan, ...body }: any) =>
			irisRequest(`/api/iris/non-financial/${pan}/bank-mandate`, body),
	});
}

// Business Hierarchy
export function useIrisSubBrokers(params?: Record<string, string>) {
	const qs = params ? "?" + new URLSearchParams(params).toString() : "";
	return useQuery({
		queryKey: ["/api/iris/hierarchy/sub-brokers", params],
		queryFn: () => irisRequest(`/api/iris/hierarchy/sub-brokers${qs}`),
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisAddEmployee() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/hierarchy/employees", data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/iris/hierarchy/sub-brokers"],
			});
		},
	});
}

// Bulk Reports
export function useIrisBulkCapitalGains(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/bulk/capital-gains", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/bulk/capital-gains${qs}`);
		},
		enabled: false,
	});
}
export function useIrisSipMaturityCalendar(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/sip-maturity-calendar", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/sip-maturity-calendar${qs}`);
		},
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisDividendTracker(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/dividend-tracker", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/dividend-tracker${qs}`);
		},
		staleTime: 30 * 60 * 1000,
	});
}

// ─── Phase 1: Switch (IRIS namespace) ────────────────────────────────────────
export function useIrisSwitch() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/switch", data),
		onSuccess: (_d, v) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/iris/investors", v.pan],
			});
		},
	});
}
export function useIrisCancelSwitch() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/transactions/switch/cancel", data),
	});
}

// ─── Phase 1: eNACH ──────────────────────────────────────────────────────────
export function useIrisListEnach(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/enach", pan],
		queryFn: () =>
			irisRequest(`/api/iris/enach?pan=${encodeURIComponent(pan)}`),
		enabled: !!pan,
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisCreateEnach() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) => irisRequest("/api/iris/enach/create", data),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/enach"] }),
	});
}
export function useIrisCancelEnach() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (mandateId: string) =>
			irisRequest(`/api/iris/enach/${mandateId}/cancel`, {}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/enach"] }),
	});
}
export function useIrisRegenerateEnachLink() {
	return useMutation({
		mutationFn: (mandateId: string) =>
			irisRequest(`/api/iris/enach/${mandateId}/regenerate-link`, {}),
	});
}

// ─── Phase 1: UPI Autopay Mandate ────────────────────────────────────────────
export function useIrisListUpiMandates(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/mandates/upi", pan],
		queryFn: () =>
			irisRequest(`/api/iris/mandates/upi?pan=${encodeURIComponent(pan)}`),
		enabled: !!pan,
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisCreateUpiMandate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) => irisRequest("/api/iris/mandates/upi", data),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/mandates/upi"] }),
	});
}
export function useIrisCancelUpiMandate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (umrn: string) =>
			irisRequest(`/api/iris/mandates/upi/${umrn}/cancel`, {}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/mandates/upi"] }),
	});
}

// ─── Phase 1: Folio Management ───────────────────────────────────────────────
export function useIrisFolios(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/investors", pan, "folios"],
		queryFn: () => irisRequest(`/api/iris/investors/${pan}/folios`),
		enabled: !!pan,
		staleTime: 10 * 60 * 1000,
	});
}
export function useIrisFolioDetails(pan: string, folioNo: string) {
	return useQuery({
		queryKey: ["/api/iris/investors", pan, "folios", folioNo],
		queryFn: () => irisRequest(`/api/iris/investors/${pan}/folios/${folioNo}`),
		enabled: !!pan && !!folioNo,
	});
}
export function useIrisFolioTransactions(pan: string, folioNo: string) {
	return useQuery({
		queryKey: ["/api/iris/investors", pan, "folios", folioNo, "transactions"],
		queryFn: () =>
			irisRequest(`/api/iris/investors/${pan}/folios/${folioNo}/transactions`),
		enabled: !!pan && !!folioNo,
	});
}

// ─── Phase 1: Investor Portal Link ───────────────────────────────────────────
export function useIrisInvestorPortalLink(pan: string, enabled = false) {
	return useQuery({
		queryKey: ["/api/iris/investors", pan, "portal-link"],
		queryFn: () => irisRequest(`/api/iris/investors/${pan}/portal-link`),
		enabled: !!pan && enabled,
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisSendPortalLink() {
	return useMutation({
		mutationFn: ({ pan, body }: { pan: string; body?: any }) =>
			irisRequest(`/api/iris/investors/${pan}/portal-link/send`, body ?? {}),
	});
}

// ─── Phase 2: Commission Statements ──────────────────────────────────────────
export function useIrisCommission(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/commission", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/commission${qs}`);
		},
		staleTime: 30 * 60 * 1000,
	});
}
export function useIrisTrailCommission(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/trail-commission", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/trail-commission${qs}`);
		},
		staleTime: 30 * 60 * 1000,
	});
}
export function useIrisCommissionSummary(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/commission/summary", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/commission/summary${qs}`);
		},
		staleTime: 60 * 60 * 1000,
	});
}

// ─── Phase 2: Digital Investor Onboarding ────────────────────────────────────
export function useIrisOnboardingApplications(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/onboarding/applications", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/onboarding/applications${qs}`);
		},
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisInitiateOnboarding() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/onboarding/initiate", data),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ["/api/iris/onboarding/applications"],
			}),
	});
}
export function useIrisResendOnboardingLink() {
	return useMutation({
		mutationFn: (applicationId: string) =>
			irisRequest(`/api/iris/onboarding/${applicationId}/resend-link`, {}),
	});
}
export function useIrisOnboardingStatus(applicationId: string) {
	return useQuery({
		queryKey: ["/api/iris/onboarding", applicationId, "status"],
		queryFn: () => irisRequest(`/api/iris/onboarding/${applicationId}/status`),
		enabled: !!applicationId,
		refetchInterval: 30 * 1000,
	});
}

// ─── Phase 2: CAS Statement ──────────────────────────────────────────────────
export function useIrisCasStatement(
	pan: string,
	params?: Record<string, string>,
) {
	return useQuery({
		queryKey: ["/api/iris/reports/cas", pan, params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/cas/${pan}${qs}`);
		},
		enabled: !!pan,
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisGenerateCas() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/reports/cas/generate", data),
	});
}

// ─── Phase 2: XIRR & Returns ─────────────────────────────────────────────────
export function useIrisInvestorXirr(
	pan: string,
	params?: Record<string, string>,
) {
	return useQuery({
		queryKey: ["/api/iris/analytics/xirr", pan, params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/analytics/xirr/${pan}${qs}`);
		},
		enabled: !!pan,
		staleTime: 30 * 60 * 1000,
	});
}
export function useIrisPortfolioXirr(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/analytics/portfolio-xirr", pan],
		queryFn: () => irisRequest(`/api/iris/analytics/portfolio-xirr/${pan}`),
		enabled: !!pan,
		staleTime: 30 * 60 * 1000,
	});
}
export function useIrisSchemeReturns(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "returns"],
		queryFn: () => irisRequest(`/api/iris/schemes/${schemeCode}/returns`),
		enabled: !!schemeCode,
		staleTime: 60 * 60 * 1000,
	});
}

// ─── Phase 3: Scheme NAV History ─────────────────────────────────────────────
export function useIrisSchemeNavHistory(
	schemeCode: string,
	params?: Record<string, string>,
) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "nav-history", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/schemes/${schemeCode}/nav-history${qs}`);
		},
		enabled: !!schemeCode,
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisSchemeLatestNav(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "nav"],
		queryFn: () => irisRequest(`/api/iris/schemes/${schemeCode}/nav`),
		enabled: !!schemeCode,
		staleTime: 5 * 60 * 1000,
	});
}

// ─── Phase 3: Scheme Performance & Holdings ──────────────────────────────────
export function useIrisSchemePerformance(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "performance"],
		queryFn: () => irisRequest(`/api/iris/schemes/${schemeCode}/performance`),
		enabled: !!schemeCode,
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisTopPerformers(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/schemes/top-performers", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/schemes/top-performers${qs}`);
		},
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisSchemeHoldings(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "holdings"],
		queryFn: () => irisRequest(`/api/iris/schemes/${schemeCode}/holdings`),
		enabled: !!schemeCode,
		staleTime: 24 * 60 * 60 * 1000,
	});
}
export function useIrisSchemeFactSheet(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes", schemeCode, "factsheet"],
		queryFn: () => irisRequest(`/api/iris/schemes/${schemeCode}/factsheet`),
		enabled: !!schemeCode,
		staleTime: 24 * 60 * 60 * 1000,
	});
}

// ─── Phase 3: Scheme Comparison ──────────────────────────────────────────────
export function useIrisCompareSchemes() {
	return useMutation({
		mutationFn: (schemeCodes: string[]) =>
			irisRequest("/api/iris/schemes/compare", { schemeCodes }),
	});
}

// ─── Phase 3: Scheme Categories ──────────────────────────────────────────────
export function useIrisSchemeCategories() {
	return useQuery({
		queryKey: ["/api/iris/categories"],
		queryFn: () => irisRequest("/api/iris/categories"),
		staleTime: 24 * 60 * 60 * 1000,
	});
}
export function useIrisSchemesByCategory(category: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes/by-category", category],
		queryFn: () =>
			irisRequest(
				`/api/iris/schemes/by-category?category=${encodeURIComponent(category)}`,
			),
		enabled: !!category,
		staleTime: 60 * 60 * 1000,
	});
}

// ─── Phase 3: Risk Profiling ──────────────────────────────────────────────────
export function useIrisRiskQuestionnaire() {
	return useQuery({
		queryKey: ["/api/iris/risk-profile/questionnaire"],
		queryFn: () => irisRequest("/api/iris/risk-profile/questionnaire"),
		staleTime: 24 * 60 * 60 * 1000,
	});
}
export function useIrisInvestorRiskProfile(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/investors", pan, "risk-profile"],
		queryFn: () => irisRequest(`/api/iris/investors/${pan}/risk-profile`),
		enabled: !!pan,
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisSubmitRiskProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ pan, body }: { pan: string; body: any }) =>
			irisRequest(`/api/iris/investors/${pan}/risk-profile`, body),
		onSuccess: (_d, v) =>
			queryClient.invalidateQueries({
				queryKey: ["/api/iris/investors", v.pan, "risk-profile"],
			}),
	});
}
export function useIrisSchemesForRisk(riskProfile: string) {
	return useQuery({
		queryKey: ["/api/iris/schemes/recommended", riskProfile],
		queryFn: () =>
			irisRequest(
				`/api/iris/schemes/recommended?riskProfile=${encodeURIComponent(riskProfile)}`,
			),
		enabled: !!riskProfile,
		staleTime: 60 * 60 * 1000,
	});
}

// ─── Phase 3: Application / Order Tracking ───────────────────────────────────
export function useIrisApplications(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/applications", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/applications${qs}`);
		},
		staleTime: 2 * 60 * 1000,
		refetchInterval: 30 * 1000,
	});
}
export function useIrisApplicationStatus(applicationId: string) {
	return useQuery({
		queryKey: ["/api/iris/applications", applicationId, "status"],
		queryFn: () =>
			irisRequest(`/api/iris/applications/${applicationId}/status`),
		enabled: !!applicationId,
		refetchInterval: 15 * 1000,
	});
}
export function useIrisOrderTracking(orderId: string) {
	return useQuery({
		queryKey: ["/api/iris/transactions", orderId, "tracking"],
		queryFn: () => irisRequest(`/api/iris/transactions/${orderId}/tracking`),
		enabled: !!orderId,
		refetchInterval: 15 * 1000,
	});
}

// ─── Phase 3: Alert Management ───────────────────────────────────────────────
export function useIrisAlerts(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/alerts", pan],
		queryFn: () =>
			irisRequest(`/api/iris/alerts?pan=${encodeURIComponent(pan)}`),
		enabled: !!pan,
		staleTime: 5 * 60 * 1000,
	});
}
export function useIrisCreateAlert() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) => irisRequest("/api/iris/alerts", data),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/alerts"] }),
	});
}
export function useIrisDeleteAlert() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (alertId: string) => {
			const res = await fetch(`/api/iris/alerts/${alertId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete alert");
			return res.json();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/alerts"] }),
	});
}

// ─── Phase 3: Compliance / AML Reports ───────────────────────────────────────
export function useIrisComplianceReport(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/compliance", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/compliance${qs}`);
		},
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisPmlaReport(params?: Record<string, string>) {
	return useQuery({
		queryKey: ["/api/iris/reports/pmla", params],
		queryFn: () => {
			const qs = params ? "?" + new URLSearchParams(params).toString() : "";
			return irisRequest(`/api/iris/reports/pmla${qs}`);
		},
		staleTime: 60 * 60 * 1000,
	});
}

// ─── Phase 3: WhatsApp Notifications ─────────────────────────────────────────
export function useIrisNotificationTemplates() {
	return useQuery({
		queryKey: ["/api/iris/notifications/templates"],
		queryFn: () => irisRequest("/api/iris/notifications/templates"),
		staleTime: 24 * 60 * 60 * 1000,
	});
}
export function useIrisSendWhatsapp() {
	return useMutation({
		mutationFn: (data: any) =>
			irisRequest("/api/iris/notifications/whatsapp", data),
	});
}
export function useIrisNotificationHistory(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/notifications/history", pan],
		queryFn: () =>
			irisRequest(
				`/api/iris/notifications/history?pan=${encodeURIComponent(pan)}`,
			),
		enabled: !!pan,
		staleTime: 5 * 60 * 1000,
	});
}

// ─── Phase 3: NFO ─────────────────────────────────────────────────────────────
export function useIrisNfoSchemes() {
	return useQuery({
		queryKey: ["/api/iris/nfo/active"],
		queryFn: () => irisRequest("/api/iris/nfo/active"),
		staleTime: 30 * 60 * 1000,
	});
}
export function useIrisNfoDetails(schemeCode: string) {
	return useQuery({
		queryKey: ["/api/iris/nfo", schemeCode],
		queryFn: () => irisRequest(`/api/iris/nfo/${schemeCode}`),
		enabled: !!schemeCode,
		staleTime: 60 * 60 * 1000,
	});
}
export function useIrisApplyNfo() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: any) => irisRequest("/api/iris/nfo/apply", data),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/nfo"] }),
	});
}
export function useIrisNfoApplications(pan: string) {
	return useQuery({
		queryKey: ["/api/iris/nfo/applications", pan],
		queryFn: () =>
			irisRequest(`/api/iris/nfo/applications?pan=${encodeURIComponent(pan)}`),
		enabled: !!pan,
		staleTime: 10 * 60 * 1000,
	});
}
export function useIrisCancelNfo() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (applicationId: string) =>
			irisRequest(`/api/iris/nfo/applications/${applicationId}/cancel`, {}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["/api/iris/nfo"] }),
	});
}

// ─── Direct Pay & Mandates ───────────────────────────────────────────────────
export function useIrisDirectPayStatus(
	pan: string,
	accountNo: string,
	enabled = true,
) {
	return useQuery({
		queryKey: ["/api/iris/transactions/direct-pay-status", pan, accountNo],
		queryFn: () =>
			irisRequest(
				`/api/iris/transactions/direct-pay-status?pan=${encodeURIComponent(pan)}&accountNo=${encodeURIComponent(accountNo)}`,
			),
		enabled: enabled && !!pan && !!accountNo,
		staleTime: 5 * 60 * 1000,
	});
}

export function useIrisActiveMandates(
	pan: string,
	accountNo: string,
	enabled = true,
) {
	return useQuery({
		queryKey: ["/api/iris/transactions/mandates/active", pan, accountNo],
		queryFn: () =>
			irisRequest(
				`/api/iris/transactions/mandates/active?pan=${encodeURIComponent(pan)}&accountNo=${encodeURIComponent(accountNo)}`,
			),
		enabled: enabled && !!pan && !!accountNo,
		staleTime: 5 * 60 * 1000,
	});
}
