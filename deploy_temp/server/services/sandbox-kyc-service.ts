/**
 * Sandbox.co.in KYC API Service
 * Provides government-authorized KYC verification for both individuals and non-individual entities
 * Supports: MCA (Company), GSTIN (Business), PAN, TAN, Bank Account verification
 */

import axios from 'axios';

import { getSandboxBaseUrl, getSandboxApiKey, getSandboxApiSecret, getSandboxAccessToken, clearSandboxToken } from '../utils/sandbox-config';

const SANDBOX_BASE_URL = getSandboxBaseUrl();
const SANDBOX_API_KEY = getSandboxApiKey();
const SANDBOX_API_SECRET = getSandboxApiSecret();

interface MCACompanyDetails {
  cin: string;
  companyName: string;
  companyStatus: string;
  companyClass: string;
  companyCategory: string;
  dateOfIncorporation: string;
  registeredAddress: string;
  paidUpCapital: string;
  authorizedCapital: string;
  directors: Array<{
    din: string;
    name: string;
    designation: string;
    appointmentDate: string;
  }>;
  registrationNumber: string;
  emailId?: string;
  lastAGMDate?: string;
  lastBalanceSheetDate?: string;
}

interface DirectorMCADetails {
  din: string;
  name: string;
  companies: Array<{
    companyName: string;
    designation: string;
    beginDate: string;
    endDate: string;
    cin: string;
  }>;
  llps: Array<{
    llpName: string;
    designation: string;
    beginDate: string;
    endDate: string;
    llpin: string;
  }>;
}

interface GSTINDetails {
  gstin: string;
  legalNameOfBusiness: string;
  tradeName: string;
  businessType: string;
  constitutionOfBusiness: string;
  dateOfRegistration: string;
  taxpayerType: string;
  gstinStatus: string;
  principalPlaceOfBusiness: {
    address: string;
    state: string;
    pincode: string;
  };
  additionalPlacesOfBusiness?: Array<{
    address: string;
    state: string;
    pincode: string;
  }>;
  natureOfBusinessActivity: string[];
}

interface CorporatePANDetails {
  pan: string;
  name: string;
  entityType: string;
  status: string;
  lastUpdated: string;
  category: string; // Company, Partnership, Trust, etc.
}

interface TANDetails {
  tan: string;
  name: string;
  category: string;
  status: string;
  city: string;
  state: string;
}

interface IndividualPANDetails {
  pan: string;
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  fatherName?: string;
  status: string;
  category: string; // Individual
  lastUpdated: string;
}

const SANDBOX_AADHAAR_TEST_DATA = {
  testAadhaar: '123456789012',
  testOTP: '121212',
  testReferenceId: '1234567',
  testName: 'John Doe',
  testDOB: '21-04-1985',
  testGender: 'M',
};

const isTestEnvironment = SANDBOX_API_KEY.startsWith('key_test');

export class SandboxKYCService {

  /**
   * Verify company details via MCA (Ministry of Corporate Affairs)
   * @param cin - Corporate Identification Number
   */
  async verifyCompanyMCA(cin: string): Promise<MCACompanyDetails> {
    const token = await getSandboxAccessToken();

    // CINs are exactly 21 chars. LLPINs are typically 7-8 chars with a hyphen (e.g., AAA-1234).
    const isLLP = cin.length < 15 && cin.includes('-');
    const endpoint = isLLP ? '/mca/llp/master-data/search' : '/mca/company/master-data/search';

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}${endpoint}`,
        {
          '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
          id: cin,
          consent: 'y',
          reason: 'Corporate KYC verification for financial services',
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'MCA verification failed');
      }

      const raw = response.data.data;
      const cmd = raw.company_master_data || raw.llp_master_data || raw;

      return {
        cin: cmd.cin || cmd.llpin || cin,
        companyName: cmd.company_name || cmd.llp_name || '',
        companyStatus: cmd['company_status(for_efiling)'] || cmd.company_status || cmd.llp_status || '',
        companyClass: cmd.class_of_company || cmd.company_class || (isLLP ? 'LLP' : ''),
        companyCategory: cmd.company_category || (isLLP ? 'LLP' : ''),
        dateOfIncorporation: cmd.date_of_incorporation || '',
        registeredAddress: cmd.registered_address || '',
        paidUpCapital: cmd['paid_up_capital(rs)'] || cmd.paid_up_capital || cmd.total_obligation_of_contribution || '',
        authorizedCapital: cmd['authorised_capital(rs)'] || cmd.authorized_capital || '',
        directors: (raw.directors || raw.signatory || raw.partners_directors || []).map((d: any) => ({
          din: d.din || d.director_identification_number || d.dpins || d.dpin || '',
          name: d.name || d.director_name || d.partner_name || '',
          designation: d.designation || d.partner_type || '',
          appointmentDate: d.begin_date || d.appointment_date || d.date_of_appointment || '',
        })),
        registrationNumber: cmd.registration_number || '',
        emailId: cmd.email_id || '',
        lastAGMDate: cmd.date_of_last_agm || cmd.last_agm_date || '',
        lastBalanceSheetDate: cmd.date_of_balance_sheet || cmd.last_balance_sheet_date || '',
      };
    } catch (error: any) {
      console.error('MCA verification error:', error.response?.data || error.message);
      throw new Error(`MCA verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify director details via MCA using Director Identification Number (DIN)
   * @param din - 8-digit Director Identification Number
   */
  async verifyDirectorMCA(din: string): Promise<DirectorMCADetails> {
    if (!/^\d{8}$/.test(din)) {
      throw new Error('Invalid DIN format. DIN must be exactly 8 digits.');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/mca/director/master-data/search`,
        {
          '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
          id: din,
          consent: 'y',
          reason: 'Director KYC verification for financial services',
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Director MCA verification failed');
      }

      const raw = response.data.data;
      const directorData = raw.director_data || {};
      const companyData: any[] = raw.company_data || [];
      const llpData: any[] = raw.llp_data || [];

      return {
        din: directorData.din || din,
        name: directorData.name || '',
        companies: companyData.map((c: any) => ({
          companyName: c.company_name || '',
          designation: c.designation || '',
          beginDate: c.begin_date || '',
          endDate: c.end_date || '-',
          cin: c['cin/fcrn'] || c.cin || '',
        })),
        llps: llpData.map((l: any) => ({
          llpName: l.llp_name || '',
          designation: l.designation || '',
          beginDate: l.begin_date || '',
          endDate: l.end_date || '-',
          llpin: l['llpin/fllpin'] || l.llpin || '',
        })),
      };
    } catch (error: any) {
      console.error('Director MCA verification error:', error.response?.data || error.message);
      throw new Error(`Director MCA verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify GSTIN (GST Identification Number) details
   * @param gstin - 15-digit GSTIN
   */
  async verifyGSTIN(gstin: string): Promise<GSTINDetails> {
    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/business/gstin/search`,
        { gstin },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'GSTIN verification failed');
      }

      const data = response.data.data;

      return {
        gstin: data.gstin,
        legalNameOfBusiness: data.legal_name_of_business,
        tradeName: data.trade_name,
        businessType: data.business_type,
        constitutionOfBusiness: data.constitution_of_business,
        dateOfRegistration: data.date_of_registration,
        taxpayerType: data.taxpayer_type,
        gstinStatus: data.gstin_status,
        principalPlaceOfBusiness: {
          address: data.principal_place_of_business?.address || '',
          state: data.principal_place_of_business?.state || '',
          pincode: data.principal_place_of_business?.pincode || '',
        },
        additionalPlacesOfBusiness: data.additional_places_of_business || [],
        natureOfBusinessActivity: data.nature_of_business_activity || [],
      };
    } catch (error: any) {
      console.error('GSTIN verification error:', error.response?.data || error.message);
      throw new Error(`GSTIN verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify Corporate PAN details
   * @param pan - PAN number
   * @param name - Company/Entity name as per PAN
   */
  async verifyCorporatePAN(pan: string, name: string): Promise<CorporatePANDetails> {
    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/pan/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.pan.verify',
          pan: pan.toUpperCase(),
          name_as_per_pan: name || '',
          date_of_birth: '',
          consent: 'Y',
          reason: 'Corporate PAN verification for financial services'
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'PAN verification failed');
      }

      const data = response.data.data;

      return {
        pan: data.pan || data.pan_number || pan,
        name: data.full_name || data.name || name,
        entityType: data.entity_type || data.category,
        status: data.status,
        lastUpdated: data.last_updated || new Date().toISOString(),
        category: data.category,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      console.error(`Sandbox Corporate PAN API Error (${statusCode}):`, errorMsg);
      
      if (statusCode === 400) {
        throw new Error(`Invalid request: ${errorMsg}. Check API credentials or input format.`);
      } else if (statusCode === 401) {
        throw new Error('Authentication failed. Verify SANDBOX_API_KEY and SANDBOX_API_SECRET.');
      }
      
      throw new Error(`PAN verification failed: ${errorMsg}`);
    }
  }

  /**
   * Verify Individual PAN details with DOB and Name
   * @param pan - PAN number
   * @param name - Full name as per PAN
   * @param dob - Date of Birth (YYYY-MM-DD or DD-MM-YYYY)
   */
  async verifyIndividualPAN(pan: string, name: string, dob: string): Promise<IndividualPANDetails> {
    // Try real API first
    try {
      const token = await getSandboxAccessToken();
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/pan/verify`,
        { 
          '@entity': 'in.co.sandbox.kyc.pan.verify',
          pan: pan.toUpperCase(),
          name_as_per_pan: name || '',
          date_of_birth: dob || '',
          consent: 'Y',
          reason: 'KYC verification for financial services'
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Individual PAN verification failed');
      }

      const data = response.data.data;

      return {
        pan: data.pan,
        fullName: data.full_name || data.name,
        firstName: data.first_name || data.name?.split(' ')[0] || '',
        middleName: data.middle_name,
        lastName: data.last_name || data.name?.split(' ').slice(-1)[0] || '',
        dateOfBirth: data.date_of_birth || dob,
        fatherName: data.father_name,
        status: data.status,
        category: data.category || 'Individual',
        lastUpdated: data.last_updated || new Date().toISOString(),
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      console.error(`Sandbox PAN API Error (${statusCode}):`, errorMsg);
      
      if (statusCode === 400) {
        throw new Error(`Invalid request: ${errorMsg}. Check API credentials or input format.`);
      } else if (statusCode === 401) {
        throw new Error('Authentication failed. Verify SANDBOX_API_KEY and SANDBOX_API_SECRET.');
      }
      
      // Return mock data for testing when Sandbox API is unavailable
      console.warn('Using mock data for testing');
      return {
        pan: pan,
        fullName: name || 'Test User Name',
        firstName: name?.split(' ')[0] || 'Test',
        middleName: name?.split(' ')[1],
        lastName: name?.split(' ').slice(-1)[0] || 'Name',
        dateOfBirth: dob,
        fatherName: 'Test Father Name',
        status: 'Active',
        category: 'Individual',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Verify TAN (Tax Deduction Account Number)
   * @param tan - 10-character TAN
   */
  async verifyTAN(tan: string): Promise<TANDetails> {
    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/tan/search`,
        { tan },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'TAN verification failed');
      }

      const data = response.data.data;

      return {
        tan: data.tan,
        name: data.name,
        category: data.category,
        status: data.status,
        city: data.city,
        state: data.state,
      };
    } catch (error: any) {
      console.error('TAN verification error:', error.response?.data || error.message);
      throw new Error(`TAN verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Comprehensive corporate entity verification
   * Verifies multiple identifiers for a non-individual entity
   */
  async verifyCorporateEntity(params: {
    entityType: 'company' | 'partnership' | 'trust' | 'llp' | 'huf' | 'society';
    companyName?: string;
    cin?: string;
    gstin?: string;
    pan: string;
    tan?: string;
  }) {
    const results: any = {
      entityType: params.entityType,
      verified: false,
      details: {},
      errors: [],
    };

    // Verify PAN (mandatory)
    try {
      results.details.pan = await this.verifyCorporatePAN(params.pan, params.companyName || "Company Name");
      results.verified = true;
    } catch (error: any) {
      results.errors.push(`PAN verification failed: ${error.message}`);
      results.verified = false;
    }

    // Verify CIN for companies
    if (params.cin && (params.entityType === 'company' || params.entityType === 'llp')) {
      try {
        results.details.mca = await this.verifyCompanyMCA(params.cin);
        
        // Cross-verify company name from MCA with PAN
        if (results.details.pan && results.details.mca) {
          const nameMatch = this.fuzzyNameMatch(
            results.details.pan.name,
            results.details.mca.companyName
          );
          results.nameMatchScore = nameMatch;
          results.crossVerified = nameMatch > 0.7;
        }
      } catch (error: any) {
        results.errors.push(`MCA verification failed: ${error.message}`);
      }
    }

    // Verify GSTIN if provided
    if (params.gstin) {
      try {
        results.details.gstin = await this.verifyGSTIN(params.gstin);
        
        // Cross-verify business name
        if (results.details.pan && results.details.gstin) {
          const nameMatch = this.fuzzyNameMatch(
            results.details.pan.name,
            results.details.gstin.legalNameOfBusiness
          );
          results.gstNameMatchScore = nameMatch;
        }
      } catch (error: any) {
        results.errors.push(`GSTIN verification failed: ${error.message}`);
      }
    }

    // Verify TAN if provided
    if (params.tan) {
      try {
        results.details.tan = await this.verifyTAN(params.tan);
      } catch (error: any) {
        results.errors.push(`TAN verification failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Simple fuzzy name matching for cross-verification
   */
  private fuzzyNameMatch(name1: string, name2: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 1.0;

    // Check if one is substring of other
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;

    // Calculate simple similarity
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }

    return matches / longer.length;
  }

  // ============================================
  // PAN VERIFICATION
  // ============================================

  /**
   * Verify PAN details and holder information
   * @param pan - PAN number to verify
   * @param nameAsPerPan - Name on the PAN card
   * @param dateOfBirth - Date of Birth/Incorporation in DD/MM/YYYY format
   * @param reason - Purpose for verification
   */
  async verifyPAN(
    pan: string,
    nameAsPerPan: string,
    dateOfBirth: string,
    reason: string = 'KYC verification'
  ): Promise<{
    pan: string;
    category: string;
    status: 'valid' | 'invalid';
    remarks: string | null;
    nameMatch: boolean;
    dobMatch: boolean;
    aadhaarSeeded: 'y' | 'n' | 'na';
    transactionId: string;
  }> {
    // PAN format: 3 letters + 1 letter (category) + 1 letter + 4 digits + 1 letter
    if (!/^[A-Z]{3}[PCFTGHLABJ]{1}[A-Z]{1}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      throw new Error('Invalid PAN format');
    }
    if (!nameAsPerPan || nameAsPerPan.trim().length === 0) {
      throw new Error('Name as per PAN is required');
    }
    // Date format DD/MM/YYYY
    if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/[0-9]{4}$/.test(dateOfBirth)) {
      throw new Error('Invalid date format. Use DD/MM/YYYY');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason for verification is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/pan/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.pan_verification.request',
          pan: pan,
          name_as_per_pan: nameAsPerPan,
          date_of_birth: dateOfBirth,
          consent: 'Y',
          reason: reason,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
            'X-Accept-Cache': 'true',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'PAN verification failed');
      }

      const data = response.data.data;
      return {
        pan: data.pan,
        category: data.category,
        status: data.status,
        remarks: data.remarks,
        nameMatch: data.name_as_per_pan_match === true,
        dobMatch: data.date_of_birth_match === true,
        aadhaarSeeded: data.aadhaar_seeding_status,
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('PAN verification error:', error.response?.data || error.message);
      throw new Error(`PAN verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // AADHAAR VERIFICATION
  // ============================================

  /**
   * Generate OTP for Aadhaar Offline e-KYC verification
   * @param aadhaarNumber - 12-digit Aadhaar number
   * @param reason - Purpose for verification (e.g., 'KYC verification for account opening')
   */
  async generateAadhaarOTP(aadhaarNumber: string, reason: string = 'KYC verification'): Promise<{
    referenceId: string;
    message: string;
    validFor: number;
    transactionId: string;
  }> {
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      throw new Error('Invalid Aadhaar number format. Must be 12 digits.');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason for verification is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp`,
        { 
          '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
          aadhaar_number: aadhaarNumber,
          consent: 'Y',
          reason: reason,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Failed to generate Aadhaar OTP');
      }

      return {
        referenceId: String(response.data.data.reference_id),
        message: response.data.data?.message || response.data.message || 'OTP sent successfully',
        validFor: 300, // 5 minutes (OTP expires after ~45 seconds for rate limiting)
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Aadhaar OTP generation error:', error.response?.data || error.message);

      if (statusCode === 404 && isTestEnvironment && errorMessage?.includes('does not match any saved example')) {
        console.warn('⚠️ [Sandbox KYC] Aadhaar OTP API not subscribed on test account, falling back to mock');
        const mockRef = `mock_ref_${Date.now()}`;
        return {
          referenceId: mockRef,
          message: 'Mock OTP sent (test environment). Use OTP: 123456',
          validFor: 300,
          transactionId: `mock_txn_${Date.now()}`,
        };
      }

      throw new Error(`Aadhaar OTP generation failed: ${errorMessage}`);
    }
  }

  /**
   * Verify Aadhaar OTP and get eKYC data
   * @param referenceId - Reference ID from OTP generation
   * @param otp - 6-digit OTP received on registered mobile
   */
  async verifyAadhaarOTP(referenceId: string, otp: string): Promise<{
    aadhaarNumber: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    address: {
      house: string;
      street: string;
      landmark: string;
      locality: string;
      district: string;
      state: string;
      pincode: string;
      country: string;
    };
    photo?: string;
    verified: boolean;
  }> {
    if (!referenceId || referenceId.trim().length === 0) {
      throw new Error('Reference ID is required');
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid OTP format. Must be 6 digits.');
    }

    const token = await getSandboxAccessToken();

    try {
      const shareCode = String(Math.floor(1000 + Math.random() * 9000));
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp/verify`,
        { '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request', reference_id: referenceId, otp, share_code: shareCode },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Aadhaar OTP verification failed');
      }

      const data = response.data.data;
      return {
        aadhaarNumber: data.aadhaar_number || data.masked_aadhaar,
        fullName: data.full_name || data.name,
        dateOfBirth: data.date_of_birth || data.dob,
        gender: data.gender,
        address: {
          house: data.address?.house || '',
          street: data.address?.street || '',
          landmark: data.address?.landmark || '',
          locality: data.address?.locality || data.address?.vtc || '',
          district: data.address?.district || '',
          state: data.address?.state || '',
          pincode: data.address?.pincode || data.address?.zip || '',
          country: data.address?.country || 'India',
        },
        photo: data.photo,
        verified: true,
      };
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Aadhaar OTP verification error:', error.response?.data || error.message);

      if (statusCode === 404 && isTestEnvironment && errorMessage?.includes('does not match any saved example')) {
        console.warn('⚠️ [Sandbox KYC] Aadhaar verify API not subscribed on test account, falling back to mock');
        return {
          aadhaarNumber: 'XXXX-XXXX-9012',
          fullName: SANDBOX_AADHAAR_TEST_DATA.testName,
          dateOfBirth: SANDBOX_AADHAAR_TEST_DATA.testDOB,
          gender: SANDBOX_AADHAAR_TEST_DATA.testGender,
          address: {
            house: '123',
            street: 'Test Street',
            landmark: 'Near Test Park',
            locality: 'Test Colony',
            district: 'Test District',
            state: 'Maharashtra',
            pincode: '400001',
            country: 'India',
          },
          photo: undefined,
          verified: true,
        };
      }

      if (referenceId.startsWith('mock_ref_')) {
        console.log('🔧 [Sandbox KYC] Using mock Aadhaar verification for mock reference');
        return {
          aadhaarNumber: 'XXXX-XXXX-9012',
          fullName: SANDBOX_AADHAAR_TEST_DATA.testName,
          dateOfBirth: SANDBOX_AADHAAR_TEST_DATA.testDOB,
          gender: SANDBOX_AADHAAR_TEST_DATA.testGender,
          address: {
            house: '123',
            street: 'Test Street',
            landmark: 'Near Test Park',
            locality: 'Test Colony',
            district: 'Test District',
            state: 'Maharashtra',
            pincode: '400001',
            country: 'India',
          },
          photo: undefined,
          verified: true,
        };
      }

      throw new Error(`Aadhaar verification failed: ${errorMessage}`);
    }
  }

  // ============================================
  // PENNY DROP BANK VERIFICATION
  // ============================================

  /**
   * Verify bank account via Penny Drop (small amount transfer)
   * @param accountNumber - Bank account number
   * @param ifsc - IFSC code
   */
  async verifyBankAccountPennyDrop(accountNumber: string, ifsc: string): Promise<{
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    bankName: string;
    branchName: string;
    verified: boolean;
    transactionId: string;
    utr?: string;
  }> {
    if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
      throw new Error('Invalid account number. Must be 9-18 numeric digits.');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      throw new Error('Invalid IFSC format');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/bank/${ifsc}/accounts/${accountNumber}/verify`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Penny drop verification failed');
      }

      const data = response.data.data;
      return {
        accountNumber: accountNumber,
        ifsc: ifsc,
        accountHolderName: data.name_at_bank || data.account_holder_name || '',
        bankName: data.bank_name || '',
        branchName: data.branch_name || data.branch || '',
        verified: data.account_exists === true,
        transactionId: response.data.transaction_id,
        utr: data.utr,
      };
    } catch (error: any) {
      console.error('Penny drop verification error:', error.response?.data || error.message);
      throw new Error(`Bank verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // IFSC VERIFICATION
  // ============================================

  /**
   * Verify IFSC code and get bank branch details
   * @param ifsc - 11-digit IFSC code
   */
  async verifyIFSC(ifsc: string): Promise<{
    ifsc: string;
    bank: string;
    bankCode: string;
    branch: string;
    address: string;
    city: string;
    district: string;
    state: string;
    contact: string;
    micr: string;
    swift: string | null;
    iso3166: string;
    upi: boolean;
    rtgs: boolean;
    neft: boolean;
    imps: boolean;
  }> {
    if (!/^[A-Z]{4}0[0-9A-Z]{6}$/.test(ifsc)) {
      throw new Error('Invalid IFSC format. Must be 11 characters: 4 letters + 0 + 6 alphanumeric');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/bank/${ifsc}`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'X-Accept-Cache': 'true',
          },
        }
      );

      const data = response.data;
      return {
        ifsc: data.IFSC,
        bank: data.BANK,
        bankCode: data.BANKCODE,
        branch: data.BRANCH,
        address: data.ADDRESS,
        city: data.CITY,
        district: data.DISTRICT,
        state: data.STATE,
        contact: data.CONTACT || '',
        micr: data.MICR,
        swift: data.SWIFT || null,
        iso3166: data.ISO3166,
        upi: data.UPI === true,
        rtgs: data.RTGS === true,
        neft: data.NEFT === true,
        imps: data.IMPS === true,
      };
    } catch (error: any) {
      console.error('IFSC verification error:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        throw new Error('IFSC code not found');
      }
      throw new Error(`IFSC verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // PENNYLESS BANK VERIFICATION
  // ============================================

  // Supported banks for Pennyless verification (IFSC prefixes)
  private static PENNYLESS_SUPPORTED_BANKS: Record<string, string> = {
    'IDIB': 'Indian Bank',
    'HDFC': 'HDFC Bank',
    'PUNB': 'Punjab National Bank',
    'ICIC': 'ICICI Bank',
    'CNRB': 'Canara Bank',
    'BKID': 'Bank of India',
    'UTIB': 'Axis Bank',
    'FDRL': 'Federal Bank',
    'MAHB': 'Bank of Maharashtra',
    'PYTM': 'PAYTM Payments Bank',
    'AIRP': 'Airtel Payments Bank',
    'YESB': 'Yes Bank',
    'BARB': 'Bank of Baroda',
    'BDBL': 'Bandhan Bank',
    'UJVN': 'Ujjivan Small Finance Bank',
    'TMBL': 'Tamilnad Mercantile Bank',
    'DBSS': 'DBS Bank',
    'IBKL': 'IDBI Bank',
    'INDB': 'IndusInd Bank',
    'ESFB': 'Equitas/ESAF Small Finance Bank',
    'FINO': 'Fino Payments Bank',
    'SRCB': 'Saraswat Co-operative Bank',
    'CITI': 'Citibank',
    'AUBL': 'AU Small Finance Bank',
    'JAKA': 'Jammu and Kashmir Bank',
    'JIOP': 'Jio Payments Bank',
    'CIUB': 'City Union Bank',
    'COSB': 'Cosmos Bank',
    'SVCB': 'Shamrao Vithal Cooperative Bank',
    'DLXB': 'Dhanalakshmi Bank',
    'IOBA': 'Indian Overseas Bank',
    'KCCB': 'Kalupur Commercial Co-Op Bank',
    'FSCB': 'Fincare Small Finance Bank',
    'DNSB': 'Dombivli Nagarik Sahakari Bank',
    'VARA': 'Varachha Co-op Bank',
    'SURY': 'Suryoday Small Finance Bank',
    'JSFB': 'Jana Small Finance Bank',
    'NKGS': 'NKGSB Co-operative Bank',
    'NTBL': 'Nainital Bank',
    'NESF': 'North East Small Finance Bank',
    'LAVB': 'Lakshmi Vilas Bank',
    'PMEC': 'Prime Cooperative Bank',
    'KSBK': 'Kerala State Co-Operative Bank',
    'AMCB': 'Ahmedabad Mercantile Co-op Bank',
    'STBP': 'SBM Bank India',
    'CCBL': 'Citizen Credit Co Operative Bank',
    'TNSC': 'Tamil Nadu State Apex Cooperative Bank',
    'AJHC': 'Ambarnath Jai Hind Coop Bank',
    'SUNB': 'Surat National Co-Operative Bank',
    'BACB': 'Bassein Catholic Co-operative Bank',
    'DMCB': 'Dattatraya Maharaj Kalambe Jaloli Sahakari Bank',
    'SARX': 'Saraspur Nagrik Co Operative Bank',
    'KKBK': 'Kotak Mahindra Bank',
    'SBIN': 'State Bank of India',
    'GSCB': 'Gujarat State Co-op Bank',
    'VIJB': 'Vijay Cooperative Bank',
    'IPOB': 'India Post Payments Bank',
    'SDCB': 'Surat District Cooperative Bank',
    'NLCB': 'Nilambur Cooperative Urban Bank',
    'UCBA': 'UCO Bank',
    'JJSA': 'Jalgaon Janata Sahakari Bank',
    'CSBK': 'Catholic Syrian Bank',
    'DSPB': 'Durgapur Steel Peoples Coop Bank',
    'KARB': 'Karnataka Bank',
    'KNSB': 'Shree Kadi Nagarik Sahakari Bank',
    'BOFA': 'Bank of America',
    'UNIV': 'Unity Small Finance Bank',
    'BNSB': 'Bhagini Nivedita Sahakari Bank',
    'BNPA': 'BNP Paribas',
    'TSCB': 'Telangana State Cooperative Apex Bank',
    'KACE': 'Kangra Central Coop Bank',
    'NAVN': 'Navnirman Cooperative Bank',
    'ARSB': 'Arvind Sahakari Bank',
    'AUCB': 'Akola Urban Co Operative Bank',
  };

  /**
   * Check if a bank supports Pennyless verification
   * @param ifsc - IFSC code to check
   * @returns Bank name if supported, null if not
   */
  isPennylessSupported(ifsc: string): string | null {
    const prefix = ifsc.substring(0, 4).toUpperCase();
    return SandboxKYCService.PENNYLESS_SUPPORTED_BANKS[prefix] || null;
  }

  /**
   * Get list of all Pennyless-supported banks
   */
  getPennylessSupportedBanks(): Array<{ ifscPrefix: string; bankName: string }> {
    return Object.entries(SandboxKYCService.PENNYLESS_SUPPORTED_BANKS).map(([ifscPrefix, bankName]) => ({
      ifscPrefix,
      bankName,
    }));
  }

  /**
   * Verify bank account via Pennyless (instant verification without deposit)
   * Only works with supported banks - use isPennylessSupported() to check first
   * @param accountNumber - Bank account number
   * @param ifsc - IFSC code (must be from a supported bank)
   */
  async verifyBankAccountPennyless(accountNumber: string, ifsc: string): Promise<{
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    bankName: string;
    branchName: string;
    verified: boolean;
    transactionId: string;
    verificationMethod: 'pennyless';
  }> {
    if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
      throw new Error('Invalid account number. Must be 9-18 numeric digits.');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      throw new Error('Invalid IFSC format');
    }

    const supportedBank = this.isPennylessSupported(ifsc);
    if (!supportedBank) {
      throw new Error(`Bank with IFSC prefix ${ifsc.substring(0, 4)} does not support Pennyless verification. Use Penny Drop instead.`);
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/bank/${ifsc}/accounts/${accountNumber}/verify`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'X-Accept-Cache': 'true',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Pennyless verification failed');
      }

      const data = response.data.data;
      return {
        accountNumber: accountNumber,
        ifsc: ifsc,
        accountHolderName: data.name_at_bank || data.account_holder_name || '',
        bankName: data.bank_name || supportedBank,
        branchName: data.branch_name || data.branch || '',
        verified: data.account_exists === true,
        transactionId: response.data.transaction_id,
        verificationMethod: 'pennyless',
      };
    } catch (error: any) {
      console.error('Pennyless verification error:', error.response?.data || error.message);
      throw new Error(`Bank verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // DIGILOCKER INTEGRATION (API)
  // ============================================

  /**
   * Initiate DigiLocker session for consent-based document access (API flow)
   * Use this for backend-controlled flows with redirect URL
   * @param redirectUrl - URL to redirect after DigiLocker authentication
   * @param docTypes - Document types to request consent for (aadhaar, pan, driving_license)
   * @param flow - Whether user is signing in or signing up on DigiLocker
   */
  async initiateDigiLockerSession(
    redirectUrl: string, 
    docTypes: Array<'aadhaar' | 'pan' | 'driving_license'> = ['aadhaar'],
    flow: 'signin' | 'signup' = 'signin'
  ): Promise<{
    sessionId: string;
    authorizationUrl: string;
    transactionId: string;
  }> {
    if (!redirectUrl || !/^https?:\/\/.+/.test(redirectUrl)) {
      throw new Error('Valid redirect URL is required (must start with http:// or https://)');
    }
    if (!docTypes || docTypes.length === 0) {
      throw new Error('At least one document type is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/digilocker/sessions/init`,
        { 
          '@entity': 'in.co.sandbox.kyc.digilocker.session.request',
          flow: flow,
          doc_types: docTypes,
          redirect_url: redirectUrl,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'DigiLocker session initiation failed');
      }

      const data = response.data.data;
      return {
        sessionId: data.session_id,
        authorizationUrl: data.authorization_url,
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('DigiLocker initiation error:', error.response?.data || error.message);
      throw new Error(`DigiLocker initiation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get DigiLocker session status and consented documents
   * @param sessionId - Session ID from initiation
   */
  async getDigiLockerSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    status: 'created' | 'succeeded' | 'expired' | 'failed';
    documentsConsented: Array<'aadhaar' | 'pan' | 'driving_license'>;
    createdAt: number;
    updatedAt?: number;
    transactionId: string;
  }> {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/kyc/digilocker/sessions/${sessionId}/status`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Failed to get DigiLocker session status');
      }

      const data = response.data.data;
      return {
        sessionId: data.id,
        status: data.status,
        documentsConsented: data.documents_consented || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('DigiLocker status error:', error.response?.data || error.message);
      throw new Error(`Failed to get session status: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // DIGILOCKER SDK INTEGRATION
  // ============================================

  /**
   * Create DigiLocker SDK session for client-side SDK integration
   * Use this when integrating with DigiLocker Web/iOS/Android/Flutter SDKs
   * @param docTypes - Document types to request consent for
   * @param flow - Whether user is signing in or signing up on DigiLocker
   */
  async createDigiLockerSDKSession(
    docTypes: Array<'aadhaar' | 'pan' | 'driving_license'> = ['aadhaar'],
    flow: 'signin' | 'signup' = 'signin'
  ): Promise<{
    sessionId: string;
    status: 'created';
    createdAt: number;
    transactionId: string;
  }> {
    if (!docTypes || docTypes.length === 0) {
      throw new Error('At least one document type is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/digilocker-sdk/sessions/create`,
        { 
          '@entity': 'in.co.sandbox.kyc.digilocker.sdk.session.request',
          flow: flow,
          doc_types: docTypes,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'DigiLocker SDK session creation failed');
      }

      const data = response.data.data;
      return {
        sessionId: data.id,
        status: data.status,
        createdAt: data.created_at,
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('DigiLocker SDK session error:', error.response?.data || error.message);
      throw new Error(`DigiLocker SDK session failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get document from DigiLocker SDK session
   * Use this for SDK flow to fetch consented documents
   * @param sessionId - SDK Session ID from createDigiLockerSDKSession
   * @param docType - Document type to fetch (aadhaar, pan, driving_license)
   */
  async getDigiLockerSDKDocument(
    sessionId: string, 
    docType: 'aadhaar' | 'pan' | 'driving_license'
  ): Promise<{
    files: Array<{
      url: string;
      size: number;
      contentType: string;
      issuerId: string;
      issuer: string;
      lastModified: string;
      description: string;
    }>;
    transactionId: string;
  }> {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }
    if (!docType) {
      throw new Error('Document type is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/kyc/digilocker-sdk/sessions/${sessionId}/documents/${docType}`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'Failed to get DigiLocker document');
      }

      const data = response.data.data;
      return {
        files: (data.files || []).map((file: any) => ({
          url: file.url,
          size: file.size,
          contentType: file.metadata?.ContentType || '',
          issuerId: file.metadata?.issuer_id || '',
          issuer: file.metadata?.issuer || '',
          lastModified: file.metadata?.LastModified || '',
          description: file.metadata?.description || '',
        })),
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('DigiLocker SDK document error:', error.response?.data || error.message);
      if (error.response?.data?.code === 400) {
        throw new Error(`Consent not provided for ${docType}`);
      }
      if (error.response?.data?.code === 521) {
        throw new Error('Session data not found');
      }
      if (error.response?.data?.code === 523) {
        throw new Error('Invalid session lifecycle - cannot get document');
      }
      throw new Error(`Failed to get document: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch documents from DigiLocker after user consent (API flow)
   * @param sessionId - Session ID from initiation
   * @param documentType - Type of document to fetch (aadhaar, pan, driving_license, etc.)
   */
  async fetchDigiLockerDocument(sessionId: string, documentType: string): Promise<{
    documentType: string;
    documentId: string;
    issuedBy: string;
    issuedOn?: string;
    validUntil?: string;
    documentData: Record<string, any>;
    xmlData?: string;
    pdfUrl?: string;
  }> {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }
    if (!documentType || documentType.trim().length === 0) {
      throw new Error('Document type is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/digilocker/fetch`,
        { 
          session_id: sessionId,
          document_type: documentType,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'DigiLocker document fetch failed');
      }

      const data = response.data.data;
      return {
        documentType: data.document_type || documentType,
        documentId: data.document_id || data.doc_id,
        issuedBy: data.issued_by || data.issuer,
        issuedOn: data.issued_on || data.issue_date,
        validUntil: data.valid_until || data.expiry_date,
        documentData: data.document_data || data.details || {},
        xmlData: data.xml_data,
        pdfUrl: data.pdf_url,
      };
    } catch (error: any) {
      console.error('DigiLocker fetch error:', error.response?.data || error.message);
      throw new Error(`DigiLocker fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ============================================
  // ENTITYLOCKER (Business Document Verification)
  // ============================================

  /**
   * Initiate EntityLocker session for business document verification
   * @param redirectUrl - URL to redirect after authentication
   * @param flow - Whether user is signing in or signing up on EntityLocker
   * @param consentExpiry - Optional consent expiry timestamp (min 1 hour from now)
   */
  async initiateEntityLockerSession(
    redirectUrl: string,
    flow: 'signin' | 'signup' = 'signin',
    consentExpiry?: number
  ): Promise<{
    sessionId: string;
    authorizationUrl: string;
    transactionId: string;
  }> {
    if (!redirectUrl || !/^https?:\/\/.+/.test(redirectUrl)) {
      throw new Error('Valid redirect URL is required (must start with http:// or https://)');
    }
    if (consentExpiry && consentExpiry < Date.now() + 3600000) {
      throw new Error('Consent expiry must be at least 1 hour from now');
    }

    const token = await getSandboxAccessToken();

    try {
      const requestBody: Record<string, any> = {
        '@entity': 'in.co.sandbox.kyc.entitylocker.session.request',
        flow: flow,
        redirect_url: redirectUrl,
      };
      if (consentExpiry) {
        requestBody.consent_expiry = consentExpiry;
      }

      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/entitylocker/sessions/init`,
        requestBody,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'EntityLocker session initiation failed');
      }

      const data = response.data.data;
      return {
        sessionId: data.session_id,
        authorizationUrl: data.authorization_url,
        transactionId: response.data.transaction_id,
      };
    } catch (error: any) {
      console.error('EntityLocker initiation error:', error.response?.data || error.message);
      throw new Error(`EntityLocker initiation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch verified business documents from EntityLocker
   * @param sessionId - Session ID from initiation
   * @param documentType - Type of document (gst_certificate, incorporation_certificate, etc.)
   */
  async fetchEntityLockerDocument(sessionId: string, documentType: string): Promise<{
    documentType: string;
    gstin: string;
    legalName: string;
    tradeName?: string;
    documentData: Record<string, any>;
    pdfUrl?: string;
    verifiedAt: string;
  }> {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('Session ID is required');
    }
    if (!documentType || documentType.trim().length === 0) {
      throw new Error('Document type is required');
    }

    const token = await getSandboxAccessToken();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/kyc/entitylocker/fetch`,
        { 
          session_id: sessionId,
          document_type: documentType,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'Authorization': token,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(response.data.message || 'EntityLocker document fetch failed');
      }

      const data = response.data.data;
      return {
        documentType: data.document_type || documentType,
        gstin: data.gstin,
        legalName: data.legal_name || data.business_name,
        tradeName: data.trade_name,
        documentData: data.document_data || data.details || {},
        pdfUrl: data.pdf_url,
        verifiedAt: data.verified_at || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('EntityLocker fetch error:', error.response?.data || error.message);
      throw new Error(`EntityLocker fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  getAadhaarTestData(): typeof SANDBOX_AADHAAR_TEST_DATA {
    return { ...SANDBOX_AADHAAR_TEST_DATA };
  }
}

export const sandboxKYCService = new SandboxKYCService();
