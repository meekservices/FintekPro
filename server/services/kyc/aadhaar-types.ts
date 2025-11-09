/**
 * Aadhaar KYC Type Definitions
 * 
 * Consolidated type definitions for Aadhaar OTP verification flows.
 * Used by both real Sandbox API integration and mock fallback service.
 * 
 * Design Notes:
 * - `isMock` flag distinguishes test data from production verification
 * - Field names normalized across real/mock implementations
 * - Optional contact fields (mobile, email) accommodate varying API responses
 */

/**
 * Response from Aadhaar OTP generation (Step 1)
 */
export interface AadhaarOTPResponse {
  success: boolean;
  message: string;
  /** Reference ID for OTP verification - may be 'MOCK_*' prefix for test mode */
  ref_id?: string;
  /** Deprecated field for backward compatibility with mock service */
  transactionId?: string;
  status?: string;
  /** Masked Aadhaar number (e.g., "XXXX XXXX 1234") */
  maskedAadhaar?: string;
  /** Indicates if this is mock/test data (non-production only) */
  isMock?: boolean;
}

/**
 * Response from Aadhaar OTP verification (Step 2)
 */
export interface AadhaarVerificationResponse {
  success: boolean;
  message: string;
  verified: boolean;
  data?: {
    /** Full or masked Aadhaar number */
    aadhaarNumber?: string;
    /** Full name as per UIDAI */
    name: string;
    /** Date of birth (YYYY-MM-DD format) */
    dob: string;
    /** Gender (M/F/O) */
    gender: string;
    /** Father's name or care-of person */
    fatherName?: string;
    /** Complete address details */
    address: {
      house: string;
      street: string;
      landmark: string;
      locality: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
    /** Registered mobile number (optional, may not be available) */
    mobile?: string;
    /** Registered email address (optional, may not be available) */
    email?: string;
    /** Base64 encoded photo or photo URL */
    photoUrl?: string;
  };
  /** Indicates if this is mock/test data (non-production only) */
  isMock?: boolean;
}
