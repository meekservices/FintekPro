// CurrentUser type for /api/user endpoint response
// This extends the base User type with KYC-specific fields
export interface CurrentUser {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  roles: string[];
  isActive: boolean;
  
  // KYC-specific fields from API response
  kycCompleted: boolean;
  kycTier: string;
  smartKycCompletedAt: string | null; // ISO date string from JSON
  panNumber: string | null;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}
