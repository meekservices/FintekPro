import axios from 'axios';

// Sandbox API Configuration
const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';
const SANDBOX_API_URL = `${SANDBOX_BASE_URL}/bank`;
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY;
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET;

// Penny drop verification response interface
export interface PennyDropResult {
  success: boolean;
  transactionId?: string;
  accountStatus?: 'active' | 'inactive' | 'dormant';
  verifiedName?: string;
  nameMatchScore?: number;
  amount?: number;
  errorMessage?: string;
  providerResponse?: any;
}

// Sandbox API request interface
interface SandboxVerificationRequest {
  account_number: string;
  ifsc: string;
  beneficiary_name: string;
}

// Sandbox API response interface
interface SandboxVerificationResponse {
  status: string;
  message?: string;
  data?: {
    transaction_id: string;
    account_exists: boolean;
    name_at_bank: string;
    account_status?: string;
    amount_deposited?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fuzzy name matching algorithm using Levenshtein distance
 * Returns similarity score from 0-100
 */
export function calculateNameMatchScore(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  // Normalize names: uppercase, remove special chars, trim spaces
  const normalize = (str: string) => 
    str.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match
  if (n1 === n2) return 100;

  // Levenshtein distance calculation
  const matrix: number[][] = [];
  
  for (let i = 0; i <= n1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= n2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      if (n1[i - 1] === n2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[n1.length][n2.length];
  const maxLength = Math.max(n1.length, n2.length);
  
  if (maxLength === 0) return 100;
  
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.round(similarity);
}

/**
 * Verify bank account using Sandbox penny drop API
 */
export async function verifyBankAccountPennyDrop(
  accountNumber: string,
  ifscCode: string,
  accountHolderName: string
): Promise<PennyDropResult> {
  try {
    // Validate API credentials
    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Sandbox API credentials not configured');
    }

    // Prepare request
    const requestData: SandboxVerificationRequest = {
      account_number: accountNumber,
      ifsc: ifscCode.toUpperCase(),
      beneficiary_name: accountHolderName
    };

    console.log(`🏦 Initiating penny drop for account: ${accountNumber.slice(-4)}`);

    // Call Sandbox API
    const response = await axios.post<SandboxVerificationResponse>(
      `${SANDBOX_API_URL}/verification`,
      requestData,
      {
        headers: {
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const apiResponse = response.data;
    console.log('📋 Sandbox API Response:', JSON.stringify(apiResponse, null, 2));

    // Handle successful verification
    if (apiResponse.status === 'success' && apiResponse.data) {
      const { transaction_id, account_exists, name_at_bank, account_status, amount_deposited } = apiResponse.data;

      if (!account_exists) {
        return {
          success: false,
          errorMessage: 'Bank account does not exist or is invalid',
          providerResponse: apiResponse
        };
      }

      // Calculate name match score
      const nameMatchScore = calculateNameMatchScore(accountHolderName, name_at_bank);

      console.log(`✅ Verification successful. Name match: ${nameMatchScore}%`);

      return {
        success: true,
        transactionId: transaction_id,
        accountStatus: (account_status as 'active' | 'inactive' | 'dormant') || 'active',
        verifiedName: name_at_bank,
        nameMatchScore,
        amount: amount_deposited || 1.00,
        providerResponse: apiResponse
      };
    }

    // Handle API errors
    if (apiResponse.error) {
      console.error('❌ Sandbox API Error:', apiResponse.error);
      return {
        success: false,
        errorMessage: apiResponse.error.message || 'Verification failed',
        providerResponse: apiResponse
      };
    }

    // Handle unexpected response
    return {
      success: false,
      errorMessage: apiResponse.message || 'Unexpected response from bank verification service',
      providerResponse: apiResponse
    };

  } catch (error: any) {
    console.error('❌ Penny drop service error:', error);

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        errorMessage: 'Verification request timed out. Please try again.',
        providerResponse: { error: error.message }
      };
    }

    // Handle API errors
    if (error.response?.data) {
      return {
        success: false,
        errorMessage: error.response.data.message || 'Bank verification failed',
        providerResponse: error.response.data
      };
    }

    // Generic error
    return {
      success: false,
      errorMessage: error.message || 'Failed to verify bank account',
      providerResponse: { error: error.message }
    };
  }
}

/**
 * Validate IFSC code format
 */
export function validateIFSC(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
}

/**
 * Validate bank account number format
 */
export function validateAccountNumber(accountNumber: string): boolean {
  // Account numbers are typically 9-18 digits
  const accountRegex = /^[0-9]{9,18}$/;
  return accountRegex.test(accountNumber);
}

/**
 * Check if name match score is acceptable
 * Default threshold is 80% for fuzzy matching
 */
export function isNameMatchAcceptable(score: number, threshold: number = 80): boolean {
  return score >= threshold;
}
