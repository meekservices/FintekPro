import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CalculatedFee {
  feeCode: string;
  feeName: string;
  category: string;
  chargeType: string;
  baseAmount: number;
  gstAmount: number;
  waiverAmount: number;
  netAmount: number;
  rateApplied: string;
  isWaived: boolean;
}

interface FeeBreakdown {
  fees: CalculatedFee[];
  summary: {
    subtotal: number;
    totalGst: number;
    totalWaivers: number;
    grandTotal: number;
    feeCount: number;
  };
  metadata: {
    transactionAmount: number;
    productType: string;
    investorTier: string;
    calculatedAt: string;
  };
}

interface UseFeeBreakdownOptions {
  transactionAmount: number;
  productType: string;
  investorTier?: 'retail' | 'sHNI' | 'bHNI' | 'qib';
  includeGst?: boolean;
  applyWaivers?: boolean;
  waiverPercent?: number;
  enabled?: boolean;
}

export function useFeeBreakdown(options: UseFeeBreakdownOptions) {
  const {
    transactionAmount,
    productType,
    investorTier = 'retail',
    includeGst = true,
    applyWaivers = false,
    waiverPercent = 0,
    enabled = true
  } = options;

  const query = useQuery<{ success: boolean; data: FeeBreakdown }>({
    queryKey: ['/api/admin/platform-fees/calculate', transactionAmount, productType, investorTier, includeGst, applyWaivers, waiverPercent],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/admin/platform-fees/calculate', {
        transactionAmount,
        productType,
        investorTier,
        includeGst,
        applyWaivers,
        waiverPercent
      });
      return response.json();
    },
    enabled: enabled && transactionAmount > 0 && !!productType,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    feeBreakdown: query.data?.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

export type { FeeBreakdown, CalculatedFee };
