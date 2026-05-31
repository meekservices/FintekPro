// @ts-nocheck
import { DsaLoanApplication, LoanRoutingHistory, BankConnector } from "@shared/schema";
import { bankCredentialsVaultService } from "../bank-credentials-vault-service";
import { bankTokenManagementService } from "../bank-token-management-service";
import { bankAPIRateLimiter, type BankOperationType } from "../bank-api-rate-limiter";
import { bankAPIAuditService, type BankAPIAuditEntry } from "../bank-api-audit-service";

export interface BankSubmissionPayload {
  application: DsaLoanApplication;
  documents?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  routingHistory: LoanRoutingHistory;
}

export interface BankSubmissionResponse {
  success: boolean;
  bankReference?: string;
  message?: string;
  error?: string;
  expectedResponseTime?: number;
}

export interface BankStatusResponse {
  bankStatus: 'pending' | 'in_review' | 'approved' | 'rejected' | 'query' | 'documents_required';
  bankReference?: string;
  approvedAmount?: number;
  approvedTenure?: number;
  offeredInterestRate?: number;
  processingFee?: number;
  rejectionReason?: string;
  queryDetails?: string;
  sanctionLetterUrl?: string;
}

export abstract class BaseBankConnector {
  protected config: BankConnector;
  
  constructor(config: BankConnector) {
    this.config = config;
  }
  
  abstract get connectorType(): string;
  
  abstract submitApplication(payload: BankSubmissionPayload): Promise<BankSubmissionResponse>;
  
  abstract checkStatus(bankReference: string): Promise<BankStatusResponse>;
  
  abstract validateCredentials(): Promise<boolean>;

  protected getEnvironment(): 'sandbox' | 'production' {
    if (this.config.environment) {
      return this.config.environment as 'sandbox' | 'production';
    }
    return (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const environment = this.getEnvironment();
    const token = await bankTokenManagementService.getValidToken(this.config.bankCode, environment);
    if (!token) {
      console.log(`[${this.config.bankCode}] No OAuth token available, using API key auth`);
      const credentials = await bankCredentialsVaultService.getCredentials(this.config.bankCode, environment);
      if (credentials?.apiKey) {
        return { 'X-API-Key': credentials.apiKey };
      }
      return {};
    }
    return { 'Authorization': `Bearer ${token.accessToken}` };
  }

  protected async checkRateLimit(operation: BankOperationType): Promise<boolean> {
    const result = await bankAPIRateLimiter.checkRateLimit(this.config.bankCode, operation);
    if (!result.allowed) {
      console.warn(`[${this.config.bankCode}] Rate limited for ${operation}. Retry after ${result.retryAfterMs}ms`);
    }
    return result.allowed;
  }

  protected async auditApiCall(
    operation: string,
    requestData: Record<string, any>,
    responseData: Record<string, any>,
    success: boolean,
    options: {
      applicationId?: number;
      errorMessage?: string;
      responseTimeMs?: number;
      httpMethod?: string;
      httpStatus?: number;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    const redactedResponse = this.redactSensitiveFields(responseData);
    
    await bankAPIAuditService.logAPICall({
      bankCode: this.config.bankCode,
      environment: this.getEnvironment(),
      operation,
      endpoint: this.config.apiEndpoint || 'simulated',
      httpMethod: options.httpMethod || 'POST',
      requestPayload: requestData,
      responseStatus: options.httpStatus || (success ? 200 : 500),
      responseTime: options.responseTimeMs,
      success,
      errorMessage: options.errorMessage,
      applicationId: options.applicationId?.toString(),
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: { responseStatus: redactedResponse.status, hasData: !!redactedResponse },
    });
  }

  protected redactSensitiveFields(data: Record<string, any>): Record<string, any> {
    if (!data) return data;
    const sensitiveKeys = ['pan', 'aadhaar', 'password', 'otp', 'cvv', 'accountNumber', 'ifsc'];
    const redacted = { ...data };
    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redactSensitiveFields(redacted[key]);
      }
    }
    return redacted;
  }
  
  protected formatPhoneNumber(phone: string): string {
    return phone.startsWith('+91') ? phone : `+91${phone}`;
  }
  
  protected formatAmount(amount: string | number): number {
    return typeof amount === 'string' ? parseFloat(amount) : amount;
  }
  
  protected formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }
  
  protected maskPAN(pan: string | null): string {
    if (!pan) return 'XXXXX****X';
    return pan.substring(0, 5) + '****' + pan.substring(9);
  }
  
  protected generateRequestId(): string {
    return `REQ${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
}
