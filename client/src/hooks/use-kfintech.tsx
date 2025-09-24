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