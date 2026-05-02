import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface UnifiedFinancialProfile {
  id: string;
  userId: number;
  netWorth: string;
  totalAssets: string;
  totalLiabilities: string;
  creditUtilization: string;
  riskScore: string;
  lastUpdated: string;
}

export interface CreditProduct {
  id: string;
  providerId: string;
  productType: "PERSONAL_LOAN" | "CREDIT_CARD" | "MORTGAGE" | "OVERDRAFT";
  name: string;
  description: string;
  interestRate: number;
  minAmount: number;
  maxAmount: number;
  maxTenureMonths: number;
  requirements: Record<string, any>;
  isActive: boolean;
}

export interface CreditApplication {
  id: string;
  userId: number;
  productId: string;
  providerId: string;
  requestedAmount: string;
  requestedTenureMonths: number;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED";
  providerRef?: string;
  decisionReason?: string;
  approvedAmount?: string;
  approvedInterestRate?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Financial Profile Hooks
// ==========================================

export function useUnifiedFinancialProfile() {
  return useQuery<UnifiedFinancialProfile>({
    queryKey: ["/api/mpal/financial-profile"],
    // Fetch user's unified financial profile from MPAL
  });
}

// ==========================================
// Credit Marketplace Hooks
// ==========================================

export function useCreditProducts() {
  return useQuery<CreditProduct[]>({
    queryKey: ["/api/mpal/credit/products"],
  });
}

export function useCreditEligibility() {
  return useQuery<{
    score: number;
    approvedAmount: number;
    riskTier: "LOW" | "MEDIUM" | "HIGH";
    reasons: string[];
    breakdown: {
      assetBackedScore: number;
      liabilityScore: number;
      kycScore: number;
    };
  }>({
    queryKey: ["/api/mpal/credit/eligibility"],
  });
}

export function useSubmitCreditApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (application: Omit<CreditApplication, "id" | "status" | "createdAt" | "updatedAt">) => {
      const response = await apiRequest("POST", "/api/mpal/credit/applications", application);
      if (!response.ok) {
        throw new Error("Failed to submit credit application");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mpal/credit/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mpal/financial-profile"] }); // Invalidate profile to update liabilities
    },
  });
}

export function useCreditApplications() {
  return useQuery<CreditApplication[]>({
    queryKey: ["/api/mpal/credit/applications"],
  });
}

// ==========================================
// Investment Hooks
// ==========================================

export function useBrokerMarketData(assetClass: "US_EQUITY" | "INDIAN_EQUITY" | "MUTUAL_FUND" | "UNLISTED") {
  return useQuery({
    queryKey: ["/api/mpal/broker", assetClass, "quotes"],
  });
}

export function useBrokerPositions(assetClass: "US_EQUITY" | "INDIAN_EQUITY" | "MUTUAL_FUND" | "UNLISTED") {
  return useQuery({
    queryKey: ["/api/mpal/broker", assetClass, "positions"],
  });
}
