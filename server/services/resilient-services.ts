/**
 * Resilient Service Wrappers
 * Centralized resilient wrappers for all external API services
 */

import { createResilientClient, ResilienceProfiles } from '../utils/resilient-client';

// Import singleton service instances
import { cashfreeService } from '../cashfree-service';
import { bseService } from '../bse-service';
import { kfintechApi } from '../kfintech-api';
import * as geminiService from '../gemini-service';

/**
 * Resilient Cashfree Service (CRITICAL - Payment Gateway)
 * Wraps the singleton cashfreeService instance
 */
export const resilientCashfreeService = createResilientClient(cashfreeService, {
  serviceName: 'Cashfree Payment Gateway',
  ...ResilienceProfiles.CRITICAL,
});

/**
 * Resilient BSE Service (CRITICAL - Trading)
 * Wraps the singleton bseService instance
 */
export const resilientBseService = createResilientClient(bseService, {
  serviceName: 'BSE Star MFD',
  ...ResilienceProfiles.CRITICAL,
});

/**
 * Resilient KFintech Service (CRITICAL - Mutual Funds)
 * Wraps the singleton kfintechApi instance
 */
export const resilientKfintechService = createResilientClient(kfintechApi, {
  serviceName: 'KFintech',
  ...ResilienceProfiles.CRITICAL,
});

/**
 * Resilient Gemini Service (STANDARD - AI)
 * Wraps the gemini service functions
 */
export const resilientGeminiService = createResilientClient(geminiService, {
  serviceName: 'Gemini AI',
  ...ResilienceProfiles.STANDARD,
});

// Export all resilient services for use in routes
export {
  resilientCashfreeService as cashfree,
  resilientBseService as bse,
  resilientKfintechService as kfintech,
  resilientGeminiService as gemini,
};
