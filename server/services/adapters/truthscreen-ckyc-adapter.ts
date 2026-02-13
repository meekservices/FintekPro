/**
 * TruthScreen CKYC Provider Adapter
 * Uses AES-256-CBC encrypted payloads per TruthScreen API specification
 * Authentication: username header + password-based encryption
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';
import CryptoJS from 'crypto-js';

export class TruthScreenCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'truthscreen';
  readonly providerName = 'TruthScreen CKYC API';
  
  private username: string;
  private password: string;
  private baseUrl: string;
  
  constructor() {
    this.username = process.env.TRUTHSCREEN_USERNAME || '';
    this.password = process.env.TRUTHSCREEN_PASSWORD || '';
    this.baseUrl = process.env.TRUTHSCREEN_BASE_URL || 'https://www.truthscreen.com';
  }
  
  isConfigured(): boolean {
    return !!(this.username && this.password);
  }
  
  isInMockMode(): boolean {
    return !this.isConfigured();
  }
  
  private encrypt(payload: object): string {
    const jsonString = JSON.stringify(payload);
    const key = CryptoJS.enc.Utf8.parse(this.password.padEnd(32, '0').substring(0, 32));
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const ciphertextBase64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    const ivBase64 = iv.toString(CryptoJS.enc.Base64);
    
    return `${ciphertextBase64}:${ivBase64}`;
  }
  
  private decrypt(encryptedData: string): any {
    const [ciphertextBase64, ivBase64] = encryptedData.split(':');
    if (!ciphertextBase64 || !ivBase64) {
      throw new Error('Invalid encrypted data format from TruthScreen');
    }
    
    const key = CryptoJS.enc.Utf8.parse(this.password.padEnd(32, '0').substring(0, 32));
    const iv = CryptoJS.enc.Base64.parse(ivBase64);
    const ciphertext = CryptoJS.enc.Base64.parse(ciphertextBase64);
    
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });
    
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }
  
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'username': this.username
    };
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    try {
      if (this.isInMockMode()) {
        return this.mockVerification(request, startTime);
      }
      
      const axios = (await import('axios')).default;
      
      const payload = {
        docType: 'CKYC_STATUS',
        panNumber: request.panNumber.toUpperCase()
      };
      
      const encryptedPayload = this.encrypt(payload);
      
      const response = await axios.post(
        `${this.baseUrl}/Ckyc/api/ckyc-status`,
        { requestData: encryptedPayload },
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      );
      
      const responseTimeMs = Date.now() - startTime;
      
      let decryptedResponse: any;
      try {
        decryptedResponse = response.data?.responseData 
          ? this.decrypt(response.data.responseData)
          : response.data;
      } catch (decryptErr) {
        console.warn('[TruthScreen CKYC] Failed to decrypt response, using raw:', decryptErr);
        decryptedResponse = response.data;
      }
      
      if (decryptedResponse?.ckycNumber || decryptedResponse?.cKYCId || decryptedResponse?.kin) {
        const kin = decryptedResponse.ckycNumber || decryptedResponse.cKYCId || decryptedResponse.kin;
        const isValidated = decryptedResponse.kycFlag === 'VALIDATED' || 
                           decryptedResponse.status === 'KYC_VALIDATED' ||
                           decryptedResponse.isKycValidated === true;
        
        return {
          success: true,
          found: true,
          provider: this.providerCode,
          kin,
          status: isValidated ? 'active' : 'pending',
          verificationLevel: 'normal',
          data: {
            fullName: decryptedResponse.full_name || decryptedResponse.name || request.fullName,
            fatherName: decryptedResponse.father_name,
            motherName: decryptedResponse.mother_name,
            dateOfBirth: decryptedResponse.dob || request.dateOfBirth,
            gender: decryptedResponse.gender || 'Unknown',
            address: {
              line1: decryptedResponse.address?.line1 || decryptedResponse.address || '',
              line2: decryptedResponse.address?.line2,
              city: decryptedResponse.address?.city || decryptedResponse.city || '',
              state: decryptedResponse.address?.state || decryptedResponse.state || '',
              pincode: decryptedResponse.address?.pincode || decryptedResponse.pincode || '',
              country: decryptedResponse.address?.country || 'India'
            },
            mobile: decryptedResponse.mobile,
            email: decryptedResponse.email,
            kycDate: decryptedResponse.kyc_date || decryptedResponse.ckycApplicationDate
          },
          responseTimeMs,
          message: 'CKYC record found via TruthScreen'
        };
      }
      
      if (decryptedResponse?.status === 'success' || decryptedResponse?.kraRecords) {
        const kraRecords = decryptedResponse.kraRecords || [];
        const validatedRecord = kraRecords.find((r: any) => 
          r.statusDescription?.toUpperCase().includes('VALIDATED') ||
          r.modifyStatus?.toUpperCase().includes('VALIDATED')
        );
        const isKycValidated = !!validatedRecord || 
          decryptedResponse.kycFlag === 'VALIDATED' ||
          decryptedResponse.status === 'KYC_VALIDATED';
        
        return {
          success: true,
          found: isKycValidated,
          provider: this.providerCode,
          kin: decryptedResponse.ckycNumber || decryptedResponse.cKYCId,
          status: isKycValidated ? 'active' : 'not_found',
          verificationLevel: 'normal',
          responseTimeMs,
          message: isKycValidated ? 'KYC is validated via TruthScreen' : 'KYC status retrieved but not validated'
        };
      }
      
      return {
        success: true,
        found: false,
        provider: this.providerCode,
        status: 'not_found',
        responseTimeMs,
        message: decryptedResponse?.message || decryptedResponse?.msg || 'CKYC record not found'
      };
      
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      
      console.error('[TruthScreen CKYC] Verification error:', error.message);
      if (error.response?.data) {
        try {
          const decryptedError = this.decrypt(error.response.data.responseData);
          console.error('[TruthScreen CKYC] Decrypted error:', JSON.stringify(decryptedError));
        } catch (e) {
          console.error('[TruthScreen CKYC] Raw error response:', JSON.stringify(error.response.data).substring(0, 500));
        }
      }
      
      if (error.response?.status === 404 || error.response?.status === 9) {
        return {
          success: true,
          found: false,
          provider: this.providerCode,
          status: 'not_found',
          responseTimeMs,
          message: 'CKYC record not found'
        };
      }
      
      return {
        success: false,
        found: false,
        provider: this.providerCode,
        responseTimeMs,
        message: error.message || 'TruthScreen API error',
        errorCode: error.response?.status?.toString() || 'UNKNOWN_ERROR'
      };
    }
  }
  
  async checkHealth(): Promise<CkycProviderHealth> {
    const startTime = Date.now();
    
    if (this.isInMockMode()) {
      return {
        provider: this.providerCode,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: 'Mock mode - no credentials configured'
      };
    }
    
    try {
      const axios = (await import('axios')).default;
      
      const testPayload = {
        docType: 2,
        docNumber: 'XXXXX0000X',
        transID: `health-${Date.now()}`
      };
      const encryptedPayload = this.encrypt(testPayload);
      
      await axios.post(
        `${this.baseUrl}/v1/apicall/nid/idsearch`,
        { requestData: encryptedPayload },
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );
      
      return {
        provider: this.providerCode,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error: any) {
      const isApiError = error.response?.status && error.response.status < 500;
      return {
        provider: this.providerCode,
        healthy: isApiError,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: isApiError ? 'API reachable (test PAN rejected as expected)' : error.message
      };
    }
  }
  
  private mockVerification(request: CkycVerificationRequest, startTime: number): CkycVerificationResult {
    const mockKin = `KIN${request.panNumber.substring(0, 5)}${Date.now().toString().slice(-6)}`;
    
    return {
      success: true,
      found: true,
      provider: this.providerCode,
      kin: mockKin,
      status: 'active',
      verificationLevel: 'normal',
      data: {
        fullName: request.fullName,
        dateOfBirth: request.dateOfBirth,
        gender: 'Unknown',
        address: {
          line1: 'Mock Address Line 1',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        mobile: request.mobileNumber,
        email: request.emailAddress
      },
      responseTimeMs: Date.now() - startTime,
      message: '[MOCK] CKYC record found via TruthScreen'
    };
  }
}
