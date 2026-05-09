import { verifyIFSC } from './services/cashfree-vrs-service';

// Cashfree IFSC Lookup is now used via the VRS (Verification & Risk Suite)
// Documentation: https://www.cashfree.com/docs/api-reference/vrs/overview

export interface IFSCDetails {
  ifsc: string;
  bank: string;
  branch: string;
  address: string;
  contact?: string;
  city: string;
  district: string;
  state: string;
  bankCode: string;
  branchCode: string;
}

export interface IFSCLookupResult {
  success: boolean;
  data?: IFSCDetails;
  errorMessage?: string;
}

/**
 * Lookup bank and branch details from IFSC code
 * Uses Cashfree's Verification & Risk Suite (VRS)
 */
export async function lookupIFSC(ifscCode: string): Promise<IFSCLookupResult> {
  try {
    // Validate IFSC format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const normalizedIFSC = ifscCode.toUpperCase().trim();
    
    if (!ifscRegex.test(normalizedIFSC)) {
      return {
        success: false,
        errorMessage: 'Invalid IFSC code format. Format: ABCD0123456'
      };
    }

    console.log(`🔍 Looking up IFSC via Cashfree: ${normalizedIFSC}`);

    // Call Cashfree IFSC API
    const result = await verifyIFSC({ ifsc: normalizedIFSC });

    if (!result.success || !result.data) {
      return {
        success: false,
        errorMessage: result.error || 'IFSC code not found or verification failed.'
      };
    }

    const apiData = result.data as any;

    // Extract bank code and branch code from IFSC
    const bankCode = normalizedIFSC.substring(0, 4);
    const branchCode = normalizedIFSC.substring(5);

    const ifscDetails: IFSCDetails = {
      ifsc: normalizedIFSC,
      bank: apiData.bank_name || apiData.bank || '',
      branch: apiData.branch_name || apiData.branch || '',
      address: apiData.address || '',
      contact: apiData.contact || '',
      city: apiData.city || '',
      district: apiData.district || '',
      state: apiData.state || '',
      bankCode,
      branchCode
    };

    console.log(`✅ Cashfree IFSC lookup successful: ${ifscDetails.bank} - ${ifscDetails.branch}`);

    return {
      success: true,
      data: ifscDetails
    };

  } catch (error: any) {
    console.error('❌ IFSC lookup error:', error.message);

    return {
      success: false,
      errorMessage: error.message || 'Failed to lookup IFSC code'
    };
  }
}


/**
 * Validate IFSC code format
 */
export function isValidIFSCFormat(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase().trim());
}
