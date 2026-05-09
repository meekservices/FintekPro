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
  sourceProductType?: string;
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

// Aggregated fee breakdown for mixed-category baskets
interface CartItem {
  productType: string;
  amount: number;
}

interface UseAggregatedFeeBreakdownOptions {
  items: CartItem[];
  investorTier?: 'retail' | 'sHNI' | 'bHNI' | 'qib';
  includeGst?: boolean;
  applyWaivers?: boolean;
  waiverPercent?: number;
  enabled?: boolean;
}

export function useAggregatedFeeBreakdown(options: UseAggregatedFeeBreakdownOptions) {
  const {
    items,
    investorTier = 'retail',
    includeGst = true,
    applyWaivers = false,
    waiverPercent = 0,
    enabled = true
  } = options;

  // Create a stable key for the items array
  const itemsKey = JSON.stringify(items.map(i => `${i.productType}:${i.amount}`).sort());

  const query = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/admin/platform-fees/calculate-aggregated', itemsKey, investorTier, includeGst, applyWaivers, waiverPercent],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/admin/platform-fees/calculate-aggregated', {
        items,
        investorTier,
        includeGst,
        applyWaivers,
        waiverPercent
      });
      return response.json();
    },
    enabled: enabled && items.length > 0 && items.every(i => i.amount > 0),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Transform response to match FeeBreakdown interface
  const transformedBreakdown: FeeBreakdown | undefined = query.data?.data ? {
    fees: query.data.data.fees.map((fee: any) => ({
      feeCode: fee.feeCode,
      feeName: fee.feeName || fee.displayLabel,
      category: fee.category,
      chargeType: fee.chargeType,
      baseAmount: fee.baseAmount,
      gstAmount: fee.gstAmount,
      waiverAmount: fee.waiverAmount || 0,
      netAmount: fee.totalAmount || (fee.baseAmount + fee.gstAmount),
      rateApplied: fee.rateApplied,
      isWaived: fee.isWaived || false,
      sourceProductType: fee.sourceProductType,
    })),
    summary: {
      subtotal: query.data.data.totalFees,
      totalGst: query.data.data.totalGst,
      totalWaivers: query.data.data.totalWaivers,
      grandTotal: query.data.data.grandTotal,
      feeCount: query.data.data.fees.length,
    },
    metadata: {
      transactionAmount: query.data.data.transactionAmount,
      productType: query.data.data.productType,
      investorTier: query.data.data.investorTier,
      calculatedAt: new Date().toISOString(),
    }
  } : undefined;

  return {
    feeBreakdown: transformedBreakdown,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

export type { FeeBreakdown, CalculatedFee, CartItem };
