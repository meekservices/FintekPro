/**
 * eSign Service - Production Ready Implementation
 * 
 * Integrates with eMudhra eSign API for digital signature capture
 * on Risk Declaration documents for Accredited Investor verification.
 * 
 * Provider: eMudhra (Chosen for superior REST API and documentation)
 * 
 * Environment Variables Required:
 * - ESIGN_MODE: "production" | "simulation" (default: simulation)
 * - ESIGN_PROVIDER: "emudhra" | "nsdl" (default: emudhra)
 * - EMUDHRA_API_URL: eMudhra API endpoint (default: https://api.emsigner.com/v1)
 * - EMUDHRA_SYSTEM_ID: Unique system identifier from eMudhra
 * - EMUDHRA_AUTH_TOKEN: Authentication token generated from eMudhra dashboard
 * - EMUDHRA_UNIQUE_ID: SYSTEM_ID + EMAIL for authentication
 * - ESIGN_WEBHOOK_SECRET: Secret for validating webhook callbacks
 * - ESIGN_CALLBACK_URL: Public URL for webhook notifications (e.g., https://yourapp.com/api/esign/webhook)
 * 
 * Documentation:
 * - eMudhra Developer Portal: https://developers.emsigner.com/
 * - API Docs: https://devemca.emudhra.com/eSign.html
 * - Sandbox: https://esign.sandbox.emudhra.com/
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ESIGN_CONFIG = {
  MODE: (process.env.ESIGN_MODE || "simulation") as "production" | "simulation",
  PROVIDER: (process.env.ESIGN_PROVIDER || "emudhra") as "emudhra" | "nsdl",
  
  EMUDHRA: {
    API_URL: process.env.EMUDHRA_API_URL || "https://api.emsigner.com/v1",
    SANDBOX_URL: "https://esign.sandbox.emudhra.com/api/v1",
    SYSTEM_ID: process.env.EMUDHRA_SYSTEM_ID || "",
    AUTH_TOKEN: process.env.EMUDHRA_AUTH_TOKEN || "",
    UNIQUE_ID: process.env.EMUDHRA_UNIQUE_ID || "",
  },
  
  WEBHOOK: {
    SECRET: process.env.ESIGN_WEBHOOK_SECRET || "",
    CALLBACK_URL: process.env.ESIGN_CALLBACK_URL || "",
  },
  
  TIMEOUT: {
    SIGNING_SESSION_MINUTES: 30,
    POLLING_INTERVAL_MS: 5000,
    MAX_POLLING_ATTEMPTS: 60,
  },
};

export interface ESignRequest {
  userId: string;
  verificationId: string;
  documentType: "risk_declaration" | "consent_form" | "agreement";
  documentUrl: string;
  signerDetails: {
    fullName: string;
    email: string;
    mobile: string;
    panNumber: string;
    aadharNumber?: string;
  };
  returnUrl: string;
}

export interface ESignResponse {
  success: boolean;
  transactionId: string;
  status: "initiated" | "pending" | "completed" | "failed";
  message: string;
  redirectUrl?: string;
  expiresAt?: Date;
  sessionId?: string;
}

export interface ESignStatusResponse {
  transactionId: string;
  status: "pending" | "completed" | "failed" | "expired";
  signedDocumentUrl?: string;
  signedAt?: Date;
  signerName?: string;
  certificateInfo?: {
    issuer: string;
    serialNumber: string;
    validFrom: Date;
    validUntil: Date;
  };
  errorMessage?: string;
}

interface EMudhraAPIError {
  code: string;
  message: string;
  details?: any;
}

const EMUDHRA_ERROR_MESSAGES: Record<string, string> = {
  "AUTH_FAILED": "Authentication failed. Please contact support.",
  "INVALID_AADHAAR": "Invalid Aadhaar number. Please verify and try again.",
  "OTP_EXPIRED": "OTP has expired. Please request a new one.",
  "OTP_INVALID": "Invalid OTP. Please check and try again.",
  "DOCUMENT_NOT_FOUND": "Document not found. Please re-upload and try again.",
  "SESSION_EXPIRED": "Signing session has expired. Please start a new signing request.",
  "USER_CANCELLED": "Signing process was cancelled by user.",
  "AADHAAR_NOT_LINKED": "Mobile number not linked with Aadhaar. Please link your mobile number.",
  "NETWORK_ERROR": "Network error occurred. Please try again.",
  "RATE_LIMIT_EXCEEDED": "Too many requests. Please wait and try again.",
  "INVALID_DOCUMENT_HASH": "Invalid document hash. Please re-upload the document.",
  "CERTIFICATE_ERROR": "Error generating digital certificate. Please try again.",
};

function getApiEndpoint(): string {
  if (ESIGN_CONFIG.MODE === "production") {
    return ESIGN_CONFIG.EMUDHRA.API_URL;
  }
  return ESIGN_CONFIG.EMUDHRA.SANDBOX_URL;
}

function sanitizeLogData(data: any): any {
  const sanitized = { ...data };
  const sensitiveFields = ["aadharNumber", "aadhaar", "otp", "authToken", "apiKey", "secret"];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "***REDACTED***";
    }
  }
  
  if (sanitized.signerDetails?.aadharNumber) {
    sanitized.signerDetails.aadharNumber = "***REDACTED***";
  }
  
  return sanitized;
}

function mapErrorToUserMessage(error: EMudhraAPIError | any): string {
  if (typeof error === "string") {
    return EMUDHRA_ERROR_MESSAGES[error] || error;
  }
  
  if (error?.code && EMUDHRA_ERROR_MESSAGES[error.code]) {
    return EMUDHRA_ERROR_MESSAGES[error.code];
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return "An error occurred during the signing process. Please try again.";
}

function generateTransactionId(): string {
  return `ESIGN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function generateRiskDeclarationPDF(
  applicantName: string,
  panNumber: string
): string {
  const riskDeclaration = `
RISK DECLARATION FOR ACCREDITED INVESTOR STATUS

I, ${applicantName} (PAN: ${panNumber}), hereby declare that:

1. I understand that Accredited Investor status allows me to invest in high-risk financial products including:
   - Alternative Investment Funds (AIFs)
   - Portfolio Management Services (PMS)
   - Structured Debt Products
   - Private Market Investments

2. I acknowledge that these investments:
   - Are subject to high market risk and volatility
   - May have limited liquidity and longer lock-in periods
   - Are not guaranteed by any regulatory authority
   - May result in partial or complete loss of invested capital

3. I confirm that:
   - I meet the SEBI prescribed criteria for Accredited Investor status
   - I have adequate financial resources to bear potential losses
   - I understand the nature and risks of these investments
   - I am not relying solely on the platform's advice for investment decisions

4. I undertake to:
   - Keep my financial information updated
   - Renew my Accredited Investor certificate before expiry
   - Inform the platform immediately if I no longer meet the criteria

Date: ${new Date().toLocaleDateString("en-IN")}
Place: India

Signature: ___________________________
Name: ${applicantName}
PAN: ${panNumber}

This declaration is legally binding and will be digitally signed using Aadhaar-based eSign.
  `.trim();
  
  return riskDeclaration;
}

async function initiateEMudhraESign(request: ESignRequest): Promise<ESignResponse> {
  const transactionId = generateTransactionId();
  
  console.log(`[eMudhra eSign] Initiating eSign for verification ${request.verificationId}`);
  console.log(`[eMudhra eSign] Transaction ID: ${transactionId}`);
  console.log(`[eMudhra eSign] Request details:`, sanitizeLogData(request));
  
  if (!ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN || !ESIGN_CONFIG.EMUDHRA.UNIQUE_ID) {
    console.error("[eMudhra eSign] Missing API credentials");
    return {
      success: false,
      transactionId,
      status: "failed",
      message: "eSign service not configured. Please contact support.",
    };
  }
  
  try {
    const documentHash = crypto.createHash("sha256")
      .update(request.documentUrl)
      .digest("hex");
    
    const apiEndpoint = getApiEndpoint();
    const requestPayload = {
      transactionId,
      documentHash,
      documentUrl: request.documentUrl,
      documentName: `Risk_Declaration_${request.signerDetails.panNumber}.pdf`,
      documentType: request.documentType,
      signer: {
        name: request.signerDetails.fullName,
        email: request.signerDetails.email,
        mobile: request.signerDetails.mobile,
        identifier: request.signerDetails.aadharNumber,
        identifierType: "aadhaar",
      },
      callbackUrl: ESIGN_CONFIG.WEBHOOK.CALLBACK_URL,
      returnUrl: request.returnUrl,
      expiryMinutes: ESIGN_CONFIG.TIMEOUT.SIGNING_SESSION_MINUTES,
      metadata: {
        userId: request.userId,
        verificationId: request.verificationId,
        timestamp: new Date().toISOString(),
      },
    };
    
    console.log(`[eMudhra eSign] Calling API: ${apiEndpoint}/esign/initiate`);
    console.log(`[eMudhra eSign] Payload:`, sanitizeLogData(requestPayload));
    
    const response = await fetch(`${apiEndpoint}/esign/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN,
        "X-Unique-ID": ESIGN_CONFIG.EMUDHRA.UNIQUE_ID,
        "X-System-ID": ESIGN_CONFIG.EMUDHRA.SYSTEM_ID,
      },
      body: JSON.stringify(requestPayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[eMudhra eSign] API error response: ${response.status} - ${errorText}`);
      
      let errorData: EMudhraAPIError;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = {
          code: "API_ERROR",
          message: `API returned status ${response.status}`,
        };
      }
      
      return {
        success: false,
        transactionId,
        status: "failed",
        message: mapErrorToUserMessage(errorData),
      };
    }
    
    const data = await response.json();
    console.log(`[eMudhra eSign] Success response:`, sanitizeLogData(data));
    
    const expiresAt = new Date(Date.now() + ESIGN_CONFIG.TIMEOUT.SIGNING_SESSION_MINUTES * 60 * 1000);
    
    await db.update(schema.accreditedInvestorVerifications)
      .set({
        eSignTransactionId: transactionId,
        eSignProvider: "emudhra",
        eSignStatus: "pending",
        eSignResponsePayload: {
          transactionId,
          sessionId: data.sessionId,
          status: "initiated",
          initiatedAt: new Date().toISOString(),
          provider: "emudhra",
          mode: ESIGN_CONFIG.MODE,
        },
        currentStep: "esign_pending",
        status: "esign_initiated",
        updatedAt: new Date(),
      })
      .where(eq(schema.accreditedInvestorVerifications.id, request.verificationId));
    
    console.log(`[eMudhra eSign] Database updated for verification ${request.verificationId}`);
    
    return {
      success: true,
      transactionId,
      status: "initiated",
      message: "eSign initiated successfully. Please complete the signing process.",
      redirectUrl: data.signingUrl || data.redirectUrl,
      expiresAt,
      sessionId: data.sessionId,
    };
  } catch (error: any) {
    console.error("[eMudhra eSign] Initiation failed:", error.message);
    console.error("[eMudhra eSign] Error stack:", error.stack);
    
    return {
      success: false,
      transactionId,
      status: "failed",
      message: mapErrorToUserMessage({ code: "NETWORK_ERROR", message: error.message }),
    };
  }
}

async function checkEMudhraStatus(transactionId: string): Promise<ESignStatusResponse> {
  console.log(`[eMudhra eSign] Checking status for transaction ${transactionId}`);
  
  if (!ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN || !ESIGN_CONFIG.EMUDHRA.UNIQUE_ID) {
    console.error("[eMudhra eSign] Missing API credentials");
    throw new Error("eSign service not configured");
  }
  
  try {
    const apiEndpoint = getApiEndpoint();
    const response = await fetch(`${apiEndpoint}/esign/status/${transactionId}`, {
      method: "GET",
      headers: {
        "X-Auth-Token": ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN,
        "X-Unique-ID": ESIGN_CONFIG.EMUDHRA.UNIQUE_ID,
        "X-System-ID": ESIGN_CONFIG.EMUDHRA.SYSTEM_ID,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[eMudhra eSign] Status check error: ${response.status} - ${errorText}`);
      throw new Error(`Status check failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[eMudhra eSign] Status response:`, sanitizeLogData(data));
    
    const statusResponse: ESignStatusResponse = {
      transactionId: data.transactionId || transactionId,
      status: mapEMudhraStatus(data.status),
      signedDocumentUrl: data.signedDocumentUrl || data.documentUrl,
      signedAt: data.signedAt ? new Date(data.signedAt) : undefined,
      signerName: data.signerName,
      certificateInfo: data.certificate ? {
        issuer: data.certificate.issuer,
        serialNumber: data.certificate.serialNumber,
        validFrom: new Date(data.certificate.validFrom),
        validUntil: new Date(data.certificate.validUntil),
      } : undefined,
      errorMessage: data.errorMessage,
    };
    
    return statusResponse;
  } catch (error: any) {
    console.error("[eMudhra eSign] Status check failed:", error.message);
    throw error;
  }
}

function mapEMudhraStatus(status: string): "pending" | "completed" | "failed" | "expired" {
  const statusMap: Record<string, "pending" | "completed" | "failed" | "expired"> = {
    "initiated": "pending",
    "pending": "pending",
    "in_progress": "pending",
    "completed": "completed",
    "signed": "completed",
    "success": "completed",
    "failed": "failed",
    "error": "failed",
    "cancelled": "failed",
    "expired": "expired",
    "timeout": "expired",
  };
  
  return statusMap[status.toLowerCase()] || "pending";
}

export async function initiateESign(request: ESignRequest): Promise<ESignResponse> {
  if (ESIGN_CONFIG.MODE === "simulation") {
    const transactionId = generateTransactionId();
    const signedDocumentUrl = `https://simulation.esign.com/signed-docs/${transactionId}.pdf`;
    
    console.log(`[eSign - SIMULATION] Auto-completing eSign transaction ${transactionId}`);
    console.log(`[eSign - SIMULATION] Request:`, sanitizeLogData(request));
    
    try {
      await db.update(schema.accreditedInvestorVerifications)
        .set({
          eSignTransactionId: transactionId,
          eSignProvider: ESIGN_CONFIG.PROVIDER as "emudhra" | "nsdl",
          eSignStatus: "completed",
          riskDeclarationUrl: signedDocumentUrl,
          eSignCompletedAt: new Date(),
          eSignResponsePayload: {
            transactionId,
            status: "completed",
            signedAt: new Date().toISOString(),
            provider: ESIGN_CONFIG.PROVIDER,
            mode: "simulation",
          },
          currentStep: "bse_submission",
          status: "esign_completed",
          updatedAt: new Date(),
        })
        .where(eq(schema.accreditedInvestorVerifications.id, request.verificationId));
      
      console.log(`[eSign - SIMULATION] Persisted eSign completion for verification ${request.verificationId}`);
    } catch (error: any) {
      console.error(`[eSign - SIMULATION] Database persistence failed:`, error.message);
      throw new Error("Failed to persist eSign completion");
    }
    
    return {
      success: true,
      transactionId,
      status: "completed",
      message: "SIMULATION MODE: Document auto-signed for testing. In production, user would be redirected to eSign portal.",
      redirectUrl: undefined,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
  
  if (ESIGN_CONFIG.PROVIDER === "emudhra") {
    return await initiateEMudhraESign(request);
  } else {
    throw new Error(`Provider ${ESIGN_CONFIG.PROVIDER} not fully implemented. Use eMudhra for production.`);
  }
}

export async function checkESignStatus(
  transactionId: string,
  provider: "emudhra" | "nsdl"
): Promise<ESignStatusResponse> {
  if (ESIGN_CONFIG.MODE === "simulation") {
    const signedDocumentUrl = `https://simulation.esign.com/signed-docs/${transactionId}.pdf`;
    
    console.log(`[eSign - SIMULATION] Status check for ${transactionId}`);
    
    return {
      transactionId,
      status: "completed",
      signedDocumentUrl,
      signedAt: new Date(),
      signerName: "Simulated Signer",
      certificateInfo: {
        issuer: "Simulation CA",
        serialNumber: `SIM${Date.now()}`,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    };
  }
  
  if (provider === "emudhra") {
    return await checkEMudhraStatus(transactionId);
  } else {
    throw new Error(`Provider ${provider} not fully implemented. Use eMudhra for production.`);
  }
}

export async function pollESignStatus(
  transactionId: string,
  provider: "emudhra" | "nsdl",
  maxAttempts: number = ESIGN_CONFIG.TIMEOUT.MAX_POLLING_ATTEMPTS
): Promise<ESignStatusResponse> {
  console.log(`[eSign Polling] Starting status polling for ${transactionId}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const status = await checkESignStatus(transactionId, provider);
      
      console.log(`[eSign Polling] Attempt ${attempt}/${maxAttempts} - Status: ${status.status}`);
      
      if (status.status === "completed" || status.status === "failed" || status.status === "expired") {
        console.log(`[eSign Polling] Final status reached: ${status.status}`);
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, ESIGN_CONFIG.TIMEOUT.POLLING_INTERVAL_MS));
    } catch (error: any) {
      console.error(`[eSign Polling] Error on attempt ${attempt}:`, error.message);
      
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
  
  console.warn(`[eSign Polling] Max attempts reached for ${transactionId}`);
  return {
    transactionId,
    status: "expired",
    errorMessage: "Signing session timed out",
  };
}

export async function handleWebhookCallback(
  rawBody: string,
  signature?: string
): Promise<{ success: boolean; message: string }> {
  console.log(`[eSign Webhook] Received callback`);
  
  // Verify HMAC signature using raw body (BEFORE parsing)
  if (ESIGN_CONFIG.WEBHOOK.SECRET && signature) {
    const expectedSignature = crypto
      .createHmac("sha256", ESIGN_CONFIG.WEBHOOK.SECRET)
      .update(rawBody)
      .digest("hex");
    
    if (signature !== expectedSignature) {
      console.error(`[eSign Webhook] Invalid signature`);
      return {
        success: false,
        message: "Invalid webhook signature",
      };
    }
  }
  
  // Parse payload AFTER signature verification
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error(`[eSign Webhook] Invalid JSON payload`);
    return {
      success: false,
      message: "Invalid JSON payload",
    };
  }
  
  console.log(`[eSign Webhook] Payload:`, sanitizeLogData(payload));
  
  try {
    const { transactionId, status, signedDocumentUrl, certificate, metadata } = payload;
    
    if (!transactionId) {
      console.error(`[eSign Webhook] Missing transaction ID`);
      return {
        success: false,
        message: "Missing transaction ID",
      };
    }
    
    const verification = await db.query.accreditedInvestorVerifications.findFirst({
      where: eq(schema.accreditedInvestorVerifications.eSignTransactionId, transactionId),
    });
    
    if (!verification) {
      console.error(`[eSign Webhook] Verification not found for transaction ${transactionId}`);
      return {
        success: false,
        message: "Verification not found",
      };
    }
    
    const mappedStatus = mapEMudhraStatus(status);
    
    await db.update(schema.accreditedInvestorVerifications)
      .set({
        eSignStatus: mappedStatus === "completed" ? "completed" : mappedStatus === "failed" ? "failed" : "pending",
        riskDeclarationUrl: signedDocumentUrl,
        eSignCompletedAt: mappedStatus === "completed" ? new Date() : undefined,
        eSignResponsePayload: {
          ...verification.eSignResponsePayload,
          status: mappedStatus,
          signedAt: new Date().toISOString(),
          certificate,
          webhookReceivedAt: new Date().toISOString(),
        },
        currentStep: mappedStatus === "completed" ? "bse_submission" : verification.currentStep,
        status: mappedStatus === "completed" ? "esign_completed" : mappedStatus === "failed" ? "esign_failed" : verification.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.accreditedInvestorVerifications.id, verification.id));
    
    console.log(`[eSign Webhook] Updated verification ${verification.id} with status ${mappedStatus}`);
    
    return {
      success: true,
      message: "Webhook processed successfully",
    };
  } catch (error: any) {
    console.error(`[eSign Webhook] Processing failed:`, error.message);
    return {
      success: false,
      message: error.message || "Webhook processing failed",
    };
  }
}

export async function downloadSignedDocument(
  signedDocumentUrl: string
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  if (ESIGN_CONFIG.MODE === "simulation") {
    const mockSignedPdf = Buffer.from(
      `DIGITALLY SIGNED RISK DECLARATION\n\nThis document has been signed using eSign (SIMULATION MODE)\n\nTransaction ID: ${signedDocumentUrl}\nSigned At: ${new Date().toISOString()}\n\n[Digital Signature]\nIssuer: Simulation CA\nValidity: 1 year`,
      "utf-8"
    );
    
    console.log(`[eSign - SIMULATION] Returning mock signed document`);
    
    return {
      success: true,
      pdfBuffer: mockSignedPdf,
    };
  }
  
  console.log(`[eSign] Downloading signed document from ${signedDocumentUrl.substring(0, 50)}...`);
  
  try {
    const response = await fetch(signedDocumentUrl, {
      headers: ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN ? {
        "X-Auth-Token": ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN,
      } : {},
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }
    
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[eSign] Successfully downloaded ${pdfBuffer.length} bytes`);
    
    return {
      success: true,
      pdfBuffer,
    };
  } catch (error: any) {
    console.error("[eSign] Document download failed:", error.message);
    return {
      success: false,
      error: error.message || "Failed to download signed document",
    };
  }
}

const configStatus = ESIGN_CONFIG.MODE === "production" && 
  (!ESIGN_CONFIG.EMUDHRA.AUTH_TOKEN || !ESIGN_CONFIG.EMUDHRA.UNIQUE_ID)
  ? "⚠️  PRODUCTION MODE - Missing credentials!"
  : "✅";

console.log(`${configStatus} eSign Service initialized`);
console.log(`   Provider: ${ESIGN_CONFIG.PROVIDER.toUpperCase()}`);
console.log(`   Mode: ${ESIGN_CONFIG.MODE.toUpperCase()}`);
console.log(`   Endpoint: ${getApiEndpoint()}`);
console.log(`   Webhook: ${ESIGN_CONFIG.WEBHOOK.CALLBACK_URL || "Not configured"}`);
