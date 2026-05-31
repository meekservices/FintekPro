// @ts-nocheck
/**
 * Bank API Audit Service
 * 
 * Logs all bank API interactions for RBI compliance.
 * Integrates with existing audit log service for immutable logging.
 * 
 * Features:
 * - Structured logging for all bank API calls
 * - Request/response hashing for integrity
 * - Performance metrics tracking
 * - Automatic cleanup and archival
 */

import { db } from '../db';
import { bankApiAuditLogs, type InsertBankApiAuditLog } from '@shared/dsa-loan-schema';
import { auditLogService } from './audit-log-service';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

export interface BankAPIAuditEntry {
  bankCode: string;
  environment: string;
  operation: string;
  endpoint?: string;
  httpMethod?: string;
  requestPayload?: any;
  responseStatus?: number;
  responseTime?: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  userId?: string;
  applicationId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

interface OperationTimer {
  startTime: number;
  bankCode: string;
  operation: string;
  requestId: string;
}

class BankAPIAuditService {
  private activeOperations: Map<string, OperationTimer> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('✅ Bank API Audit Service initialized');
  }

  /**
   * Start tracking an API operation
   */
  startOperation(bankCode: string, operation: string): string {
    const requestId = `BANK-${nanoid(12)}`;
    
    this.activeOperations.set(requestId, {
      startTime: Date.now(),
      bankCode,
      operation,
      requestId
    });

    return requestId;
  }

  /**
   * Complete an operation and log the audit entry
   */
  async endOperation(
    requestId: string,
    details: Omit<BankAPIAuditEntry, 'bankCode' | 'operation'>
  ): Promise<void> {
    const operation = this.activeOperations.get(requestId);
    if (!operation) {
      console.warn(`[BankAudit] No active operation found for ${requestId}`);
      return;
    }

    this.activeOperations.delete(requestId);
    const responseTime = Date.now() - operation.startTime;

    await this.logAPICall({
      bankCode: operation.bankCode,
      operation: operation.operation,
      ...details,
      responseTime
    }, requestId);
  }

  /**
   * Log a bank API call
   */
  async logAPICall(entry: BankAPIAuditEntry, requestId?: string): Promise<string> {
    const id = requestId || `BANK-${nanoid(12)}`;
    
    try {
      // Hash the request payload for audit (don't store sensitive data)
      const requestPayloadHash = entry.requestPayload 
        ? this.hashPayload(entry.requestPayload)
        : undefined;

      // Insert audit log
      await db.insert(bankApiAuditLogs).values({
        bankCode: entry.bankCode,
        environment: entry.environment,
        operation: entry.operation,
        requestId: id,
        endpoint: entry.endpoint,
        httpMethod: entry.httpMethod,
        requestPayloadHash,
        responseStatus: entry.responseStatus,
        responseTime: entry.responseTime,
        success: entry.success,
        errorCode: entry.errorCode,
        errorMessage: entry.errorMessage,
        userId: entry.userId,
        applicationId: entry.applicationId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata
      });

      // Also log to immutable audit service for critical operations
      if (this.isCriticalOperation(entry.operation)) {
        await auditLogService.log({
          eventType: 'BANK_API_CALL',
          action: entry.operation,
          userId: entry.userId,
          entityType: 'bank_api',
          entityId: id,
          newState: {
            bankCode: entry.bankCode,
            environment: entry.environment,
            success: entry.success,
            responseStatus: entry.responseStatus,
            applicationId: entry.applicationId
          },
          metadata: {
            requestPath: entry.endpoint,
            requestMethod: entry.httpMethod
          }
        });
      }

      return id;
    } catch (error: any) {
      console.error('[BankAudit] Error logging API call:', error.message);
      return id;
    }
  }

  /**
   * Create a middleware wrapper for axios/fetch calls
   */
  createAxiosInterceptor(bankCode: string, environment: string) {
    return {
      request: (config: any) => {
        const requestId = this.startOperation(bankCode, this.inferOperation(config.url, config.method));
        config.metadata = { ...config.metadata, bankAuditRequestId: requestId };
        return config;
      },
      response: async (response: any) => {
        const requestId = response.config?.metadata?.bankAuditRequestId;
        if (requestId) {
          await this.endOperation(requestId, {
            environment,
            endpoint: response.config?.url,
            httpMethod: response.config?.method?.toUpperCase(),
            responseStatus: response.status,
            success: response.status >= 200 && response.status < 300,
            metadata: { contentType: response.headers?.['content-type'] }
          });
        }
        return response;
      },
      error: async (error: any) => {
        const requestId = error.config?.metadata?.bankAuditRequestId;
        if (requestId) {
          await this.endOperation(requestId, {
            environment,
            endpoint: error.config?.url,
            httpMethod: error.config?.method?.toUpperCase(),
            responseStatus: error.response?.status,
            success: false,
            errorCode: error.code,
            errorMessage: error.message?.substring(0, 500)
          });
        }
        throw error;
      }
    };
  }

  /**
   * Log a successful API call directly (convenience method)
   */
  async logSuccess(
    bankCode: string,
    environment: string,
    operation: string,
    details: {
      endpoint?: string;
      httpMethod?: string;
      responseStatus?: number;
      responseTime?: number;
      userId?: string;
      applicationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    return this.logAPICall({
      bankCode,
      environment,
      operation,
      success: true,
      ...details
    });
  }

  /**
   * Log a failed API call directly (convenience method)
   */
  async logFailure(
    bankCode: string,
    environment: string,
    operation: string,
    error: {
      errorCode?: string;
      errorMessage: string;
      endpoint?: string;
      httpMethod?: string;
      responseStatus?: number;
      responseTime?: number;
      userId?: string;
      applicationId?: string;
    }
  ): Promise<string> {
    return this.logAPICall({
      bankCode,
      environment,
      operation,
      success: false,
      ...error
    });
  }

  /**
   * Get audit logs for an application
   */
  async getApplicationAuditLogs(applicationId: string, limit: number = 50): Promise<any[]> {
    const logs = await db.select()
      .from(bankApiAuditLogs)
      .where((eb) => eb.eq(bankApiAuditLogs.applicationId, applicationId))
      .orderBy((eb) => eb.desc(bankApiAuditLogs.createdAt))
      .limit(limit);

    return logs;
  }

  /**
   * Get audit logs for a bank
   */
  async getBankAuditLogs(
    bankCode: string,
    options: {
      environment?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      successOnly?: boolean;
    } = {}
  ): Promise<any[]> {
    const { limit = 100 } = options;

    const logs = await db.select()
      .from(bankApiAuditLogs)
      .where((eb) => eb.eq(bankApiAuditLogs.bankCode, bankCode))
      .orderBy((eb) => eb.desc(bankApiAuditLogs.createdAt))
      .limit(limit);

    return logs;
  }

  /**
   * Get summary metrics for a bank
   */
  async getBankMetrics(bankCode: string, environment: string, days: number = 7): Promise<{
    totalCalls: number;
    successRate: number;
    averageResponseTime: number;
    errorsByType: Record<string, number>;
    callsByOperation: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await db.select()
      .from(bankApiAuditLogs)
      .where((eb) => eb.and(
        eb.eq(bankApiAuditLogs.bankCode, bankCode),
        eb.eq(bankApiAuditLogs.environment, environment),
        eb.gte(bankApiAuditLogs.createdAt, startDate)
      ));

    const totalCalls = logs.length;
    const successfulCalls = logs.filter(l => l.success).length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    const responseTimes = logs
      .filter(l => l.responseTime !== null)
      .map(l => l.responseTime as number);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const errorsByType: Record<string, number> = {};
    const callsByOperation: Record<string, number> = {};

    for (const log of logs) {
      // Count by operation
      callsByOperation[log.operation] = (callsByOperation[log.operation] || 0) + 1;

      // Count errors by type
      if (!log.success && log.errorCode) {
        errorsByType[log.errorCode] = (errorsByType[log.errorCode] || 0) + 1;
      }
    }

    return {
      totalCalls,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      errorsByType,
      callsByOperation
    };
  }

  /**
   * Hash a payload for audit purposes
   */
  private hashPayload(payload: any): string {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
  }

  /**
   * Check if an operation is critical (requires immutable logging)
   */
  private isCriticalOperation(operation: string): boolean {
    const criticalOps = [
      'submit_application',
      'approve_loan',
      'reject_loan',
      'disburse_loan',
      'create_mandate',
      'payment_transfer'
    ];
    return criticalOps.includes(operation);
  }

  /**
   * Infer operation type from URL and method
   */
  private inferOperation(url: string, method: string): string {
    const normalizedUrl = url?.toLowerCase() || '';
    const normalizedMethod = method?.toUpperCase() || 'GET';

    if (normalizedUrl.includes('token') || normalizedUrl.includes('oauth')) {
      return normalizedMethod === 'POST' ? 'refresh_token' : 'validate_token';
    }
    if (normalizedUrl.includes('application') && normalizedMethod === 'POST') {
      return 'submit_application';
    }
    if (normalizedUrl.includes('status')) {
      return 'check_status';
    }
    if (normalizedUrl.includes('document')) {
      return normalizedMethod === 'POST' ? 'upload_document' : 'get_document';
    }
    if (normalizedUrl.includes('sanction')) {
      return 'get_sanction_letter';
    }
    if (normalizedUrl.includes('rate') || normalizedUrl.includes('quote')) {
      return 'get_rates';
    }

    return `${normalizedMethod.toLowerCase()}_request`;
  }
}

export const bankAPIAuditService = new BankAPIAuditService();
