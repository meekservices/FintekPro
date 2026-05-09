import axios from 'axios';

// Razorpay IFSC Lookup API (Free, no authentication required)
const RAZORPAY_IFSC_API = 'https://ifsc.razorpay.com';

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
 * Uses Razorpay's free IFSC API
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

    console.log(`🔍 Looking up IFSC: ${normalizedIFSC}`);

    // Call Razorpay IFSC API
    const response = await axios.get(`${RAZORPAY_IFSC_API}/${normalizedIFSC}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });

    const apiData = response.data;

    // Extract bank code and branch code from IFSC
    const bankCode = normalizedIFSC.substring(0, 4);
    const branchCode = normalizedIFSC.substring(5);

    const ifscDetails: IFSCDetails = {
      ifsc: normalizedIFSC,
      bank: apiData.BANK || apiData.bank || '',
      branch: apiData.BRANCH || apiData.branch || '',
      address: apiData.ADDRESS || apiData.address || '',
      contact: apiData.CONTACT || apiData.contact || '',
      city: apiData.CITY || apiData.city || '',
      district: apiData.DISTRICT || apiData.district || '',
      state: apiData.STATE || apiData.state || '',
      bankCode,
      branchCode
    };

    console.log(`✅ IFSC lookup successful: ${ifscDetails.bank} - ${ifscDetails.branch}`);

    return {
      success: true,
      data: ifscDetails
    };

  } catch (error: any) {
    console.error('❌ IFSC lookup error:', error.message);

    // Handle specific error cases
    if (error.response?.status === 404) {
      return {
        success: false,
        errorMessage: 'IFSC code not found. Please verify and try again.'
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        errorMessage: 'Request timed out. Please try again.'
      };
    }

    if (error.response?.data) {
      return {
        success: false,
        errorMessage: error.response.data.message || 'Failed to lookup IFSC code'
      };
    }

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
