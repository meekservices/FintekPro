import { Router, Request, Response } from "express";
import { auditStorage } from "./auditStorage";
import { logger } from "./logger";

const router = Router();

/**
 * Helper function to convert JSON data to CSV format
 */
function jsonToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Escape double quotes and wrap in quotes if contains comma, newline, or quote
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  };

  const headerRow = headers.join(',');
  const dataRows = data.map(row => 
    headers.map(header => escapeCSV(row[header])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Audit & Compliance Ledger Routes
 * Provides admin access to comprehensive audit trails with cursor-based pagination
 */

/**
 * GET /api/admin/audit/data-access
 * Get compliance audit trail (data access logs from complianceAuditTrail table)
 */
router.get("/data-access", async (req: Request, res: Response) => {
  try {
    const { userId, action, startDate, endDate, limit, cursor } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (action) filters.action = action as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getDataAccessLogs(filters, {
      limit: limit ? parseInt(limit as string) : 100,
      cursor: cursor as string,
    });

    logger.info("Data access logs fetched", {
      userId: (req.user as any)?.id,
      filters,
      resultCount: result.logs.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch data access logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch data access logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/kyc-verification
 * Get KYC verification attempt logs (from kycStateTransitions table)
 */
router.get("/kyc-verification", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, limit, cursor } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getKycVerificationLogs(filters, {
      limit: limit ? parseInt(limit as string) : 100,
      cursor: cursor as string,
    });

    logger.info("KYC verification logs fetched", {
      userId: (req.user as any)?.id,
      filters,
      resultCount: result.attempts.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch KYC verification logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC verification logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/mf-orders
 * Get mutual fund order execution audit logs (from unifiedOrders table)
 */
router.get("/mf-orders", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, limit, cursor } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getMfOrderExecutionLogs(filters, {
      limit: limit ? parseInt(limit as string) : 100,
      cursor: cursor as string,
    });

    logger.info("MF order logs fetched", {
      userId: (req.user as any)?.id,
      filters,
      resultCount: result.orders.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch MF order logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch MF order logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/aa-consent-ledger
 * Get Account Aggregator consent ledger (from panConsentAuditLog table)
 */
router.get("/aa-consent-ledger", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, limit, cursor } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getConsentLedgerLogs(filters, {
      limit: limit ? parseInt(limit as string) : 100,
      cursor: cursor as string,
    });

    logger.info("Consent ledger logs fetched", {
      userId: (req.user as any)?.id,
      filters,
      resultCount: result.consents.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch consent ledger logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch consent ledger logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/third-party-api
 * Get third-party API access logs (from auditLogs table)
 */
router.get("/third-party-api", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, limit, cursor } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getThirdPartyApiLogs(filters, {
      limit: limit ? parseInt(limit as string) : 100,
      cursor: cursor as string,
    });

    logger.info("Third-party API logs fetched", {
      userId: (req.user as any)?.id,
      filters,
      resultCount: result.logs.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch third-party API logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch third-party API logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/hash-chain-verify
 * Verify hash chain integrity of audit logs (tamper evidence)
 */
router.get("/hash-chain-verify", async (req: Request, res: Response) => {
  try {
    const { windowSize } = req.query;
    
    const result = await auditStorage.verifyHashChainIntegrity({
      windowSize: windowSize ? parseInt(windowSize as string) : 1000,
    });

    logger.info("Hash chain integrity verified", {
      userId: (req.user as any)?.id,
      result,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("Failed to verify hash chain integrity", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to verify hash chain integrity",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/export/data-access
 * Export data access logs as CSV
 */
router.get("/export/data-access", async (req: Request, res: Response) => {
  try {
    const { userId, action, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (action) filters.action = action as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    // Fetch all logs (no pagination limit for export)
    const result = await auditStorage.getDataAccessLogs(filters, { limit: 50000 });

    const headers = [
      'id', 'userId', 'action', 'resource', 'resourceId', 
      'ipAddress', 'userAgent', 'success', 'createdAt'
    ];

    const csv = jsonToCSV(result.logs, headers);

    logger.info("Data access logs exported to CSV", {
      userId: (req.user as any)?.id,
      filters,
      rowCount: result.logs.length,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=data-access-logs.csv');
    res.send(csv);
  } catch (error: any) {
    logger.error("Failed to export data access logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export data access logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/export/kyc-verification
 * Export KYC verification logs as CSV
 */
router.get("/export/kyc-verification", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getKycVerificationLogs(filters, { limit: 50000 });

    const headers = [
      'id', 'sessionId', 'userId', 'fromState', 'toState', 'trigger',
      'performedBy', 'performedByRole', 'ipAddress', 'userAgent', 'occurredAt'
    ];

    const csv = jsonToCSV(result.attempts, headers);

    logger.info("KYC verification logs exported to CSV", {
      userId: (req.user as any)?.id,
      filters,
      rowCount: result.attempts.length,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=kyc-verification-logs.csv');
    res.send(csv);
  } catch (error: any) {
    logger.error("Failed to export KYC verification logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export KYC verification logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/export/mf-orders
 * Export mutual fund order logs as CSV
 */
router.get("/export/mf-orders", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getMfOrderExecutionLogs(filters, { limit: 50000 });

    const headers = [
      'id', 'orderNumber', 'userId', 'productType', 'productName', 'orderType',
      'amount', 'status', 'arnCode', 'euinNumber', 'agentId', 'executedAt', 'createdAt'
    ];

    const csv = jsonToCSV(result.orders, headers);

    logger.info("MF order logs exported to CSV", {
      userId: (req.user as any)?.id,
      filters,
      rowCount: result.orders.length,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mf-order-logs.csv');
    res.send(csv);
  } catch (error: any) {
    logger.error("Failed to export MF order logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export MF order logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/export/aa-consent-ledger
 * Export consent ledger logs as CSV
 */
router.get("/export/aa-consent-ledger", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getConsentLedgerLogs(filters, { limit: 50000 });

    const headers = [
      'id', 'userId', 'action', 'status', 'panNumber', 'consentId',
      'fiuId', 'consentHandle', 'ipAddress', 'timestamp'
    ];

    const csv = jsonToCSV(result.consents, headers);

    logger.info("Consent ledger logs exported to CSV", {
      userId: (req.user as any)?.id,
      filters,
      rowCount: result.consents.length,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=consent-ledger-logs.csv');
    res.send(csv);
  } catch (error: any) {
    logger.error("Failed to export consent ledger logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export consent ledger logs",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/audit/export/third-party-api
 * Export third-party API logs as CSV
 */
router.get("/export/third-party-api", async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await auditStorage.getThirdPartyApiLogs(filters, { limit: 50000 });

    const headers = [
      'id', 'userId', 'action', 'resource', 'resourceId', 'operation',
      'status', 'ipAddress', 'userAgent', 'occurredAt'
    ];

    const csv = jsonToCSV(result.logs, headers);

    logger.info("Third-party API logs exported to CSV", {
      userId: (req.user as any)?.id,
      filters,
      rowCount: result.logs.length,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=third-party-api-logs.csv');
    res.send(csv);
  } catch (error: any) {
    logger.error("Failed to export third-party API logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to export third-party API logs",
      error: error.message,
    });
  }
});

export default router;
