/**
 * Protean (NSDL KRA) API Service
 * 
 * Production-grade service for checking KRA (KYC Registration Agency) status via Protean's NSDL KRA API.
 * Used in the mutual fund onboarding workflow to fast-track users who are already KRA-verified.
 * 
 * Workflow:
 * - PAN verified → Check KRA status (using PAN + DOB)
 * - If KRA Verified: Create BSE UCC → Ready to invest
 * - If KRA Not Verified: Initiate Cashfree eKYC flow
 * 
 * Supports async polling for pending verifications (1-48 hours wait time).
 */

import crypto from 'crypto';
import { logger } from './logger';

export interface ProteanKRAStatusRequest {
  panNumber: string;
  dateOfBirth: string; // YYYY-MM-DD format
  name?: string; // Optional for better matching
}

export interface ProteanKRAStatusResponse {
  success: boolean;
  status: 'verified' | 'on_hold' | 'rejected' | 'not_found' | 'pending' | 'error';
  kraNumber?: string; // KRA ID if verified
  kraAgency?: string; // Which KRA agency has the record (NSDL/CDSL/CAMS/KARVY/DOTEX)
  verificationDate?: string; // When KRA verification was completed
  reasonCode?: string; // Reason code for rejection/hold
  reasonMessage?: string; // Human-readable reason
  responsePayload?: any; // Full API response for debugging
  proteanReferenceId?: string; // Protean transaction reference
  message: string;
}

export class ProteanKRAService {
  private readonly baseUrl = process.env.PROTEAN_KRA_API_URL || 'https://api.protean-tech.com/kra/v1';
  private readonly apiKey = process.env.PROTEAN_KRA_API_KEY || '';
  private readonly apiSecret = process.env.PROTEAN_KRA_API_SECRET || '';
  private readonly timeout = 15000; // 15 second timeout

  /**
   * Check KRA status for a given PAN + DOB
   * Returns verification status and details
   */
  async checkKRAStatus(request: ProteanKRAStatusRequest): Promise<ProteanKRAStatusResponse> {
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info('[Protean KRA] Checking KRA status', {
      correlationId,
      pan: request.panNumber.slice(0, 3) + '***' + request.panNumber.slice(-2),
      dob: request.dateOfBirth,
    });

    try {
      // Generate HMAC signature for authentication
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(request.panNumber, timestamp);

      const response = await fetch(`${this.baseUrl}/kra/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify({
          pan: request.panNumber.toUpperCase(),
          dob: request.dateOfBirth,
          name: request.name,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 404) {
          logger.info('[Protean KRA] KRA record not found', {
            correlationId,
            responseTime,
          });

          return {
            success: true,
            status: 'not_found',
            message: 'No KRA record found for this PAN',
          };
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - check API credentials');
        }

        throw new Error(`Protean API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      logger.info('[Protean KRA] API response received', {
        correlationId,
        responseTime,
        status: data.status,
        kraAgency: data.kra_agency,
      });

      // Map Protean response to our normalized format
      const kraStatus = this.normalizeKRAStatus(data);

      return {
        success: true,
        status: kraStatus.status,
        kraNumber: data.kra_number || data.kyc_number,
        kraAgency: data.kra_agency || data.agency,
        verificationDate: data.verification_date || data.verified_at,
        reasonCode: data.reason_code,
        reasonMessage: data.reason || data.message,
        responsePayload: data,
        proteanReferenceId: data.reference_id || correlationId,
        message: kraStatus.message,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error('[Protean KRA] API call failed', {
        correlationId,
        error: error.message,
        responseTime,
      });

      // Check if it's a timeout
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return {
          success: false,
          status: 'error',
          message: 'Request timed out - Protean API is slow or unavailable',
        };
      }

      // Check if it's a network error
      if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
        return {
          success: false,
          status: 'error',
          message: 'Network error - cannot reach Protean API',
        };
      }

      return {
        success: false,
        status: 'error',
        message: `KRA check failed: ${error.message}`,
      };
    }
  }

  /**
   * Normalize Protean API status to our standard format
   */
  private normalizeKRAStatus(data: any): { status: ProteanKRAStatusResponse['status']; message: string } {
    const apiStatus = (data.status || data.kra_status || '').toLowerCase();

    // Map various API status values to our normalized statuses
    if (apiStatus === 'verified' || apiStatus === 'active' || apiStatus === 'registered' || apiStatus === 'approved') {
      return {
        status: 'verified',
        message: 'KRA verification found - user can proceed to BSE UCC creation',
      };
    }

    if (apiStatus === 'on_hold' || apiStatus === 'hold' || apiStatus === 'pending_review' || apiStatus === 'under_review') {
      return {
        status: 'on_hold',
        message: 'KRA record exists but is on hold - manual review required',
      };
    }

    if (apiStatus === 'rejected' || apiStatus === 'declined' || apiStatus === 'invalid' || apiStatus === 'cancelled') {
      return {
        status: 'rejected',
        message: 'KRA verification was rejected - user needs fresh eKYC',
      };
    }

    if (apiStatus === 'pending' || apiStatus === 'processing' || apiStatus === 'submitted' || apiStatus === 'in_progress') {
      return {
        status: 'pending',
        message: 'KRA verification is pending - will poll for updates',
      };
    }

    if (apiStatus === 'not_found' || apiStatus === 'no_record' || !apiStatus) {
      return {
        status: 'not_found',
        message: 'No KRA record found - user needs eKYC',
      };
    }

    // Unknown status - treat as error
    logger.warn('[Protean KRA] Unknown KRA status received', {
      apiStatus,
      rawData: data,
    });

    return {
      status: 'error',
      message: `Unknown KRA status: ${apiStatus}`,
    };
  }

  /**
   * Generate HMAC signature for Protean API authentication
   */
  private generateSignature(panNumber: string, timestamp: string): string {
    const payload = `${panNumber}:${timestamp}:${this.apiKey}`;
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Validate Protean API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      logger.error('[Protean KRA] Credentials validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

// Export singleton instance
export const proteanKRAService = new ProteanKRAService();
