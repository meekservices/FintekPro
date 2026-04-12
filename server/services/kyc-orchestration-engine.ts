import { db } from "../db";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  kycProviders,
  kycProviderPriority,
  kycFlowVersions,
  productConfigurations,
  platformAuditLogs,
  conversionFunnels,
  providerMetrics,
} from "@shared/schema";
import { CashfreePANService } from "./cashfree-pan-service";
import { CashfreeAadhaarService } from "./cashfree-aadhaar-service";
import { verifyBankAccountV2 } from "./cashfree-vrs-service";
import { sandboxKYCService } from "./sandbox-kyc-service";
import { TruthscreenAadhaarService } from "./truthscreen-aadhaar-service";
import { TruthScreenCkycAdapter } from "./adapters/truthscreen-ckyc-adapter";

interface VerificationRequest {
  userId: string;
  kycStep: string;
  productType: string;
  payload: Record<string, any>;
  sessionId?: string;
  ipAddress?: string;
}

interface VerificationResult {
  success: boolean;
  providerId: number;
  providerCode: string;
  data?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
  retryCount: number;
  fallbackChain: string[];
}

interface ProviderExecutionContext {
  provider: any;
  priority: any;
  retryCount: number;
  startTime: number;
}

class KycOrchestrationEngine {
  async executeVerification(request: VerificationRequest): Promise<VerificationResult> {
    console.log(`[KYC-ENGINE] Starting verification for step=${request.kycStep}, product=${request.productType}, user=${request.userId}`);
    const fallbackChain: string[] = [];
    const overallStartTime = Date.now();

    try {
      const priorities = await db
        .select()
        .from(kycProviderPriority)
        .where(
          and(
            eq(kycProviderPriority.kycStep, request.kycStep),
            eq(kycProviderPriority.isActive, true)
          )
        )
        .orderBy(asc(kycProviderPriority.priority));

      const filteredPriorities = priorities.filter((p) => {
        const scope = p.productScope as string[] | null;
        if (!scope || !Array.isArray(scope) || scope.length === 0) return true;
        return scope.includes(request.productType);
      });

      if (filteredPriorities.length === 0) {
        console.log(`[KYC-ENGINE] No providers configured for step=${request.kycStep}, product=${request.productType}`);
        return {
          success: false,
          providerId: 0,
          providerCode: "none",
          errorCode: "NO_PROVIDER_CONFIGURED",
          errorMessage: `No providers configured for step ${request.kycStep}`,
          latencyMs: 0,
          retryCount: 0,
          fallbackChain,
        };
      }

      for (const priorityEntry of filteredPriorities) {
        const [provider] = await db
          .select()
          .from(kycProviders)
          .where(eq(kycProviders.id, priorityEntry.providerId))
          .limit(1);

        if (!provider) {
          console.log(`[KYC-ENGINE] Provider id=${priorityEntry.providerId} not found, skipping`);
          continue;
        }

        fallbackChain.push(provider.providerCode);

        if (!provider.isEnabled || !provider.isConfigured) {
          console.log(`[KYC-ENGINE] Provider ${provider.providerCode} is not enabled/configured, skipping`);
          continue;
        }

        const context: ProviderExecutionContext = {
          provider,
          priority: priorityEntry,
          retryCount: 0,
          startTime: Date.now(),
        };

        const result = await this.executeProviderCall(context, request);
        result.fallbackChain = [...fallbackChain];

        if (result.success) {
          console.log(`[KYC-ENGINE] Verification succeeded via provider=${provider.providerCode}, latency=${result.latencyMs}ms`);
          await this.recordProviderMetric(provider.id, true, result.latencyMs);
          await this.logAuditEvent(
            "kyc_verification",
            "provider",
            String(provider.id),
            "verification_success",
            { kycStep: request.kycStep, providerCode: provider.providerCode, latencyMs: result.latencyMs },
            request.userId
          );
          return result;
        }

        await this.recordProviderMetric(provider.id, false, result.latencyMs, result.errorCode);

        // Fallback logic:
        // - If fallbackErrorCodes is null (not configured in DB) → always fall through to next provider
        // - If fallbackErrorCodes is an explicit array → only fall through for listed codes
        // - If fallbackErrorCodes is an explicit empty array → stop and return error immediately
        const fallbackErrorCodes = priorityEntry.fallbackErrorCodes as string[] | null;
        const shouldFallback = fallbackErrorCodes === null
          ? true
          : (result.errorCode ? fallbackErrorCodes.includes(result.errorCode) : false);

        if (shouldFallback) {
          console.log(`[KYC-ENGINE] Fallback triggered: provider=${provider.providerCode}, errorCode=${result.errorCode}, trying next provider`);
          await this.logAuditEvent(
            "kyc_fallback",
            "provider",
            String(provider.id),
            "fallback_triggered",
            {
              kycStep: request.kycStep,
              providerCode: provider.providerCode,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            },
            request.userId
          );
          continue;
        }

        console.log(`[KYC-ENGINE] Non-recoverable error from provider=${provider.providerCode}, errorCode=${result.errorCode} (fallback suppressed by config)`);
        return result;
      }

      console.log(`[KYC-ENGINE] All providers exhausted for step=${request.kycStep}, fallbackChain=${fallbackChain.join(" -> ")}`);
      return {
        success: false,
        providerId: 0,
        providerCode: "none",
        errorCode: "ALL_PROVIDERS_EXHAUSTED",
        errorMessage: `All providers exhausted for step ${request.kycStep}. Tried: ${fallbackChain.join(", ")}`,
        latencyMs: Date.now() - overallStartTime,
        retryCount: 0,
        fallbackChain,
      };
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Unexpected error during verification:`, error?.message || error);
      return {
        success: false,
        providerId: 0,
        providerCode: "none",
        errorCode: "INTERNAL_ERROR",
        errorMessage: error?.message || "Unexpected error during verification",
        latencyMs: Date.now() - overallStartTime,
        retryCount: 0,
        fallbackChain,
      };
    }
  }

  async executeProviderCall(
    context: ProviderExecutionContext,
    request: VerificationRequest
  ): Promise<VerificationResult> {
    const maxRetries = context.priority.maxRetries ?? 3;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[KYC-ENGINE] Retry attempt ${attempt}/${maxRetries} for provider=${context.provider.providerCode}, backoff=${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const callStart = Date.now();

      try {
        const result = await this.callProvider(context.provider.providerCode, request);
        const latencyMs = Date.now() - callStart;

        return {
          ...result,
          providerId: context.provider.id,
          providerCode: context.provider.providerCode,
          latencyMs,
          retryCount: attempt,
          fallbackChain: [],
        };
      } catch (error: any) {
        lastError = error;
        const latencyMs = Date.now() - callStart;
        console.log(`[KYC-ENGINE] Provider ${context.provider.providerCode} call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error?.message}`);

        if (attempt >= maxRetries) {
          return {
            success: false,
            providerId: context.provider.id,
            providerCode: context.provider.providerCode,
            errorCode: error?.code || "PROVIDER_ERROR",
            errorMessage: error?.message || "Provider call failed after retries",
            latencyMs,
            retryCount: attempt,
            fallbackChain: [],
          };
        }
      }
    }

    return {
      success: false,
      providerId: context.provider.id,
      providerCode: context.provider.providerCode,
      errorCode: lastError?.code || "PROVIDER_ERROR",
      errorMessage: lastError?.message || "Provider call failed",
      latencyMs: Date.now() - context.startTime,
      retryCount: maxRetries,
      fallbackChain: [],
    };
  }

  private async callProvider(
    providerCode: string,
    request: VerificationRequest
  ): Promise<{ success: boolean; data?: Record<string, any>; errorCode?: string; errorMessage?: string }> {
    const p = request.payload;

    switch (providerCode) {

      // ─── PAN VERIFICATION ────────────────────────────────────────────────

      case "sandbox_pan": {
        console.log(`[KYC-ENGINE] Calling Sandbox.co.in PAN verification`);
        const pan = (p.pan || '').toUpperCase();
        const name = p.name || '';
        // sandbox requires DD/MM/YYYY — convert from YYYY-MM-DD if needed
        let dob = p.dob || '01/01/1990';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
          const [y, m, d] = dob.split('-');
          dob = `${d}/${m}/${y}`;
        }
        if (!pan || !name) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'pan and name are required for sandbox_pan' };
        }
        try {
          const result = await sandboxKYCService.verifyPAN(pan, name, dob, p.reason || 'KYC verification');
          if (result.status === 'valid') {
            return {
              success: true,
              data: {
                verified: true,
                source: 'sandbox_pan',
                pan: result.pan,
                category: result.category,
                nameMatch: result.nameMatch,
                dobMatch: result.dobMatch,
                aadhaarSeeded: result.aadhaarSeeded,
                transactionId: result.transactionId,
              },
            };
          }
          return {
            success: false,
            errorCode: 'PAN_INVALID',
            errorMessage: result.remarks || 'PAN is invalid or not found in NSDL records',
          };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      case "cashfree_pan": {
        console.log(`[KYC-ENGINE] Calling Cashfree Secure ID PAN Lite verification`);
        const pan = (p.pan || '').toUpperCase();
        const name = p.name || '';
        if (!pan || !name) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'pan and name are required for cashfree_pan' };
        }
        if (!CashfreePANService.isConfigured()) {
          return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'Cashfree Secure ID credentials not set — add CASHFREE_SECUREID_APP_ID / CASHFREE_SECUREID_SECRET_KEY' };
        }
        try {
          const result = await CashfreePANService.verifyPAN(pan, name);
          if (result.verified) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'cashfree_pan',
                pan: result.data?.pan,
                type: result.data?.type,
                registeredName: result.data?.registeredName,
                nameMatchScore: result.data?.nameMatchScore,
                nameMatchResult: result.data?.nameMatchResult,
                panStatus: result.data?.panStatus,
                aadhaarSeedingStatus: result.data?.aadhaarSeedingStatus,
                verificationId: (result.data as any)?.verificationId,
              },
            };
          }
          return { success: false, errorCode: 'PAN_INVALID', errorMessage: result.message };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      case "truthscreen_pan": {
        console.log(`[KYC-ENGINE] Calling TruthScreen CKYC search for PAN verification`);
        const pan = (p.pan || '').toUpperCase();
        const name = p.name || '';
        if (!pan) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'pan is required for truthscreen_pan' };
        }
        const tsAdapter = new TruthScreenCkycAdapter();
        if (!tsAdapter.isConfigured()) {
          return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'TruthScreen credentials not set — add TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD' };
        }
        try {
          const result = await tsAdapter.verify({
            panNumber: pan,
            fullName: name,
            dateOfBirth: p.dob || '',
          });
          if (result.success && result.found) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'truthscreen_pan',
                kin: result.kin,
                kycStatus: result.status,
                fullName: result.data?.fullName,
                dateOfBirth: result.data?.dateOfBirth,
                provider: 'TruthScreen CKYC Registry',
              },
            };
          }
          if (result.success && !result.found) {
            return { success: false, errorCode: 'PAN_NOT_IN_CKYC', errorMessage: result.message || 'PAN not found in CKYC registry — try sandbox or Cashfree provider' };
          }
          return { success: false, errorCode: result.errorCode || 'CKYC_SEARCH_FAILED', errorMessage: result.message || 'TruthScreen CKYC search failed' };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      // ─── AADHAAR VERIFICATION ─────────────────────────────────────────────
      // payload.subStep = 'generate_otp' | 'verify_otp'
      //   generate_otp: payload.aadhaarNumber required
      //   verify_otp:   payload.refId + payload.otp required

      case "sandbox_aadhaar": {
        const subStep = p.subStep || (p.aadhaarNumber ? 'generate_otp' : 'verify_otp');
        if (subStep === 'generate_otp') {
          console.log(`[KYC-ENGINE] Calling Sandbox Aadhaar OTP generation`);
          if (!p.aadhaarNumber) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'aadhaarNumber is required for aadhaar generate_otp' };
          }
          try {
            const result = await sandboxKYCService.generateAadhaarOTP(p.aadhaarNumber, p.reason || 'KYC verification');
            return {
              success: true,
              data: {
                subStep: 'generate_otp',
                source: 'sandbox_aadhaar',
                referenceId: result.referenceId,
                message: result.message,
                validForSeconds: result.validFor,
                maskedAadhaar: `XXXX XXXX ${String(p.aadhaarNumber).slice(-4)}`,
              },
            };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_GENERATION_FAILED', errorMessage: err.message };
          }
        } else {
          console.log(`[KYC-ENGINE] Calling Sandbox Aadhaar OTP verification`);
          if (!p.refId || !p.otp) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'refId and otp are required for aadhaar verify_otp' };
          }
          try {
            const result = await sandboxKYCService.verifyAadhaarOTP(p.refId, p.otp);
            return {
              success: true,
              data: {
                subStep: 'verify_otp',
                source: 'sandbox_aadhaar',
                verified: result.verified,
                aadhaarNumber: result.aadhaarNumber,
                fullName: result.fullName,
                dateOfBirth: result.dateOfBirth,
                gender: result.gender,
                address: result.address,
              },
            };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_VERIFICATION_FAILED', errorMessage: err.message };
          }
        }
      }

      case "cashfree_aadhaar": {
        if (!CashfreeAadhaarService.isConfigured()) {
          return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'Cashfree Secure ID credentials not set — add CASHFREE_SECUREID_APP_ID / CASHFREE_SECUREID_SECRET_KEY' };
        }
        const subStep = p.subStep || (p.aadhaarNumber ? 'generate_otp' : 'verify_otp');
        if (subStep === 'generate_otp') {
          console.log(`[KYC-ENGINE] Calling Cashfree Aadhaar OKYC OTP generation`);
          if (!p.aadhaarNumber) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'aadhaarNumber is required for aadhaar generate_otp' };
          }
          try {
            const result = await CashfreeAadhaarService.generateOTP(p.aadhaarNumber);
            if (result.success) {
              return {
                success: true,
                data: {
                  subStep: 'generate_otp',
                  source: 'cashfree_aadhaar',
                  refId: result.ref_id,
                  maskedAadhaar: result.maskedAadhaar,
                  message: result.message,
                },
              };
            }
            return { success: false, errorCode: 'OTP_GENERATION_FAILED', errorMessage: result.message };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_GENERATION_FAILED', errorMessage: err.message };
          }
        } else {
          console.log(`[KYC-ENGINE] Calling Cashfree Aadhaar OKYC OTP verification`);
          if (!p.refId || !p.otp) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'refId and otp are required for aadhaar verify_otp' };
          }
          try {
            const result = await CashfreeAadhaarService.verifyOTP(p.otp, p.refId);
            if (result.verified) {
              return {
                success: true,
                data: {
                  subStep: 'verify_otp',
                  source: 'cashfree_aadhaar',
                  verified: true,
                  name: result.data?.name,
                  dob: result.data?.dob,
                  gender: result.data?.gender,
                  address: result.data?.address,
                },
              };
            }
            return { success: false, errorCode: 'OTP_VERIFICATION_FAILED', errorMessage: result.message };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_VERIFICATION_FAILED', errorMessage: err.message };
          }
        }
      }

      case "offline_aadhaar_xml": {
        console.log(`[KYC-ENGINE] offline_aadhaar_xml — requires file upload flow, not inline`);
        return {
          success: false,
          errorCode: 'MANUAL_UPLOAD_REQUIRED',
          errorMessage: 'Aadhaar XML upload must be handled through the document upload flow, not the engine verify endpoint',
        };
      }

      case "truthscreen_aadhaar": {
        if (!process.env.TRUTHSCREEN_USERNAME || !process.env.TRUTHSCREEN_PASSWORD) {
          return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'TruthScreen credentials not set — add TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD' };
        }
        const subStep = p.subStep || (p.aadhaarNumber ? 'generate_otp' : 'verify_otp');
        if (subStep === 'generate_otp') {
          console.log(`[KYC-ENGINE] Calling TruthScreen Aadhaar OTP generation`);
          if (!p.aadhaarNumber) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'aadhaarNumber is required for aadhaar generate_otp' };
          }
          try {
            const result = await TruthscreenAadhaarService.generateOTP(p.aadhaarNumber);
            if (result.success) {
              return {
                success: true,
                data: {
                  subStep: 'generate_otp',
                  source: 'truthscreen_aadhaar',
                  refId: result.refId,
                  maskedAadhaar: result.maskedAadhaar,
                  transactionId: result.transactionId,
                  message: result.message,
                },
              };
            }
            return { success: false, errorCode: 'OTP_GENERATION_FAILED', errorMessage: result.message };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_GENERATION_FAILED', errorMessage: err.message };
          }
        } else {
          console.log(`[KYC-ENGINE] Calling TruthScreen Aadhaar OTP verification`);
          if (!p.refId || !p.otp) {
            return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'refId and otp are required for aadhaar verify_otp' };
          }
          try {
            const result = await TruthscreenAadhaarService.verifyOTP(p.refId, p.otp);
            if (result.verified) {
              return {
                success: true,
                data: {
                  subStep: 'verify_otp',
                  source: 'truthscreen_aadhaar',
                  verified: true,
                  name: result.data?.name,
                  dob: result.data?.dob,
                  gender: result.data?.gender,
                  fatherName: result.data?.fatherName,
                  address: result.data?.address,
                },
              };
            }
            return { success: false, errorCode: 'OTP_VERIFICATION_FAILED', errorMessage: result.message };
          } catch (err: any) {
            return { success: false, errorCode: 'OTP_VERIFICATION_FAILED', errorMessage: err.message };
          }
        }
      }

      // ─── BANK ACCOUNT VERIFICATION ────────────────────────────────────────

      case "sandbox_bank": {
        console.log(`[KYC-ENGINE] Calling Sandbox.co.in Bank penny-drop verification`);
        const accountNo = p.accountNo || p.accountNumber || '';
        const ifsc = (p.ifsc || '').toUpperCase();
        if (!accountNo || !ifsc) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'accountNo and ifsc are required for sandbox_bank' };
        }
        try {
          const result = await sandboxKYCService.verifyBankAccountPennyDrop(accountNo, ifsc);
          if (result.verified) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'sandbox_bank',
                accountNumber: result.accountNumber,
                ifsc: result.ifsc,
                accountHolderName: result.accountHolderName,
                bankName: result.bankName,
                branchName: result.branchName,
                transactionId: result.transactionId,
                utr: result.utr,
              },
            };
          }
          return { success: false, errorCode: 'BANK_VERIFICATION_FAILED', errorMessage: 'Bank account could not be verified' };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      case "cashfree_bank": {
        console.log(`[KYC-ENGINE] Calling Cashfree VRS Bank Account V2 (sync) verification`);
        const bankAccount = p.accountNo || p.accountNumber || '';
        const ifsc = (p.ifsc || '').toUpperCase();
        if (!bankAccount || !ifsc) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'accountNo and ifsc are required for cashfree_bank' };
        }
        try {
          const result = await verifyBankAccountV2({
            bankAccount,
            ifsc,
            name: p.accountHolderName || p.name || undefined,
            phoneNumber: p.phone || undefined,
          });
          if (result.success) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'cashfree_bank',
                ...result.data,
              },
            };
          }
          return {
            success: false,
            errorCode: 'BANK_VERIFICATION_FAILED',
            errorMessage: result.error || 'Cashfree bank verification failed',
          };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      // ─── CKYC VERIFICATION ────────────────────────────────────────────────

      case "truthscreen_ckyc": {
        console.log(`[KYC-ENGINE] Calling TruthScreen CKYC 3-step search`);
        const pan = (p.pan || '').toUpperCase();
        if (!pan) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'pan is required for truthscreen_ckyc' };
        }
        const tsAdapter = new TruthScreenCkycAdapter();
        if (!tsAdapter.isConfigured()) {
          return { success: false, errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'TruthScreen credentials not set — add TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD' };
        }
        try {
          const result = await tsAdapter.verify({
            panNumber: pan,
            fullName: p.name || '',
            dateOfBirth: p.dob || '',
          });
          if (result.success && result.found) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'truthscreen_ckyc',
                kin: result.kin,
                kycStatus: result.status,
                verificationLevel: result.verificationLevel,
                fullName: result.data?.fullName,
                dateOfBirth: result.data?.dateOfBirth,
                gender: result.data?.gender,
                address: result.data?.address,
                kycDate: result.data?.kycDate,
              },
            };
          }
          if (result.success && !result.found) {
            return { success: false, errorCode: 'CKYC_NOT_FOUND', errorMessage: result.message || 'No CKYC record found for this PAN' };
          }
          return { success: false, errorCode: result.errorCode || 'CKYC_SEARCH_FAILED', errorMessage: result.message || 'TruthScreen CKYC search failed' };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      case "authbridge_ckyc": {
        console.log(`[KYC-ENGINE] AuthBridge CKYC — not implemented yet`);
        return { success: false, errorCode: 'PROVIDER_NOT_IMPLEMENTED', errorMessage: 'AuthBridge CKYC integration not yet configured' };
      }

      case "cersai_ckyc": {
        console.log(`[KYC-ENGINE] CERSAI CKYC — not implemented yet`);
        return { success: false, errorCode: 'PROVIDER_NOT_IMPLEMENTED', errorMessage: 'CERSAI CKYC integration not yet configured' };
      }

      case "vkyc_ckyc": {
        console.log(`[KYC-ENGINE] Video KYC — not implemented yet`);
        return { success: false, errorCode: 'PROVIDER_NOT_IMPLEMENTED', errorMessage: 'Video KYC integration not yet configured' };
      }

      case "manual_ckyc": {
        console.log(`[KYC-ENGINE] manual_ckyc — marking as PENDING_MANUAL_REVIEW`);
        return {
          success: true,
          data: {
            verified: false,
            source: 'manual_ckyc',
            status: 'PENDING_MANUAL_REVIEW',
            requiresManualReview: true,
            message: 'CKYC requires manual verification by compliance team',
          },
        };
      }

      // ─── GSTIN VERIFICATION ───────────────────────────────────────────────
      case "sandbox_gstin": {
        console.log(`[KYC-ENGINE] Calling Sandbox.co.in GSTIN verification`);
        const gstin = (p.gstin || '').toUpperCase();
        if (!gstin) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'gstin is required for sandbox_gstin' };
        }
        try {
          const result = await sandboxKYCService.verifyGSTIN(gstin);
          if (result.valid) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'sandbox_gstin',
                gstin,
                legalName: result.legalName,
                tradeName: result.tradeName,
                registrationDate: result.registrationDate,
                status: result.status,
                businessType: result.businessType,
                address: result.principalAddress,
              },
            };
          }
          return {
            success: false,
            errorCode: 'GSTIN_INVALID',
            errorMessage: result.message || 'GSTIN is not valid or not registered',
          };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      // ─── MCA / CIN VERIFICATION ───────────────────────────────────────────
      case "sandbox_mca": {
        console.log(`[KYC-ENGINE] Calling Sandbox.co.in MCA company verification`);
        const cin = (p.cin || '').toUpperCase();
        const companyName = p.companyName || '';
        if (!cin && !companyName) {
          return { success: false, errorCode: 'MISSING_PAYLOAD', errorMessage: 'cin or companyName is required for sandbox_mca' };
        }
        try {
          const result = cin
            ? await sandboxKYCService.getCompanyByCIN(cin)
            : await sandboxKYCService.searchMCACompany(companyName);
          if (result && (result.cin || result.companyStatus)) {
            return {
              success: true,
              data: {
                verified: true,
                source: 'sandbox_mca',
                cin: result.cin,
                companyName: result.companyName,
                companyStatus: result.companyStatus,
                registrationDate: result.dateOfIncorporation,
                registeredAddress: result.registeredAddress,
                authorizedCapital: result.authorizedCapital,
                paidUpCapital: result.paidUpCapital,
                companyCategory: result.companyCategory,
                companySubCategory: result.companySubCategory,
              },
            };
          }
          return {
            success: false,
            errorCode: 'MCA_NOT_FOUND',
            errorMessage: `Company not found in MCA registry: ${cin || companyName}`,
          };
        } catch (err: any) {
          return { success: false, errorCode: 'PROVIDER_ERROR', errorMessage: err.message };
        }
      }

      default:
        console.error(`[KYC-ENGINE] Unknown provider code: ${providerCode} — no implementation registered`);
        return { success: false, errorCode: 'UNKNOWN_PROVIDER', errorMessage: `No implementation for provider code: ${providerCode}` };
    }
  }

  async recordProviderMetric(
    providerId: number,
    success: boolean,
    latencyMs: number,
    errorCode?: string
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];

      const existing = await db
        .select()
        .from(providerMetrics)
        .where(
          and(
            eq(providerMetrics.providerId, providerId),
            eq(providerMetrics.metricDate, today)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const metric = existing[0];
        const newTotal = (metric.totalCalls ?? 0) + 1;
        const newSuccess = (metric.successfulCalls ?? 0) + (success ? 1 : 0);
        const newFailed = (metric.failedCalls ?? 0) + (success ? 0 : 1);
        const currentAvg = metric.avgLatencyMs ?? 0;
        const newAvgLatency = Math.round(
          (currentAvg * (metric.totalCalls ?? 0) + latencyMs) / newTotal
        );
        const p95 = Math.max(metric.p95LatencyMs ?? 0, latencyMs);
        const existingErrors = (metric.errorCodes as Record<string, number>) || {};
        if (errorCode) {
          existingErrors[errorCode] = (existingErrors[errorCode] || 0) + 1;
        }
        const newFallbacks = (metric.fallbacksTriggered ?? 0) + (errorCode ? 1 : 0);

        await db
          .update(providerMetrics)
          .set({
            totalCalls: newTotal,
            successfulCalls: newSuccess,
            failedCalls: newFailed,
            avgLatencyMs: newAvgLatency,
            p95LatencyMs: p95,
            errorCodes: existingErrors,
            fallbacksTriggered: newFallbacks,
          })
          .where(eq(providerMetrics.id, metric.id));
      } else {
        const errorCodes: Record<string, number> = {};
        if (errorCode) {
          errorCodes[errorCode] = 1;
        }
        await db.insert(providerMetrics).values({
          providerId,
          metricDate: today,
          totalCalls: 1,
          successfulCalls: success ? 1 : 0,
          failedCalls: success ? 0 : 1,
          avgLatencyMs: latencyMs,
          p95LatencyMs: latencyMs,
          errorCodes: Object.keys(errorCodes).length > 0 ? errorCodes : null,
          fallbacksTriggered: errorCode ? 1 : 0,
        });
      }

      const [provider] = await db
        .select()
        .from(kycProviders)
        .where(eq(kycProviders.id, providerId))
        .limit(1);

      if (provider) {
        const newTotalCalls = (provider.totalCalls ?? 0) + 1;
        const newSuccessfulCalls = (provider.successfulCalls ?? 0) + (success ? 1 : 0);
        const newFailedCalls = (provider.failedCalls ?? 0) + (success ? 0 : 1);
        const newErrorRate = newTotalCalls > 0 ? newFailedCalls / newTotalCalls : 0;
        const currentAvg = provider.avgLatencyMs ?? 0;
        const newAvg = Math.round(
          (currentAvg * (provider.totalCalls ?? 0) + latencyMs) / newTotalCalls
        );

        await db
          .update(kycProviders)
          .set({
            totalCalls: newTotalCalls,
            successfulCalls: newSuccessfulCalls,
            failedCalls: newFailedCalls,
            avgLatencyMs: newAvg,
            errorRate: parseFloat(newErrorRate.toFixed(4)),
            updatedAt: new Date(),
          })
          .where(eq(kycProviders.id, providerId));
      }
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to record provider metric:`, error?.message || error);
    }
  }

  async getProviderChainForStep(
    kycStep: string,
    productType: string
  ): Promise<Array<{ provider: typeof kycProviders.$inferSelect; priority: typeof kycProviderPriority.$inferSelect }>> {
    try {
      const priorities = await db
        .select()
        .from(kycProviderPriority)
        .where(
          and(
            eq(kycProviderPriority.kycStep, kycStep),
            eq(kycProviderPriority.isActive, true)
          )
        )
        .orderBy(asc(kycProviderPriority.priority));

      const filtered = priorities.filter((p) => {
        const scope = p.productScope as string[] | null;
        if (!scope || !Array.isArray(scope) || scope.length === 0) return true;
        return scope.includes(productType);
      });

      const chain: Array<{ provider: typeof kycProviders.$inferSelect; priority: typeof kycProviderPriority.$inferSelect }> = [];

      for (const priorityEntry of filtered) {
        const [provider] = await db
          .select()
          .from(kycProviders)
          .where(eq(kycProviders.id, priorityEntry.providerId))
          .limit(1);

        if (provider) {
          chain.push({ provider, priority: priorityEntry });
        }
      }

      return chain;
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to get provider chain:`, error?.message || error);
      return [];
    }
  }

  async getFlowForProduct(productType: string): Promise<Array<{ step: string; sequence: number }>> {
    try {
      const [activeFlow] = await db
        .select()
        .from(kycFlowVersions)
        .where(
          and(
            eq(kycFlowVersions.productType, productType),
            eq(kycFlowVersions.isActive, true)
          )
        )
        .limit(1);

      if (activeFlow && activeFlow.steps) {
        const steps = activeFlow.steps as Array<{ step: string; sequence: number }>;
        return steps.sort((a, b) => a.sequence - b.sequence);
      }

      const [productConfig] = await db
        .select()
        .from(productConfigurations)
        .where(eq(productConfigurations.productCode, productType))
        .limit(1);

      if (productConfig && productConfig.requiredKycSteps) {
        const requiredSteps = productConfig.requiredKycSteps as string[];
        return requiredSteps.map((step, index) => ({
          step,
          sequence: index + 1,
        }));
      }

      console.log(`[KYC-ENGINE] No flow or product config found for productType=${productType}`);
      return [];
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to get flow for product:`, error?.message || error);
      return [];
    }
  }

  async updateProviderPriority(
    kycStep: string,
    providerId: number,
    newPriority: number,
    updatedBy?: string
  ): Promise<void> {
    try {
      const [existing] = await db
        .select()
        .from(kycProviderPriority)
        .where(
          and(
            eq(kycProviderPriority.kycStep, kycStep),
            eq(kycProviderPriority.providerId, providerId)
          )
        )
        .limit(1);

      if (!existing) {
        console.log(`[KYC-ENGINE] No priority entry found for step=${kycStep}, providerId=${providerId}`);
        return;
      }

      const previousPriority = existing.priority;

      await db
        .update(kycProviderPriority)
        .set({
          priority: newPriority,
          updatedBy: updatedBy || null,
          updatedAt: new Date(),
        })
        .where(eq(kycProviderPriority.id, existing.id));

      console.log(`[KYC-ENGINE] Updated priority for step=${kycStep}, providerId=${providerId}: ${previousPriority} -> ${newPriority}`);

      await this.logAuditEvent(
        "provider_priority_change",
        "kyc_provider_priority",
        String(existing.id),
        "priority_updated",
        {
          kycStep,
          providerId,
          previousPriority,
          newPriority,
        },
        updatedBy
      );
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to update provider priority:`, error?.message || error);
    }
  }

  async logAuditEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    action: string,
    details: Record<string, any>,
    actorId?: string
  ): Promise<void> {
    try {
      await db.insert(platformAuditLogs).values({
        eventType,
        entityType,
        entityId,
        action,
        changeDetails: details,
        actorId: actorId || null,
        severity: "INFO",
      });
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to log audit event:`, error?.message || error);
    }
  }

  async trackFunnelStep(
    userId: string,
    funnelType: string,
    currentStep: string,
    stepSequence: number,
    sessionId?: string
  ): Promise<void> {
    try {
      await db.insert(conversionFunnels).values({
        userId,
        funnelType,
        currentStep,
        stepSequence,
        sessionId: sessionId || null,
      });
      console.log(`[KYC-ENGINE] Tracked funnel step: user=${userId}, funnel=${funnelType}, step=${currentStep}, seq=${stepSequence}`);
    } catch (error: any) {
      console.error(`[KYC-ENGINE] Failed to track funnel step:`, error?.message || error);
    }
  }
}

export const kycOrchestrationEngine = new KycOrchestrationEngine();
