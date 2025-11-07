import { useAuth } from "./useAuth";

export interface KycStatus {
  isKycCompleted: boolean;
  kycTier: string;
  smartKycCompletedAt: string | null; // ISO date string from API
  isLoading: boolean;
  needsKyc: boolean;
}

export function useKycStatus(): KycStatus {
  const { user, isLoading } = useAuth();

  // Determine KYC completion status from CurrentUser type
  const isKycCompleted = !!(user?.kycCompleted || user?.smartKycCompletedAt);
  const kycTier = user?.kycTier || 'basic';
  const smartKycCompletedAt = user?.smartKycCompletedAt || null;
  
  // User needs KYC if they're authenticated but haven't completed KYC
  const needsKyc = !!user && !isKycCompleted;

  return {
    isKycCompleted,
    kycTier,
    smartKycCompletedAt,
    isLoading,
    needsKyc,
  };
}
