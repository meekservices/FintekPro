import axios from 'axios';
import { getSandboxBaseUrl, getSandboxApiKey, getSandboxApiSecret, getSandboxAccessToken, clearSandboxToken } from './utils/sandbox-config';
import { verifyBankAccountV2 } from './services/cashfree-vrs-service';
import { hasCashfreeSecureIDCredentials } from './utils/cashfree-config';

const SANDBOX_BASE_URL = getSandboxBaseUrl();
const SANDBOX_API_URL = `${SANDBOX_BASE_URL}/bank`;

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

interface SandboxVerificationRequest {
  account_number: string;
  ifsc: string;
  beneficiary_name: string;
}

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

export function calculateNameMatchScore(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const normalize = (str: string) => 
    str.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 100;

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
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

// ── Cashfree VRS fallback (used when Sandbox.co.in credentials are absent) ──────
async function verifyBankAccountViaCashfree(
  accountNumber: string,
  ifscCode: string,
  accountHolderName: string
): Promise<PennyDropResult> {
  console.log(`🏦 [BankVerify] Using Cashfree VRS (Sandbox.co.in credentials not configured)`);
  const result = await verifyBankAccountV2({
    bankAccount: accountNumber,
    ifsc: ifscCode.toUpperCase(),
    name: accountHolderName,
  });

  if (!result.success) {
    return {
      success: false,
      errorMessage: result.error || 'Bank verification failed via Cashfree Secure ID',
      providerResponse: result.data,
    };
  }

  const data: any = result.data || {};
  const nameAtBank: string = data.name_at_bank || data.account_holder_name || '';
  const accountExists: boolean = data.account_exists !== false; // treat absent as true
  const nameMatchScore = nameAtBank ? calculateNameMatchScore(accountHolderName, nameAtBank) : undefined;

  if (!accountExists) {
    return {
      success: false,
      errorMessage: 'Bank account does not exist or is invalid',
      providerResponse: result.data,
    };
  }

  console.log(`✅ [BankVerify] Cashfree VRS succeeded. Name match: ${nameMatchScore ?? 'N/A'}%`);
  return {
    success: true,
    transactionId: data.verification_id || data.reference_id,
    accountStatus: 'active',
    verifiedName: nameAtBank || accountHolderName,
    nameMatchScore,
    amount: 1.00,
    providerResponse: result.data,
  };
}

export async function verifyBankAccountPennyDrop(
  accountNumber: string,
  ifscCode: string,
  accountHolderName: string
): Promise<PennyDropResult> {
  // ── Use Cashfree VRS when Sandbox.co.in credentials are not set ─────────────
  const sandboxApiKey = getSandboxApiKey();
  const sandboxApiSecret = getSandboxApiSecret();
  if (!sandboxApiKey || !sandboxApiSecret) {
    if (hasCashfreeSecureIDCredentials()) {
      return verifyBankAccountViaCashfree(accountNumber, ifscCode, accountHolderName);
    }
    return {
      success: false,
      errorMessage: 'Bank verification service not configured. Contact support.',
      providerResponse: { error: 'No credentials: SANDBOX_API_KEY or CASHFREE_VERIFICATION_APP_ID required' },
    };
  }

  try {
    const apiKey = sandboxApiKey;

    const requestData: SandboxVerificationRequest = {
      account_number: accountNumber,
      ifsc: ifscCode.toUpperCase(),
      beneficiary_name: accountHolderName
    };

    console.log(`🏦 Initiating penny drop for account: ${accountNumber.slice(-4)} (${SANDBOX_BASE_URL})`);

    const token = await getSandboxAccessToken();

    const response = await axios.post<SandboxVerificationResponse>(
      `${SANDBOX_API_URL}/verification`,
      requestData,
      {
        headers: {
          'x-api-key': apiKey,
          'Authorization': token,
          'Content-Type': 'application/json',
          'x-api-version': '1.0.0'
        },
        timeout: 30000
      }
    );

    const apiResponse = response.data;

    if (apiResponse.status === 'success' && apiResponse.data) {
      const { transaction_id, account_exists, name_at_bank, account_status, amount_deposited } = apiResponse.data;

      if (!account_exists) {
        return {
          success: false,
          errorMessage: 'Bank account does not exist or is invalid',
          providerResponse: apiResponse
        };
      }

      const nameMatchScore = calculateNameMatchScore(accountHolderName, name_at_bank);

      console.log(`✅ Penny drop verification successful. Name match: ${nameMatchScore}%`);

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

    if (apiResponse.error) {
      console.error('❌ Sandbox Penny Drop API Error:', apiResponse.error);
      return {
        success: false,
        errorMessage: apiResponse.error.message || 'Verification failed',
        providerResponse: apiResponse
      };
    }

    return {
      success: false,
      errorMessage: apiResponse.message || 'Unexpected response from bank verification service',
      providerResponse: apiResponse
    };

  } catch (error: any) {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      clearSandboxToken();
      console.error('❌ Penny drop auth failed — token cleared for retry:', error.response?.data?.message || error.message);
      return {
        success: false,
        errorMessage: 'Bank verification authentication failed. Please try again.',
        providerResponse: error.response?.data
      };
    }

    console.error('❌ Penny drop service error:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        errorMessage: 'Verification request timed out. Please try again.',
        providerResponse: { error: error.message }
      };
    }

    if (error.response?.data) {
      return {
        success: false,
        errorMessage: error.response.data.message || 'Bank verification failed',
        providerResponse: error.response.data
      };
    }

    return {
      success: false,
      errorMessage: error.message || 'Failed to verify bank account',
      providerResponse: { error: error.message }
    };
  }
}

export function validateIFSC(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
}

export function validateAccountNumber(accountNumber: string): boolean {
  const accountRegex = /^[0-9]{9,18}$/;
  return accountRegex.test(accountNumber);
}

export function isNameMatchAcceptable(score: number, threshold: number = 80): boolean {
  return score >= threshold;
}
