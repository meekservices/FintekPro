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

interface SandboxVerificationResponse {
  code: number;
  transaction_id?: string;
  message?: string;
  data?: {
    account_exists: boolean;
    name_at_bank: string;
    account_status?: string;
    amount_deposited?: string | number;
    utr?: string;
    message?: string;
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
  // Cashfree returns account_status ("ACTIVE"/"INVALID") not account_exists boolean
  const accountStatus: string = (data.account_status || '').toUpperCase();
  const accountExists: boolean =
    data.account_exists === true ||
    accountStatus === 'ACTIVE' ||
    accountStatus === 'VALID' ||
    (data.account_exists !== false && accountStatus !== 'INVALID' && accountStatus !== 'NOT_FOUND');
  const nameMatchScore = nameAtBank ? calculateNameMatchScore(accountHolderName, nameAtBank) : undefined;

  if (!accountExists) {
    return {
      success: false,
      errorMessage: data.message || 'Bank account does not exist or is invalid',
      providerResponse: result.data,
    };
  }

  // If we get back no name, treat as account not found
  if (!nameAtBank) {
    return {
      success: false,
      errorMessage: data.message || 'Could not retrieve account holder name from bank',
      providerResponse: result.data,
    };
  }

  console.log(`✅ [BankVerify] Cashfree VRS succeeded. Name at bank: "${nameAtBank}", match: ${nameMatchScore ?? 'N/A'}%`);
  return {
    success: true,
    transactionId: data.verification_id || data.reference_id,
    accountStatus: 'active',
    verifiedName: nameAtBank,
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

    console.log(`🏦 Initiating penny drop for account: ${accountNumber.slice(-4)} (${SANDBOX_BASE_URL})`);

    const token = await getSandboxAccessToken();

    const queryParams: Record<string, string> = {};
    if (accountHolderName) queryParams.name = accountHolderName;

    const response = await axios.get<SandboxVerificationResponse>(
      `${SANDBOX_BASE_URL}/bank/${ifscCode.toUpperCase()}/accounts/${accountNumber}/verify`,
      {
        params: queryParams,
        headers: {
          'x-api-key': apiKey,
          'Authorization': token,
          'x-api-version': '1.0.0'
        },
        timeout: 30000
      }
    );

    const apiResponse = response.data;

    if (apiResponse.code === 200 && apiResponse.data) {
      const { account_exists, name_at_bank, account_status, amount_deposited } = apiResponse.data;
      const transaction_id = apiResponse.transaction_id;

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

    return {
      success: false,
      errorMessage: apiResponse.message || (apiResponse.error as any)?.message || 'Unexpected response from bank verification service',
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
