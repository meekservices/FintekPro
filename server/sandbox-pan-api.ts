/**
 * Sandbox.co.in PAN Verification API Service
 * 
 * Handles PAN card verification via Sandbox.co.in API
 * Used for KYC Level 1 upgrade
 * 
 * Authentication: OAuth token-based (same as Sandbox KYC service)
 * Environment: Auto-detects test vs production based on API key prefix
 */

import axios, { AxiosError } from 'axios';
import { AppError } from './utils/errors';
import { kycEnvironmentService } from './services/kyc-environment-service';
import { getSandboxBaseUrl, getSandboxApiKey, getSandboxEnvironment, getSandboxAccessToken, clearSandboxToken, hasSandboxCredentials } from './utils/sandbox-config';

interface SandboxPANRequest {
  pan: string;
  consent: 'Y' | 'N';
  reason: string;
}

interface SandboxPANResponse {
  status: 'success' | 'failure';
  data?: {
    pan_number: string;
    full_name: string;
    category: string;
    status: 'VALID' | 'INVALID' | 'NOT_FOUND' | 'INOPERATIVE';
    last_updated: string;
    name_on_card?: string;
    father_name?: string;
    date_of_birth?: string;
    masked_aadhaar?: string;
    aadhaar_linked?: boolean;
    aadhaar_seeding_status?: 'LINKED' | 'NOT_LINKED' | 'PENDING' | 'FAILED';
  };
  message?: string;
  error?: string;
}

interface PANAadhaarLinkageResponse {
  status: 'success' | 'failure';
  data?: {
    pan_number: string;
    aadhaar_linked: boolean;
    linkage_status: 'LINKED' | 'NOT_LINKED' | 'PENDING' | 'FAILED';
    last_updated?: string;
  };
  message?: string;
  error?: string;
}

class SandboxPANService {
  private baseUrl: string;
  private apiKey: string;
  private isTestEnvironment: boolean;

  constructor() {
    this.baseUrl = getSandboxBaseUrl();
    this.apiKey = getSandboxApiKey();
    this.isTestEnvironment = getSandboxEnvironment() === 'TEST';

    if (!hasSandboxCredentials()) {
      console.warn('⚠️ [Sandbox PAN API] API credentials not configured. Mock mode will be used in sandbox environment only.');
    } else {
      const env = this.isTestEnvironment ? 'TEST' : 'PRODUCTION';
      console.log(`✅ [Sandbox PAN API] Initialized (${env} environment → ${this.baseUrl})`);
    }
  }

  private async authenticate(): Promise<string> {
    try {
      return await getSandboxAccessToken();
    } catch (error: any) {
      console.error('❌ [Sandbox PAN API] Authentication failed:', error.message);
      throw new AppError(
        'Sandbox API authentication failed. Please check API credentials.',
        401,
        'SANDBOX_AUTH_FAILED'
      );
    }
  }

  async verifyPAN(panNumber: string, fullName?: string, dateOfBirth?: string): Promise<SandboxPANResponse> {
    try {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber)) {
        throw new AppError('Invalid PAN format. PAN must be in format: ABCDE1234F', 400, 'INVALID_PAN_FORMAT');
      }

      if (!hasSandboxCredentials()) {
        if (kycEnvironmentService.isSandbox()) {
          console.log('🔧 [Sandbox PAN API] No credentials, using mock (sandbox mode)');
          return this.mockPANVerification(panNumber, fullName);
        }
        throw new AppError(
          'PAN verification service not configured. Please contact support.',
          503,
          'SANDBOX_NOT_CONFIGURED'
        );
      }

      let token: string;
      try {
        token = await this.authenticate();
      } catch (authError: any) {
        if (kycEnvironmentService.isSandbox()) {
          console.warn(`⚠️ [Sandbox PAN API] Auth failed (${authError.message}), falling back to mock (KYC sandbox mode)`);
          return this.mockPANVerification(panNumber, fullName);
        }
        throw authError;
      }

      let formattedDOB = dateOfBirth || '';
      if (formattedDOB && formattedDOB.includes('-') && formattedDOB.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = formattedDOB.split('-');
        formattedDOB = `${day}/${month}/${year}`;
      }

      // Sandbox.co.in rejects date_of_birth="" with "date_of_birth cannot be empty".
      // Only include the field when a real value is provided.
      const requestPayload: any = {
        '@entity': 'in.co.sandbox.kyc.pan_verification.request',
        pan: panNumber.toUpperCase(),
        name_as_per_pan: fullName || '',
        consent: 'Y',
        reason: 'KYC verification for financial services'
      };
      if (formattedDOB) {
        requestPayload.date_of_birth = formattedDOB;
      }

      const response = await axios.post<SandboxPANResponse>(
        `${this.baseUrl}/kyc/pan/verify`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'Authorization': token,
            'x-api-version': '1.0.0'
          },
          timeout: 30000
        }
      );

      const rawData: any = response.data;
      const responseData: any = rawData?.data || rawData;
      const resolvedData: any = responseData?.pan_number ? responseData : responseData?.data || responseData;

      // Log raw response fields to detect name field name variations across environments
      const nameFields = ['full_name','name','name_on_card','name_pan_card','first_name','last_name','holder_name'];
      const presentNameFields = nameFields.filter(f => resolvedData?.[f] != null && resolvedData[f] !== '');
      console.log(`[Sandbox PAN API] Response fields: ${Object.keys(resolvedData || {}).join(', ')} | Name fields present: ${presentNameFields.map(f => `${f}="${resolvedData[f]}"`).join(', ') || 'NONE'}`);

      // Resolve name from whichever field the API populated
      const resolvedName = resolvedData?.full_name || resolvedData?.name || resolvedData?.name_on_card
        || resolvedData?.name_pan_card
        || (resolvedData?.first_name && resolvedData?.last_name ? `${resolvedData.first_name} ${resolvedData.last_name}`.trim() : null)
        || resolvedData?.first_name || resolvedData?.holder_name || null;

      if (resolvedName && resolvedData) {
        resolvedData.full_name = resolvedName;
      }

      const normalizedResponse: SandboxPANResponse = {
        status: (rawData?.code === 200 || responseData?.status === 'VALID' || rawData?.status === 'success') ? 'success' : 'failure',
        data: resolvedData,
        message: rawData?.message,
      };

      if (normalizedResponse.status === 'success' && normalizedResponse.data) {
        console.log(`✅ [Sandbox PAN API] PAN verified successfully: ${this.maskPAN(panNumber)} name="${resolvedName || 'NOT_RETURNED'}" (${this.isTestEnvironment ? 'TEST' : 'LIVE'})`);
        return normalizedResponse;
      } else {
        console.error('❌ [Sandbox PAN API] PAN verification failed:', normalizedResponse.message || JSON.stringify(response.data).substring(0, 200));
        throw new AppError(
          normalizedResponse.message || 'PAN verification failed',
          400,
          'PAN_VERIFICATION_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;
        
        console.error('❌ [Sandbox PAN API] API Error:', {
          status: statusCode,
          message: errorMessage,
          pan: this.maskPAN(panNumber),
          environment: this.isTestEnvironment ? 'TEST' : 'LIVE'
        });

        if (statusCode === 404 && this.isTestEnvironment && errorMessage?.includes('does not match any saved example')) {
          console.warn('⚠️ [Sandbox PAN API] PAN API not subscribed on test account, falling back to mock verification');
          return this.mockPANVerification(panNumber, fullName);
        }

        if (statusCode === 401 || statusCode === 403 || (statusCode === 400 && errorMessage?.includes('Authorization'))) {
          clearSandboxToken();
          try {
            const retryToken = await this.authenticate();
            const retryResponse = await axios.post(
              `${this.baseUrl}/kyc/pan/verify`,
              { '@entity': 'in.co.sandbox.kyc.pan_verification.request', pan: panNumber.toUpperCase(), consent: 'Y', reason: 'KYC verification' },
              {
                headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'Authorization': retryToken, 'x-api-version': '1.0.0' },
                timeout: 30000
              }
            );
            const retryData = retryResponse.data?.data || retryResponse.data;
            return { status: 'success' as const, data: retryData?.pan_number ? retryData : retryData?.data || retryData };
          } catch (retryError) {
            console.error('❌ [Sandbox PAN API] Retry also failed:', retryError);
            if (kycEnvironmentService.isSandbox()) {
              console.warn('⚠️ [Sandbox PAN API] Auth retry failed, falling back to mock (KYC sandbox mode)');
              return this.mockPANVerification(panNumber, fullName);
            }
          }
          throw new AppError(
            'PAN verification authentication failed. API credentials may be invalid or expired.',
            401,
            'SANDBOX_AUTH_FAILED'
          );
        }

        // In KYC sandbox mode, any API error (400, 422, 5xx, etc.) should fall back to mock
        // rather than surfacing a hard error to the user — real-API failures are expected in dev
        if (kycEnvironmentService.isSandbox()) {
          console.warn(`⚠️ [Sandbox PAN API] API returned HTTP ${statusCode} ("${errorMessage}") in KYC sandbox mode — falling back to mock`);
          return this.mockPANVerification(panNumber, fullName);
        }

        throw new AppError(
          `PAN verification API error: ${errorMessage}`,
          statusCode || 500,
          'SANDBOX_API_ERROR'
        );
      }

      console.error('❌ [Sandbox PAN API] Unexpected error:', error);
      throw new AppError('Failed to verify PAN', 500, 'PAN_VERIFICATION_ERROR');
    }
  }

  private mockPANVerification(panNumber: string, fullName?: string): SandboxPANResponse {
    console.log('🔧 [Sandbox PAN API] Using MOCK PAN verification for:', this.maskPAN(panNumber));

    if (panNumber.startsWith('AAAAA')) {
      return {
        status: 'success',
        data: {
          pan_number: panNumber,
          full_name: fullName || 'Not Available',
          category: 'Individual',
          status: 'INVALID',
          last_updated: new Date().toISOString()
        }
      };
    }

    if (panNumber.startsWith('ZZZZZ')) {
      return {
        status: 'failure',
        message: 'PAN not found in database',
        error: 'PAN_NOT_FOUND'
      };
    }

    if (panNumber.startsWith('INOPER')) {
      return {
        status: 'success',
        data: {
          pan_number: panNumber,
          full_name: fullName || 'Inoperative User',
          category: 'Individual',
          status: 'INOPERATIVE',
          last_updated: new Date().toISOString(),
          aadhaar_linked: false,
          aadhaar_seeding_status: 'NOT_LINKED'
        },
        message: 'PAN is inoperative due to non-linkage with Aadhaar'
      };
    }

    return {
      status: 'success',
      data: {
        pan_number: panNumber,
        full_name: fullName || 'Demo User (Sandbox)',
        category: 'Individual',
        status: 'VALID',
        last_updated: new Date().toISOString(),
        name_on_card: fullName || 'DEMO USER (SANDBOX)',
        father_name: 'DEMO FATHER (SANDBOX)',
        date_of_birth: '01/01/1990',
        masked_aadhaar: 'XXXX-XXXX-1234'
      }
    };
  }

  async validatePANWithDOB(panNumber: string, dateOfBirth: string): Promise<boolean> {
    try {
      const response = await this.verifyPAN(panNumber);
      
      if (response.status === 'success' && response.data) {
        if (response.data.date_of_birth) {
          const responseDOB = response.data.date_of_birth.replace(/\//g, '-');
          const providedDOB = dateOfBirth.replace(/\//g, '-');
          return responseDOB === providedDOB;
        }
        return response.data.status === 'VALID';
      }
      
      return false;
    } catch (error) {
      console.error('❌ [Sandbox PAN API] DOB validation failed:', error);
      return false;
    }
  }

  async checkPANAadhaarLinkage(panNumber: string): Promise<PANAadhaarLinkageResponse> {
    try {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber)) {
        throw new AppError('Invalid PAN format', 400, 'INVALID_PAN_FORMAT');
      }

      if (!hasSandboxCredentials()) {
        if (kycEnvironmentService.isSandbox()) {
          return this.mockPANAadhaarLinkage(panNumber);
        }
        throw new AppError('PAN-Aadhaar linkage service not configured', 503, 'SANDBOX_NOT_CONFIGURED');
      }

      let token: string;
      try {
        token = await this.authenticate();
      } catch (authError: any) {
        if (kycEnvironmentService.isSandbox()) {
          console.warn(`⚠️ [Sandbox PAN API] Auth failed for linkage check (${authError.message}), falling back to mock (KYC sandbox mode)`);
          return this.mockPANAadhaarLinkage(panNumber);
        }
        throw authError;
      }

      const response = await axios.post<PANAadhaarLinkageResponse>(
        `${this.baseUrl}/kyc/pan/aadhaar-link-status`,
        {
          '@entity': 'in.co.sandbox.kyc.pan.aadhaar_link_status',
          pan: panNumber.toUpperCase(),
          consent: 'Y',
          reason: 'PAN-Aadhaar linkage check'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'Authorization': token,
            'x-api-version': '1.0.0'
          },
          timeout: 30000
        }
      );

      const linkageRaw: any = response.data;
      const linkageData = linkageRaw?.data || linkageRaw;
      console.log(`✅ [Sandbox PAN API] PAN-Aadhaar linkage checked: ${this.maskPAN(panNumber)} (${this.isTestEnvironment ? 'TEST' : 'LIVE'})`);
      return { status: 'success' as const, data: linkageData as PANAadhaarLinkageResponse['data'] };
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const statusCode = axiosError.response?.status;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        console.error('❌ [Sandbox PAN API] Linkage check error:', { status: statusCode, message: errorMessage });

        if (statusCode === 404 && this.isTestEnvironment && errorMessage?.includes('does not match any saved example')) {
          console.warn('⚠️ [Sandbox PAN API] PAN-Aadhaar linkage API not subscribed on test account, falling back to mock');
          return this.mockPANAadhaarLinkage(panNumber);
        }
        
        if (statusCode === 401 || statusCode === 403 || (statusCode === 400 && errorMessage?.includes('Authorization'))) {
          clearSandboxToken();
          if (kycEnvironmentService.isSandbox()) {
            console.warn('⚠️ [Sandbox PAN API] Linkage auth failed (401/403), falling back to mock (KYC sandbox mode)');
            return this.mockPANAadhaarLinkage(panNumber);
          }
          throw new AppError(
            'PAN-Aadhaar linkage check authentication failed.',
            401,
            'SANDBOX_AUTH_FAILED'
          );
        }

        if (kycEnvironmentService.isSandbox()) {
          console.warn(`⚠️ [Sandbox PAN API] Linkage check HTTP ${statusCode} ("${errorMessage}") in KYC sandbox mode — falling back to mock`);
          return this.mockPANAadhaarLinkage(panNumber);
        }

        throw new AppError(
          `PAN-Aadhaar linkage check failed: ${errorMessage}`,
          statusCode || 500,
          'SANDBOX_API_ERROR'
        );
      }

      console.error('❌ [Sandbox PAN API] Unexpected linkage check error:', error);
      throw new AppError('PAN-Aadhaar linkage check failed', 500, 'SANDBOX_API_ERROR');
    }
  }

  private mockPANAadhaarLinkage(panNumber: string): PANAadhaarLinkageResponse {
    console.log('🔧 [Sandbox PAN API] Using MOCK PAN-Aadhaar linkage for:', this.maskPAN(panNumber));

    if (panNumber.startsWith('UNLINK')) {
      return {
        status: 'success',
        data: {
          pan_number: panNumber,
          aadhaar_linked: false,
          linkage_status: 'NOT_LINKED',
          last_updated: new Date().toISOString()
        },
        message: 'PAN is not linked with Aadhaar'
      };
    }

    return {
      status: 'success',
      data: {
        pan_number: panNumber,
        aadhaar_linked: true,
        linkage_status: 'LINKED',
        last_updated: new Date().toISOString()
      }
    };
  }

  isPANInoperative(panStatus: string): boolean {
    return panStatus === 'INOPERATIVE';
  }

  async validatePANComprehensive(panNumber: string, fullName?: string, dateOfBirth?: string): Promise<{
    isValid: boolean;
    isOperative: boolean;
    isAadhaarLinked: boolean;
    panData?: SandboxPANResponse['data'];
    linkageData?: PANAadhaarLinkageResponse['data'];
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let panData: SandboxPANResponse['data'] | undefined;
    let linkageData: PANAadhaarLinkageResponse['data'] | undefined;

    try {
      const panResponse = await this.verifyPAN(panNumber, fullName, dateOfBirth);
      
      if (panResponse.status !== 'success' || !panResponse.data) {
        errors.push(panResponse.message || 'PAN verification failed');
        return { isValid: false, isOperative: false, isAadhaarLinked: false, errors, warnings };
      }

      panData = panResponse.data;

      if (this.isPANInoperative(panData.status)) {
        errors.push('PAN is inoperative. Please link your PAN with Aadhaar on the Income Tax portal.');
        return { isValid: false, isOperative: false, isAadhaarLinked: false, panData, errors, warnings };
      }

      try {
        const linkageResponse = await this.checkPANAadhaarLinkage(panNumber);
        linkageData = linkageResponse.data;

        if (!linkageData?.aadhaar_linked) {
          warnings.push('PAN is not linked with Aadhaar. You may proceed, but linking is recommended for compliance.');
        }
      } catch (linkageError) {
        console.warn('⚠️ [Sandbox PAN API] Linkage check failed, proceeding without linkage data:', linkageError);
        warnings.push('PAN-Aadhaar linkage status could not be verified. Please check on the Income Tax portal.');
      }

      return {
        isValid: panData.status === 'VALID',
        isOperative: !this.isPANInoperative(panData.status),
        isAadhaarLinked: linkageData?.aadhaar_linked ?? false,
        panData,
        linkageData,
        errors,
        warnings
      };
    } catch (error) {
      console.error('❌ [Sandbox PAN API] Comprehensive validation error:', error);
      if (error instanceof AppError) {
        errors.push(error.message);
      } else {
        errors.push('PAN validation service temporarily unavailable');
      }
      return { isValid: false, isOperative: false, isAadhaarLinked: false, errors, warnings };
    }
  }

  private maskPAN(pan: string): string {
    if (!pan || pan.length < 4) return 'XXXX';
    return `XXXXXX${pan.slice(-4)}`;
  }

  getEnvironmentInfo(): { baseUrl: string; isTest: boolean; hasCredentials: boolean } {
    return {
      baseUrl: this.baseUrl,
      isTest: this.isTestEnvironment,
      hasCredentials: hasSandboxCredentials(),
    };
  }
}

export const sandboxPANService = new SandboxPANService();
export type { SandboxPANResponse, SandboxPANRequest, PANAadhaarLinkageResponse };
