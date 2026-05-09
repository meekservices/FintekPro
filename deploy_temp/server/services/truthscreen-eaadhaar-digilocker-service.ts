import axios from 'axios';

interface EAadhaarLinkResponse {
  success: boolean;
  message: string;
  digilockerUrl?: string;
  tsTransId?: string;
  transId?: string;
  rawResponse?: any;
}

interface EAadhaarStatusResponse {
  success: boolean;
  message: string;
  status?: 'pending' | 'completed' | 'failed' | 'expired';
  data?: {
    name?: string;
    dob?: string;
    gender?: string;
    address?: string;
    maskedAadhaar?: string;
    photoBase64?: string;
    uid?: string;
    fatherName?: string;
    house?: string;
    street?: string;
    landmark?: string;
    locality?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
    mobile?: string;
    email?: string;
  };
  rawResponse?: any;
}

class TruthScreenEAadhaarDigiLockerService {
  private username: string;
  private baseUrl: string;

  constructor() {
    this.username = process.env.TRUTHSCREEN_USERNAME || '';
    this.baseUrl = process.env.TRUTHSCREEN_BASE_URL || 'https://www.truthscreen.com';

    if (!this.username) {
      console.warn('⚠️ [TruthScreen E-Aadhaar DGL] No TRUTHSCREEN_USERNAME configured — mock mode');
    } else {
      console.log(`✅ [TruthScreen E-Aadhaar DGL] Initialized (${this.baseUrl})`);
    }
  }

  isConfigured(): boolean {
    return !!this.username;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'username': this.username
    };
  }

  private async encrypt(payload: object): Promise<string> {
    console.log(`[TruthScreen E-Aadhaar DGL] Step 1: Encrypting payload`);

    const response = await axios.post(
      `${this.baseUrl}/InstantSearch/encrypted_string`,
      payload,
      { headers: this.getHeaders(), timeout: 15000 }
    );

    const encrypted = response.data?.encryptedString || response.data?.encrypted_string || response.data?.requestData || response.data;

    if (!encrypted || typeof encrypted !== 'string') {
      console.error('[TruthScreen E-Aadhaar DGL] Encrypt response:', JSON.stringify(response.data).substring(0, 300));
      throw new Error('TruthScreen encryption did not return an encrypted string');
    }

    console.log(`[TruthScreen E-Aadhaar DGL] Step 1 complete (${encrypted.length} chars)`);
    return encrypted;
  }

  private async submitRequest(encryptedData: string): Promise<string> {
    console.log(`[TruthScreen E-Aadhaar DGL] Step 2: Submitting to /api/v1.0/eaadhaardigilocker/`);

    const response = await axios.post(
      `${this.baseUrl}/api/v1.0/eaadhaardigilocker/`,
      { requestData: encryptedData },
      { headers: this.getHeaders(), timeout: 30000 }
    );

    const encryptedResponse = response.data?.responseData || response.data?.response_data || response.data;

    if (!encryptedResponse) {
      console.error('[TruthScreen E-Aadhaar DGL] Submit response (raw):', JSON.stringify(response.data).substring(0, 300));
      throw new Error('TruthScreen E-Aadhaar DGL endpoint did not return response data');
    }

    if (typeof encryptedResponse === 'object') {
      console.log(`[TruthScreen E-Aadhaar DGL] Step 2 complete: Got unencrypted response object`);
      return JSON.stringify(encryptedResponse);
    }

    console.log(`[TruthScreen E-Aadhaar DGL] Step 2 complete (${encryptedResponse.length} chars)`);
    return encryptedResponse;
  }

  private async decrypt(encryptedData: string): Promise<any> {
    try {
      const parsed = JSON.parse(encryptedData);
      console.log(`[TruthScreen E-Aadhaar DGL] Response was already unencrypted JSON`);
      return parsed;
    } catch {
    }

    console.log(`[TruthScreen E-Aadhaar DGL] Step 3: Decrypting response`);

    const response = await axios.post(
      `${this.baseUrl}/InstantSearch/decrypt_encrypted_string`,
      { responseData: encryptedData },
      { headers: this.getHeaders(), timeout: 15000 }
    );

    console.log(`[TruthScreen E-Aadhaar DGL] Step 3 complete`);
    return response.data;
  }

  async generateDigiLockerLink(transId?: string): Promise<EAadhaarLinkResponse> {
    if (!this.isConfigured()) {
      return this.mockGenerateLink(transId);
    }

    try {
      const txnId = transId || `FTKP-DGL-${Date.now()}`;

      const encryptPayload = {
        trans_id: txnId,
        doc_type: '472',
        action: 'LINK'
      };

      console.log(`[TruthScreen E-Aadhaar DGL] Initiating DigiLocker link (trans_id: ${txnId})`);

      const encrypted = await this.encrypt(encryptPayload);
      const encryptedResponse = await this.submitRequest(encrypted);
      const decrypted = await this.decrypt(encryptedResponse);

      console.log(`[TruthScreen E-Aadhaar DGL] Link response keys: ${Object.keys(decrypted || {}).join(', ')}`);
      console.log(`[TruthScreen E-Aadhaar DGL] Link response snippet: ${JSON.stringify(decrypted).substring(0, 500)}`);

      const digilockerUrl = decrypted?.url || decrypted?.digilockerUrl || decrypted?.redirect_url || decrypted?.link;
      const tsTransId = decrypted?.ts_transid || decrypted?.tsTransId || decrypted?.ts_trans_id || decrypted?.transId;
      const status = (decrypted?.status || '').toString();
      const msg = decrypted?.msg || decrypted?.message || '';

      if (status === '0' || msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
        return {
          success: false,
          message: msg || 'Failed to generate DigiLocker link',
          rawResponse: decrypted
        };
      }

      return {
        success: true,
        message: 'DigiLocker link generated successfully. Redirect user to complete authentication.',
        digilockerUrl: digilockerUrl || undefined,
        tsTransId: tsTransId || txnId,
        transId: txnId,
        rawResponse: decrypted
      };

    } catch (error: any) {
      console.error(`[TruthScreen E-Aadhaar DGL] Link generation error:`, error.message);
      if (error.response?.data) {
        console.error('[TruthScreen E-Aadhaar DGL] Error response:', JSON.stringify(error.response.data).substring(0, 500));
      }
      return {
        success: false,
        message: error.message || 'Failed to generate DigiLocker link'
      };
    }
  }

  async checkStatus(tsTransId: string): Promise<EAadhaarStatusResponse> {
    if (!this.isConfigured()) {
      return this.mockCheckStatus(tsTransId);
    }

    try {
      const encryptPayload = {
        ts_trans_id: tsTransId,
        doc_type: '472',
        action: 'STATUS'
      };

      console.log(`[TruthScreen E-Aadhaar DGL] Checking status (ts_trans_id: ${tsTransId})`);

      const encrypted = await this.encrypt(encryptPayload);
      const encryptedResponse = await this.submitRequest(encrypted);
      const decrypted = await this.decrypt(encryptedResponse);

      console.log(`[TruthScreen E-Aadhaar DGL] Status response keys: ${Object.keys(decrypted || {}).join(', ')}`);
      console.log(`[TruthScreen E-Aadhaar DGL] Status response snippet: ${JSON.stringify(decrypted).substring(0, 500)}`);

      const status = (decrypted?.status || '').toString();
      const msg = decrypted?.msg || decrypted?.message || '';

      if (status === '0' || msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('not completed')) {
        return {
          success: true,
          message: msg || 'User has not completed DigiLocker authentication yet',
          status: 'pending',
          rawResponse: decrypted
        };
      }

      if (status === '-1' || msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('expired')) {
        return {
          success: false,
          message: msg || 'DigiLocker session failed or expired',
          status: 'failed',
          rawResponse: decrypted
        };
      }

      const eAadhaarData = this.extractEAadhaarData(decrypted);

      return {
        success: true,
        message: 'E-Aadhaar data retrieved successfully via DigiLocker',
        status: 'completed',
        data: eAadhaarData,
        rawResponse: decrypted
      };

    } catch (error: any) {
      console.error(`[TruthScreen E-Aadhaar DGL] Status check error:`, error.message);
      if (error.response?.data) {
        console.error('[TruthScreen E-Aadhaar DGL] Error response:', JSON.stringify(error.response.data).substring(0, 500));
      }
      return {
        success: false,
        message: error.message || 'Failed to check DigiLocker status',
        status: 'failed'
      };
    }
  }

  private extractEAadhaarData(data: any): EAadhaarStatusResponse['data'] {
    if (!data) return undefined;

    const d = data.result || data.data || data;

    return {
      name: d.name || d.full_name || d.fullName || '',
      dob: d.dob || d.date_of_birth || d.dateOfBirth || '',
      gender: d.gender || '',
      maskedAadhaar: d.maskedAadhaar || d.masked_aadhaar || d.uid || '',
      uid: d.uid || d.aadhaarNumber || d.aadhaar_number || '',
      fatherName: d.fatherName || d.father_name || d.careOf || d.co || '',
      house: d.house || d.building || '',
      street: d.street || d.streetName || '',
      landmark: d.landmark || d.lm || '',
      locality: d.locality || d.loc || d.vtc || '',
      district: d.district || d.dist || d.city || '',
      state: d.state || '',
      pincode: d.pincode || d.pc || d.zip || '',
      country: d.country || 'India',
      address: this.buildFullAddress(d),
      mobile: d.mobile || d.mobileNumber || '',
      email: d.email || '',
      photoBase64: d.photo || d.profileImage || d.photoBase64 || ''
    };
  }

  private buildFullAddress(d: any): string {
    const parts = [
      d.house || d.building,
      d.street || d.streetName,
      d.landmark || d.lm,
      d.locality || d.loc || d.vtc,
      d.district || d.dist || d.city,
      d.state,
      d.pincode || d.pc
    ].filter(Boolean);
    return parts.join(', ') || d.address || '';
  }

  private mockGenerateLink(transId?: string): EAadhaarLinkResponse {
    const txnId = transId || `FTKP-DGL-MOCK-${Date.now()}`;
    console.log(`🔧 [TruthScreen E-Aadhaar DGL] Mock: Generating DigiLocker link (${txnId})`);

    return {
      success: true,
      message: '[MOCK] DigiLocker link generated. In production, redirect user to the URL below.',
      digilockerUrl: `https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?mock=true&txn=${txnId}`,
      tsTransId: `TS-${txnId}`,
      transId: txnId
    };
  }

  private mockCheckStatus(tsTransId: string): EAadhaarStatusResponse {
    console.log(`🔧 [TruthScreen E-Aadhaar DGL] Mock: Checking status (${tsTransId})`);

    return {
      success: true,
      message: '[MOCK] E-Aadhaar data retrieved via DigiLocker',
      status: 'completed',
      data: {
        name: 'Demo User (Mock E-Aadhaar)',
        dob: '01/01/1990',
        gender: 'M',
        maskedAadhaar: 'XXXX XXXX 1234',
        uid: 'XXXXXXXXXXXX',
        fatherName: 'Demo Father',
        house: '123',
        street: 'Mock Street',
        landmark: 'Near Mock Plaza',
        locality: 'Mock Colony',
        district: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        address: '123, Mock Street, Near Mock Plaza, Mock Colony, Mumbai, Maharashtra, 400001',
        mobile: '9876543210',
        email: 'mock@example.com',
        photoBase64: ''
      }
    };
  }

  getServiceInfo() {
    return {
      provider: 'truthscreen',
      service: 'E-Aadhaar DigiLocker',
      docType: 472,
      configured: this.isConfigured(),
      baseUrl: this.baseUrl,
      flow: 'encrypt → submit → decrypt (3-step)',
      phases: ['LINK (generate DigiLocker URL)', 'STATUS (fetch E-Aadhaar after user auth)']
    };
  }
}

export const truthScreenEAadhaarDGLService = new TruthScreenEAadhaarDigiLockerService();
export type { EAadhaarLinkResponse, EAadhaarStatusResponse };
