import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API request helper
async function apiRequest(url: string, data?: any): Promise<any> {
  const options: RequestInit = {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
  transactionType: 'PURCHASE' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'STP' | 'SWP';
  amount: number;
  units: number;
  nav: number;
  transactionDate: string;
  settlementDate: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

export interface KfintechSipDetails {
  sipId: string;
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  amount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  nextInstallmentDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
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
    queryKey: ['/api/kfintech/investor/validate', pan],
    queryFn: () => apiRequest(`/api/kfintech/investor/validate/${pan}`),
    enabled: !!pan && pan.length === 10,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to get Kfintech investor portfolio
export function useKfintechPortfolio(pan: string) {
  return useQuery<KfintechInvestorPortfolio>({
    queryKey: ['/api/kfintech/portfolio', pan],
    queryFn: () => apiRequest(`/api/kfintech/portfolio/${pan}`),
    enabled: !!pan && pan.length === 10,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get Kfintech transaction history
export function useKfintechTransactions(pan: string, fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  
  return useQuery<KfintechTransaction[]>({
    queryKey: ['/api/kfintech/transactions', pan, fromDate, toDate],
    queryFn: () => apiRequest(`/api/kfintech/transactions/${pan}?${params.toString()}`),
    enabled: !!pan && pan.length === 10,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook to get Kfintech SIP details
export function useKfintechSips(pan: string) {
  return useQuery<KfintechSipDetails[]>({
    queryKey: ['/api/kfintech/sip', pan],
    queryFn: () => apiRequest(`/api/kfintech/sip/${pan}`),
    enabled: !!pan && pan.length === 10,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get Kfintech schemes
export function useKfintechSchemes(amc?: string, category?: string) {
  const params = new URLSearchParams();
  if (amc) params.append('amc', amc);
  if (category) params.append('category', category);
  
  return useQuery<KfintechScheme[]>({
    queryKey: ['/api/kfintech/schemes', amc, category],
    queryFn: () => apiRequest(`/api/kfintech/schemes?${params.toString()}`),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Hook to get scheme NAV
export function useKfintechSchemeNav(schemeCode: string) {
  return useQuery({
    queryKey: ['/api/kfintech/nav', schemeCode],
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
      return apiRequest('/api/kfintech/transactions/purchase', data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/portfolio', variables.pan] });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/transactions', variables.pan] });
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
      redemptionType: 'FULL' | 'PARTIAL';
      bankAccount: string;
      ifscCode: string;
    }) => {
      return apiRequest('/api/kfintech/transactions/redemption', data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/portfolio', variables.pan] });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/transactions', variables.pan] });
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
      frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
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
      return apiRequest('/api/kfintech/sip/setup', data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/sip', variables.pan] });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/portfolio', variables.pan] });
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
      return apiRequest('/api/kfintech/sip/cancel', data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/sip', variables.pan] });
    },
  });
}

export function useKfintechStatementGeneration() {
  return useMutation({
    mutationFn: async (data: {
      pan: string;
      fromDate: string;
      toDate: string;
      format: 'PDF' | 'EXCEL';
      email?: string;
    }) => {
      return apiRequest('/api/kfintech/statement/generate', data);
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
      switchType: 'FULL' | 'PARTIAL';
    }) => {
      return apiRequest('/api/kfintech/transactions/switch', data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/portfolio', variables.pan] });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/transactions', variables.pan] });
    },
  });
}
// ─── IRIS API hooks ────────────────────────────────────────────────────────

async function irisRequest(url: string, data?: any, method = data ? 'POST' : 'GET'): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (data) options.body = JSON.stringify(data);
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `Request failed: ${response.status}`);
  return result.data ?? result;
}

// STP hooks
export function useIrisStp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => irisRequest('/api/iris/transactions/stp/register', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/iris'] }); },
  });
}
export function useIrisStpCancel() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/transactions/stp/cancel', data) });
}
export function useIrisStpPause() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/transactions/stp/pause', data) });
}

// SWP hooks
export function useIrisSwp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => irisRequest('/api/iris/transactions/swp/register', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/iris'] }); },
  });
}
export function useIrisSwpCancel() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/transactions/swp/cancel', data) });
}
export function useIrisSwpPause() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/transactions/swp/pause', data) });
}

// Additional Purchase
export function useIrisAdditionalPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => irisRequest('/api/iris/transactions/additional-purchase', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/iris'] }); },
  });
}

// eNACH Mandate
export function useIrisCreateMandate() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/transactions/mandates', data) });
}
export function useIrisMandateStatus(mandateId: string) {
  return useQuery({
    queryKey: ['/api/iris/transactions/mandates', mandateId],
    queryFn: () => irisRequest(`/api/iris/transactions/mandates/${mandateId}`),
    enabled: !!mandateId,
  });
}

// FD Orders
export function useIrisFdOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => irisRequest('/api/iris/products/fixed-deposits/order', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/iris/products/fixed-deposits/orders'] }); },
  });
}
export function useIrisFdOrders(pan: string) {
  return useQuery({
    queryKey: ['/api/iris/products/fixed-deposits/orders', pan],
    queryFn: () => irisRequest(`/api/iris/products/fixed-deposits/orders?pan=${encodeURIComponent(pan)}`),
    enabled: !!pan,
  });
}
export function useIrisFdProducts() {
  return useQuery({
    queryKey: ['/api/iris/products/fixed-deposits'],
    queryFn: () => irisRequest('/api/iris/products/fixed-deposits'),
    staleTime: 30 * 60 * 1000,
  });
}

// NPS
export function useIrisNpsSubscriber(pran: string) {
  return useQuery({
    queryKey: ['/api/iris/nps/subscriber', pran],
    queryFn: () => irisRequest(`/api/iris/nps/subscriber/${pran}`),
    enabled: !!pran && pran.length >= 12,
  });
}
export function useIrisNpsPortfolio(pran: string) {
  return useQuery({
    queryKey: ['/api/iris/nps/subscriber', pran, 'portfolio'],
    queryFn: () => irisRequest(`/api/iris/nps/subscriber/${pran}/portfolio`),
    enabled: !!pran && pran.length >= 12,
  });
}
export function useIrisNpsOnboarding() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/nps/subscriber/onboarding', data) });
}
export function useIrisNpsContribution() {
  return useMutation({ mutationFn: (data: any) => irisRequest('/api/iris/nps/transactions/contribution', data) });
}

// Non-Financial Transactions
export function useIrisUpdateNominee() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/nominee`, body) });
}
export function useIrisUpdateEmail() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/email`, body) });
}
export function useIrisUpdateMobile() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/mobile`, body) });
}
export function useIrisUpdateFatca() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/fatca`, body) });
}
export function useIrisUpdateIdcw() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/idcw`, body) });
}
export function useIrisUpdateBank() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/bank`, body) });
}
export function useIrisManageBankMandate() {
  return useMutation({ mutationFn: ({ pan, ...body }: any) => irisRequest(`/api/iris/non-financial/${pan}/bank-mandate`, body) });
}

// Business Hierarchy
export function useIrisSubBrokers(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['/api/iris/hierarchy/sub-brokers', params],
    queryFn: () => irisRequest(`/api/iris/hierarchy/sub-brokers${qs}`),
    staleTime: 5 * 60 * 1000,
  });
}
export function useIrisAddEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => irisRequest('/api/iris/hierarchy/employees', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/iris/hierarchy/sub-brokers'] }); },
  });
}

// Bulk Reports
export function useIrisBulkCapitalGains(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['/api/iris/reports/bulk/capital-gains', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return irisRequest(`/api/iris/reports/bulk/capital-gains${qs}`);
    },
    enabled: false,
  });
}
export function useIrisSipMaturityCalendar(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['/api/iris/reports/sip-maturity-calendar', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return irisRequest(`/api/iris/reports/sip-maturity-calendar${qs}`);
    },
    staleTime: 60 * 60 * 1000,
  });
}
export function useIrisDividendTracker(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['/api/iris/reports/dividend-tracker', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return irisRequest(`/api/iris/reports/dividend-tracker${qs}`);
    },
    staleTime: 30 * 60 * 1000,
  });
}
