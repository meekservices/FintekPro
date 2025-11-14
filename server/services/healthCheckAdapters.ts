import type { CheckDefinition } from './healthMonitoring';
import { bseStarKYCService } from './bse-star-kyc-service';
import { cashfreeEkycService } from './cashfree-ekyc-service';
import { proteanKRAService } from './protean-kra-service';
import { sandboxKYCService } from './sandbox-kyc-service';

/**
 * Health Check Adapters for External APIs
 * Each adapter delegates to existing service clients
 * to reuse authentication, credentials, and configuration
 */

/**
 * BSE STAR API Health Check
 * Uses existing BSEStarKYCService to verify API connectivity
 */
export function createBseStarHealthCheck(): CheckDefinition {
  return {
    service: 'BSE_STAR',
    endpoint: 'https://bsestarmf.in',
    checkType: 'ping',
    enabled: true,
    checkFn: async () => {
      try {
        const startTime = Date.now();
        
        // Use test PAN to check BSE STAR connectivity
        // This validates credentials and API availability
        const result = await bseStarKYCService.verifyPAN('AAAPL1234C');
        
        const latencyMs = Date.now() - startTime;
        
        return {
          success: result.success,
          latencyMs,
          responseCode: result.success ? 200 : 500,
          error: result.success ? undefined : 'BSE STAR API verification failed',
        };
      } catch (error: any) {
        return {
          success: false,
          latencyMs: 5000,
          error: error.message || 'BSE STAR service error',
        };
      }
    },
  };
}

/**
 * Cashfree API Health Check
 * Uses existing CashfreeEkycService to verify API connectivity
 */
export function createCashfreeHealthCheck(): CheckDefinition {
  return {
    service: 'CASHFREE',
    endpoint: 'https://api.cashfree.com',
    checkType: 'auth',
    enabled: true,
    checkFn: async () => {
      try {
        const clientId = process.env.CASHFREE_CLIENT_ID || '';
        const clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
        
        if (!clientId || !clientSecret) {
          return {
            success: false,
            latencyMs: 0,
            error: 'Cashfree credentials not configured',
          };
        }

        const startTime = Date.now();
        
        // Use test Aadhaar number to check Cashfree connectivity
        // This validates credentials and API availability
        const result = await cashfreeEkycService.initSession({
          aadhaarNumber: '999999990019', // Test Aadhaar
          consent: false,
          consentIpAddress: '127.0.0.1',
          consentUserAgent: 'health-check',
        });
        
        const latencyMs = Date.now() - startTime;
        
        // Service is healthy if we get a response
        const success = result.status !== 'failed';
        
        return {
          success,
          latencyMs,
          responseCode: success ? 200 : 500,
          error: success ? undefined : result.message,
        };
      } catch (error: any) {
        return {
          success: false,
          latencyMs: 5000,
          error: error.message || 'Cashfree service error',
        };
      }
    },
  };
}

/**
 * Protean KRA API Health Check
 * Uses existing ProteanKRAService to verify API connectivity
 */
export function createProteanHealthCheck(): CheckDefinition {
  return {
    service: 'PROTEAN_KRA',
    endpoint: 'https://api.protean-tech.com',
    checkType: 'ping',
    enabled: true,
    checkFn: async () => {
      try {
        const startTime = Date.now();
        
        // Use test PAN + DOB to check Protean KRA connectivity
        // This validates credentials and API availability
        const result = await proteanKRAService.checkKRAStatus({
          panNumber: 'AAAPL1234C',
          dateOfBirth: '1990-01-01',
        });
        
        const latencyMs = Date.now() - startTime;
        
        // Service is healthy if we get a response (even if KRA not found)
        const success = result.success;
        
        return {
          success,
          latencyMs,
          responseCode: success ? 200 : 500,
          error: success ? undefined : result.message,
        };
      } catch (error: any) {
        return {
          success: false,
          latencyMs: 5000,
          error: error.message || 'Protean KRA service error',
        };
      }
    },
  };
}

/**
 * eMudhra eSign API Health Check
 * Lightweight ping - eMudhra API requires document-specific requests
 */
export function createEMudhraHealthCheck(): CheckDefinition {
  return {
    service: 'EMUDHRA',
    endpoint: 'https://api.emudhra.com',
    checkType: 'ping',
    enabled: false, // Disabled by default - requires document context
    checkFn: async () => {
      try {
        // eMudhra eSign API requires specific document signing requests
        // For now, just return healthy status
        // TODO: Implement proper health check when eMudhra service is ready
        return {
          success: true,
          latencyMs: 0,
          responseCode: 200,
        };
      } catch (error: any) {
        return {
          success: false,
          latencyMs: 0,
          error: error.message || 'eMudhra service error',
        };
      }
    },
  };
}

/**
 * Sandbox.co.in API Health Check
 * Uses existing SandboxKYCService to verify API connectivity
 */
export function createSandboxHealthCheck(): CheckDefinition {
  return {
    service: 'SANDBOX_KYC',
    endpoint: 'https://api.sandbox.co.in',
    checkType: 'auth',
    enabled: true,
    checkFn: async () => {
      try {
        const apiKey = process.env.SANDBOX_API_KEY || '';
        
        if (!apiKey) {
          return {
            success: false,
            latencyMs: 0,
            error: 'Sandbox API key not configured',
          };
        }

        const startTime = Date.now();
        
        // Use test PAN to check Sandbox connectivity
        // This validates credentials and API availability
        const result = await sandboxKYCService.verifyIndividualPAN(
          'AAAPL1234C',
          'Test User',
          '1990-01-01'
        );
        
        const latencyMs = Date.now() - startTime;
        
        // Service is healthy if we get a response
        const success = !!result;
        
        return {
          success,
          latencyMs,
          responseCode: success ? 200 : 500,
          error: success ? undefined : 'Sandbox API verification failed',
        };
      } catch (error: any) {
        return {
          success: false,
          latencyMs: 5000,
          error: error.message || 'Sandbox service error',
        };
      }
    },
  };
}

/**
 * Get all health check adapters
 */
export function getAllHealthCheckAdapters(): CheckDefinition[] {
  return [
    createBseStarHealthCheck(),
    createCashfreeHealthCheck(),
    createProteanHealthCheck(),
    createEMudhraHealthCheck(),
    createSandboxHealthCheck(),
  ];
}
