/**
 * CAS (Consolidated Account Statement) Generator Service
 * 
 * Phase 1 Auto-Population Strategy:
 * - Triggers CAS PDF generation from CAMS/KFin via email-based API
 * - Supports both CAMS and KFin CAS providers
 * - Handles async PDF generation workflow (trigger → wait → download)
 * 
 * Workflow:
 * 1. Request CAS generation with PAN/email/date range
 * 2. CAS provider emails PDF to user
 * 3. System polls for status
 * 4. Downloads PDF when ready
 * 5. Passes to CAS Parser for JSON conversion
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from './logger';

const logger = createLogger({ service: 'cas-generator' });

export type CASProvider = 'CAMS' | 'KFin';
export type CASFormat = 'PDF' | 'EMAIL';
export type CASStatus = 'requested' | 'generating' | 'ready' | 'failed';

export interface CASGenerationRequest {
  provider: CASProvider;
  panNumber: string;
  email: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  password?: string; // Optional PDF password
}

export interface CASGenerationResponse {
  success: boolean;
  requestId: string;
  status: CASStatus;
  provider: CASProvider;
  message: string;
  estimatedTime?: number; // minutes
  pdfUrl?: string;
}

export interface CASStatusCheckResponse {
  requestId: string;
  status: CASStatus;
  pdfUrl?: string;
  pdfSize?: number; // bytes
  generatedAt?: Date;
  error?: string;
}

/**
 * CAMS CAS Generator Client
 * API Documentation: https://www.camsonline.com/InvestorServices/CAS.aspx
 */
class CAMSCASClient {
  private client: AxiosInstance;
  private apiKey: string;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.CAMS_ENVIRONMENT === 'production';
    this.apiKey = process.env.CAMS_API_KEY || 'demo_cams_key';

    this.client = axios.create({
      baseURL: this.isProduction
        ? 'https://api.camsonline.com/v1'
        : 'https://demo-api.camsonline.com/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });
  }

  /**
   * Request CAS generation from CAMS
   */
  async requestCAS(request: CASGenerationRequest): Promise<CASGenerationResponse> {
    try {
      logger.info('Requesting CAMS CAS generation', { 
        pan: request.panNumber.slice(0, 4) + '***',
        fromDate: request.fromDate,
        toDate: request.toDate 
      });

      if (!this.isProduction) {
        return this.getMockCAMSResponse(request);
      }

      const response = await this.client.post('/cas/generate', {
        pan: request.panNumber,
        email: request.email,
        fromDate: request.fromDate,
        toDate: request.toDate,
        format: 'PDF',
        password: request.password || request.panNumber.slice(-4),
        sendEmail: true
      });

      const data = response.data;

      return {
        success: data.status === 'success',
        requestId: data.requestId,
        status: this.mapCAMSStatus(data.casstatus),
        provider: 'CAMS',
        message: data.message || 'CAS generation requested successfully',
        estimatedTime: data.estimatedMinutes || 5
      };

    } catch (error: any) {
      logger.error('CAMS CAS generation failed', error);
      
      return {
        success: false,
        requestId: '',
        status: 'failed',
        provider: 'CAMS',
        message: `CAMS error: ${error.message}`
      };
    }
  }

  /**
   * Check status of CAS generation
   */
  async checkStatus(requestId: string): Promise<CASStatusCheckResponse> {
    try {
      if (!this.isProduction) {
        return this.getMockCAMSStatusCheck(requestId);
      }

      const response = await this.client.get(`/cas/status/${requestId}`);
      const data = response.data;

      return {
        requestId,
        status: this.mapCAMSStatus(data.status),
        pdfUrl: data.pdfUrl,
        pdfSize: data.fileSize,
        generatedAt: data.generatedAt ? new Date(data.generatedAt) : undefined,
        error: data.error
      };

    } catch (error: any) {
      logger.error('CAMS status check failed', error);
      
      return {
        requestId,
        status: 'failed',
        error: error.message
      };
    }
  }

  private mapCAMSStatus(status: string): CASStatus {
    const statusMap: Record<string, CASStatus> = {
      'REQUESTED': 'requested',
      'PROCESSING': 'generating',
      'COMPLETED': 'ready',
      'FAILED': 'failed',
      'ERROR': 'failed'
    };
    return statusMap[status?.toUpperCase()] || 'requested';
  }

  private getMockCAMSResponse(request: CASGenerationRequest): CASGenerationResponse {
    const mockRequestId = `CAMS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    return {
      success: true,
      requestId: mockRequestId,
      status: 'requested',
      provider: 'CAMS',
      message: 'CAS generation requested (Mock). PDF will be emailed in 2-5 minutes.',
      estimatedTime: 3
    };
  }

  private getMockCAMSStatusCheck(requestId: string): CASStatusCheckResponse {
    // Simulate progressive status: requested → generating → ready
    const timestamp = parseInt(requestId.split('_')[1]);
    const age = Date.now() - timestamp;
    
    let status: CASStatus;
    let pdfUrl: string | undefined;
    
    if (age < 30000) { // First 30 seconds
      status = 'requested';
    } else if (age < 120000) { // 30s - 2min
      status = 'generating';
    } else { // After 2 minutes
      status = 'ready';
      pdfUrl = `https://mock-cams-storage.s3.amazonaws.com/cas/${requestId}.pdf`;
    }

    return {
      requestId,
      status,
      pdfUrl,
      pdfSize: status === 'ready' ? 245680 : undefined,
      generatedAt: status === 'ready' ? new Date() : undefined
    };
  }
}

/**
 * KFin (Karvy) CAS Generator Client
 * API Documentation: https://www.kfintech.com/investor-services/cas
 */
class KFinCASClient {
  private client: AxiosInstance;
  private apiKey: string;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.KFIN_ENVIRONMENT === 'production';
    this.apiKey = process.env.KFIN_API_KEY || 'demo_kfin_key';

    this.client = axios.create({
      baseURL: this.isProduction
        ? 'https://api.kfintech.com/v1'
        : 'https://demo-api.kfintech.com/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Request CAS generation from KFin
   */
  async requestCAS(request: CASGenerationRequest): Promise<CASGenerationResponse> {
    try {
      logger.info('Requesting KFin CAS generation', { 
        pan: request.panNumber.slice(0, 4) + '***',
        fromDate: request.fromDate,
        toDate: request.toDate 
      });

      if (!this.isProduction) {
        return this.getMockKFinResponse(request);
      }

      const response = await this.client.post('/cas/request', {
        panNumber: request.panNumber,
        emailId: request.email,
        startDate: request.fromDate,
        endDate: request.toDate,
        outputFormat: 'PDF',
        pdfPassword: request.password || request.panNumber.slice(-4)
      });

      const data = response.data;

      return {
        success: data.success,
        requestId: data.referenceId,
        status: this.mapKFinStatus(data.processingStatus),
        provider: 'KFin',
        message: data.message || 'CAS generation initiated successfully',
        estimatedTime: data.estimatedWaitTime || 7
      };

    } catch (error: any) {
      logger.error('KFin CAS generation failed', error);
      
      return {
        success: false,
        requestId: '',
        status: 'failed',
        provider: 'KFin',
        message: `KFin error: ${error.message}`
      };
    }
  }

  /**
   * Check status of CAS generation
   */
  async checkStatus(requestId: string): Promise<CASStatusCheckResponse> {
    try {
      if (!this.isProduction) {
        return this.getMockKFinStatusCheck(requestId);
      }

      const response = await this.client.get(`/cas/status`, {
        params: { referenceId: requestId }
      });
      
      const data = response.data;

      return {
        requestId,
        status: this.mapKFinStatus(data.processingStatus),
        pdfUrl: data.downloadUrl,
        pdfSize: data.fileSizeBytes,
        generatedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        error: data.errorMessage
      };

    } catch (error: any) {
      logger.error('KFin status check failed', error);
      
      return {
        requestId,
        status: 'failed',
        error: error.message
      };
    }
  }

  private mapKFinStatus(status: string): CASStatus {
    const statusMap: Record<string, CASStatus> = {
      'INITIATED': 'requested',
      'IN_PROGRESS': 'generating',
      'COMPLETED': 'ready',
      'SUCCESS': 'ready',
      'FAILED': 'failed',
      'REJECTED': 'failed'
    };
    return statusMap[status?.toUpperCase()] || 'requested';
  }

  private getMockKFinResponse(request: CASGenerationRequest): CASGenerationResponse {
    const mockRequestId = `KFIN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    return {
      success: true,
      requestId: mockRequestId,
      status: 'requested',
      provider: 'KFin',
      message: 'CAS generation initiated (Mock). PDF will be available in 5-10 minutes.',
      estimatedTime: 7
    };
  }

  private getMockKFinStatusCheck(requestId: string): CASStatusCheckResponse {
    const timestamp = parseInt(requestId.split('_')[1]);
    const age = Date.now() - timestamp;
    
    let status: CASStatus;
    let pdfUrl: string | undefined;
    
    if (age < 60000) { // First minute
      status = 'requested';
    } else if (age < 180000) { // 1-3 minutes
      status = 'generating';
    } else { // After 3 minutes
      status = 'ready';
      pdfUrl = `https://mock-kfin-storage.s3.amazonaws.com/cas/${requestId}.pdf`;
    }

    return {
      requestId,
      status,
      pdfUrl,
      pdfSize: status === 'ready' ? 312450 : undefined,
      generatedAt: status === 'ready' ? new Date() : undefined
    };
  }
}

/**
 * Unified CAS Generator Service
 * Orchestrates CAS generation across CAMS and KFin providers
 */
export class CASGeneratorService {
  private camsClient: CAMSCASClient;
  private kfinClient: KFinCASClient;

  constructor() {
    this.camsClient = new CAMSCASClient();
    this.kfinClient = new KFinCASClient();
  }

  /**
   * Request CAS generation from specified provider
   */
  async requestCAS(request: CASGenerationRequest): Promise<CASGenerationResponse> {
    logger.info('CAS generation requested', { 
      provider: request.provider,
      pan: request.panNumber.slice(0, 4) + '***' 
    });

    switch (request.provider) {
      case 'CAMS':
        return this.camsClient.requestCAS(request);
      
      case 'KFin':
        return this.kfinClient.requestCAS(request);
      
      default:
        return {
          success: false,
          requestId: '',
          status: 'failed',
          provider: request.provider,
          message: `Unsupported CAS provider: ${request.provider}`
        };
    }
  }

  /**
   * Check CAS generation status
   */
  async checkStatus(provider: CASProvider, requestId: string): Promise<CASStatusCheckResponse> {
    logger.info('Checking CAS status', { provider, requestId });

    switch (provider) {
      case 'CAMS':
        return this.camsClient.checkStatus(requestId);
      
      case 'KFin':
        return this.kfinClient.checkStatus(requestId);
      
      default:
        return {
          requestId,
          status: 'failed',
          error: `Unsupported provider: ${provider}`
        };
    }
  }

  /**
   * Request CAS from both CAMS and KFin in parallel
   * Useful for comprehensive portfolio coverage
   */
  async requestCASFromAllProviders(
    panNumber: string,
    email: string,
    fromDate: string,
    toDate: string,
    password?: string
  ): Promise<CASGenerationResponse[]> {
    logger.info('Requesting CAS from all providers', { 
      pan: panNumber.slice(0, 4) + '***' 
    });

    const requests: CASGenerationRequest[] = [
      { provider: 'CAMS', panNumber, email, fromDate, toDate, password },
      { provider: 'KFin', panNumber, email, fromDate, toDate, password }
    ];

    const results = await Promise.allSettled(
      requests.map(req => this.requestCAS(req))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          requestId: '',
          status: 'failed' as CASStatus,
          provider: requests[index].provider,
          message: `Request failed: ${result.reason}`
        };
      }
    });
  }

  /**
   * Poll for CAS PDF availability with exponential backoff
   */
  async pollUntilReady(
    provider: CASProvider,
    requestId: string,
    maxAttempts: number = 20,
    initialDelayMs: number = 15000
  ): Promise<CASStatusCheckResponse> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxAttempts) {
      attempt++;
      
      logger.info('Polling CAS status', { 
        provider, 
        requestId, 
        attempt, 
        maxAttempts 
      });

      const status = await this.checkStatus(provider, requestId);

      if (status.status === 'ready') {
        logger.info('CAS ready for download', { provider, requestId, pdfUrl: status.pdfUrl });
        return status;
      }

      if (status.status === 'failed') {
        logger.error('CAS generation failed', { provider, requestId, error: status.error });
        return status;
      }

      // Wait before next attempt (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 120000); // Max 2 minutes between polls
    }

    logger.warn('CAS polling timeout', { provider, requestId });
    
    return {
      requestId,
      status: 'generating',
      error: 'Timeout: CAS generation taking longer than expected'
    };
  }
}

// Export singleton instance
export const casGeneratorService = new CASGeneratorService();
