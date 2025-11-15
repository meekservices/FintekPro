/**
 * Vendor-Specific Health Check Thresholds
 * 
 * Defines latency bands for each third-party API vendor to determine health status:
 * - Healthy: Optimal response time
 * - Degraded: Slower than ideal but still functional
 * - Down: Unacceptably slow or error occurred
 */

export interface ThresholdProfile {
  healthyMs: number;    // Max latency for "healthy" status
  degradedMs: number;   // Max latency for "degraded" status (anything above is "down")
  treatErrorAsDown: boolean; // Whether errors automatically mean "down" status
}

export type ServiceIdentifier = 
  | 'BSE_STAR'
  | 'CASHFREE'
  | 'PROTEAN_KRA'
  | 'EMUDHRA'
  | 'SANDBOX_KYC';

/**
 * Vendor-specific threshold registry
 * Based on vendor SLA and production performance benchmarks
 */
export const VENDOR_THRESHOLDS: Record<ServiceIdentifier, ThresholdProfile> = {
  BSE_STAR: {
    healthyMs: 1200,
    degradedMs: 2500,
    treatErrorAsDown: true,
  },
  CASHFREE: {
    healthyMs: 200,
    degradedMs: 500,
    treatErrorAsDown: true,
  },
  PROTEAN_KRA: {
    healthyMs: 500,
    degradedMs: 1200,
    treatErrorAsDown: true,
  },
  EMUDHRA: {
    healthyMs: 800,
    degradedMs: 1500,
    treatErrorAsDown: true,
  },
  SANDBOX_KYC: {
    healthyMs: 1000,
    degradedMs: 2000,
    treatErrorAsDown: true,
  },
};

/**
 * Default threshold profile for vendors not in the registry
 * Conservative values to avoid false positives
 */
export const DEFAULT_THRESHOLD: ThresholdProfile = {
  healthyMs: 500,
  degradedMs: 2000,
  treatErrorAsDown: true,
};

/**
 * Get threshold profile for a given service
 */
export function getThresholdProfile(serviceId: ServiceIdentifier | string): ThresholdProfile {
  return VENDOR_THRESHOLDS[serviceId as ServiceIdentifier] || DEFAULT_THRESHOLD;
}
