import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  auditHashChain,
  kycVerificationAttempts,
  complianceAuditTrail,
  ibOrders,
  aaConsents,
  aaDataFetchLogs,
} from "@shared/schema";
import { desc, and, gte, lte, eq, sql, count, like } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

export function registerAdminAuditRoutes(app: Express) {
  
  // GET /api/admin/audit/data-access - Query data access audit trail
  app.get("/api/admin/audit/data-access", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, userId, action, limit = 100 } = req.query;
      
      // Query compliance audit trail for data access events
      let query = db
        .select()
        .from(complianceAuditTrail)
        .orderBy(desc(complianceAuditTrail.createdAt))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(complianceAuditTrail.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(complianceAuditTrail.createdAt, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(complianceAuditTrail.userId, userId as string));
      }
      if (action) {
        conditions.push(eq(complianceAuditTrail.action, action as string));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(complianceAuditTrail)
          .where(and(...conditions))
          .orderBy(desc(complianceAuditTrail.createdAt))
          .limit(parseInt(limit as string)) as any;
      }
      
      const logs = await query;
      
      res.json({ logs, count: logs.length });
    } catch (error) {
      logger.error('Error querying data access audit trail', { error: String(error) });
      res.status(500).json({ message: "Error querying audit trail" });
    }
  });
  
  // GET /api/admin/audit/kyc-verification - Query KYC verification audit trail
  app.get("/api/admin/audit/kyc-verification", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, userId, method, outcome, limit = 100 } = req.query;
      
      let query = db
        .select()
        .from(kycVerificationAttempts)
        .orderBy(desc(kycVerificationAttempts.attemptedAt))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(kycVerificationAttempts.attemptedAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(kycVerificationAttempts.attemptedAt, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(kycVerificationAttempts.userId, userId as string));
      }
      if (method) {
        conditions.push(eq(kycVerificationAttempts.verificationMethod, method as string));
      }
      if (outcome) {
        conditions.push(eq(kycVerificationAttempts.outcome, outcome as string));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(kycVerificationAttempts)
          .where(and(...conditions))
          .orderBy(desc(kycVerificationAttempts.attemptedAt))
          .limit(parseInt(limit as string)) as any;
      }
      
      const attempts = await query;
      
      res.json({ attempts, count: attempts.length });
    } catch (error) {
      logger.error('Error querying KYC verification audit trail', { error: String(error) });
      res.status(500).json({ message: "Error querying KYC audit trail" });
    }
  });
  
  // GET /api/admin/audit/mf-orders - Query mutual fund order execution trail
  app.get("/api/admin/audit/mf-orders", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, userId, productType, status, limit = 100 } = req.query;
      
      let query = db
        .select()
        .from(ibOrders)
        .orderBy(desc(ibOrders.createdAt))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(ibOrders.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(ibOrders.createdAt, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(ibOrders.userId, userId as string));
      }
      if (status) {
        conditions.push(eq(ibOrders.status, status as string));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(ibOrders)
          .where(and(...conditions))
          .orderBy(desc(ibOrders.createdAt))
          .limit(parseInt(limit as string)) as any;
      }
      
      const orderLogs = await query;
      
      res.json({ orders: orderLogs, count: orderLogs.length });
    } catch (error) {
      logger.error('Error querying MF order audit trail', { error: String(error) });
      res.status(500).json({ message: "Error querying order audit trail" });
    }
  });
  
  // GET /api/admin/audit/consent-ledger - Query consent management audit trail (AA, eSign, KYC)
  app.get("/api/admin/audit/consent-ledger", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, userId, consentType, status, limit = 100 } = req.query;
      
      let query = db
        .select()
        .from(aaConsents)
        .orderBy(desc(aaConsents.createdAt))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(aaConsents.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(aaConsents.createdAt, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(aaConsents.userId, userId as string));
      }
      if (status) {
        conditions.push(eq(aaConsents.consentStatus, status as string));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(aaConsents)
          .where(and(...conditions))
          .orderBy(desc(aaConsents.createdAt))
          .limit(parseInt(limit as string)) as any;
      }
      
      const consents = await query;
      
      res.json({ consents, count: consents.length });
    } catch (error) {
      logger.error('Error querying consent ledger', { error: String(error) });
      res.status(500).json({ message: "Error querying consent ledger" });
    }
  });
  
  // GET /api/admin/audit/third-party-api - Query third-party API call audit trail
  app.get("/api/admin/audit/third-party-api", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, service, status, limit = 100 } = req.query;
      
      // Query AA data fetch logs as proxy for third-party API calls
      let query = db
        .select()
        .from(aaDataFetchLogs)
        .orderBy(desc(aaDataFetchLogs.createdAt))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(aaDataFetchLogs.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(aaDataFetchLogs.createdAt, new Date(endDate as string)));
      }
      if (status) {
        conditions.push(eq(aaDataFetchLogs.fetchStatus, status as string));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(aaDataFetchLogs)
          .where(and(...conditions))
          .orderBy(desc(aaDataFetchLogs.createdAt))
          .limit(parseInt(limit as string)) as any;
      }
      
      const apiLogs = await query;
      
      res.json({ logs: apiLogs, count: apiLogs.length });
    } catch (error) {
      logger.error('Error querying third-party API audit trail', { error: String(error) });
      res.status(500).json({ message: "Error querying API audit trail" });
    }
  });
  
  // GET /api/admin/audit/hash-chain - Query and verify hash chain integrity
  app.get("/api/admin/audit/hash-chain", async (req: Request, res: Response) => {
    try {
      const { auditType, startSeq, endSeq, limit = 100 } = req.query;
      
      let query = db
        .select()
        .from(auditHashChain)
        .orderBy(desc(auditHashChain.sequenceNumber))
        .limit(parseInt(limit as string));
      
      const conditions = [];
      
      if (auditType) {
        conditions.push(eq(auditHashChain.auditType, auditType as string));
      }
      if (startSeq) {
        conditions.push(gte(auditHashChain.sequenceNumber, parseInt(startSeq as string)));
      }
      if (endSeq) {
        conditions.push(lte(auditHashChain.sequenceNumber, parseInt(endSeq as string)));
      }
      
      if (conditions.length > 0) {
        query = db
          .select()
          .from(auditHashChain)
          .where(and(...conditions))
          .orderBy(desc(auditHashChain.sequenceNumber))
          .limit(parseInt(limit as string)) as any;
      }
      
      const chain = await query;
      
      // Verify hash chain integrity
      let isIntact = true;
      for (let i = chain.length - 1; i > 0; i--) {
        const current = chain[i - 1];
        const previous = chain[i];
        
        if (current.previousHash !== previous.currentHash) {
          isIntact = false;
          break;
        }
      }
      
      res.json({ 
        chain, 
        count: chain.length,
        integrity: isIntact ? 'valid' : 'broken',
      });
    } catch (error) {
      logger.error('Error querying hash chain', { error: String(error) });
      res.status(500).json({ message: "Error querying hash chain" });
    }
  });
  
  // POST /api/admin/audit/hash-chain/verify - Verify specific audit record in hash chain
  app.post("/api/admin/audit/hash-chain/verify", async (req: Request, res: Response) => {
    try {
      const { recordId } = req.body;
      
      const chainRecord = await db
        .select()
        .from(auditHashChain)
        .where(eq(auditHashChain.auditRecordId, recordId))
        .limit(1);
      
      if (chainRecord.length === 0) {
        return res.status(404).json({ message: "Audit record not found in hash chain" });
      }
      
      const record = chainRecord[0];
      
      // Verify record hash
      const recordHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(record.recordSnapshot))
        .digest('hex');
      
      const recordIntact = recordHash === record.recordHash;
      
      // Verify chain linkage
      if (record.previousHash) {
        const previousRecord = await db
          .select()
          .from(auditHashChain)
          .where(eq(auditHashChain.sequenceNumber, record.sequenceNumber - 1))
          .limit(1);
        
        if (previousRecord.length > 0) {
          const chainIntact = record.previousHash === previousRecord[0].currentHash;
          
          return res.json({
            verified: recordIntact && chainIntact,
            recordIntact,
            chainIntact,
            record,
          });
        }
      }
      
      res.json({
        verified: recordIntact,
        recordIntact,
        chainIntact: true, // First record in chain
        record,
      });
    } catch (error) {
      logger.error('Error verifying hash chain record', { error: String(error) });
      res.status(500).json({ message: "Error verifying record" });
    }
  });
  
  // POST /api/admin/audit/export - Export audit logs in regulator formats
  app.post("/api/admin/audit/export", async (req: Request, res: Response) => {
    try {
      const { format, auditType, startDate, endDate } = req.body;
      
      // TODO: Implement actual export generation for AMFI, SEBI, CSV, PDF formats
      // For now, return a mock response
      
      const exportData = {
        format,
        auditType,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString(),
        recordCount: 0,
        downloadUrl: '/api/admin/audit/download/mock-export.pdf',
      };
      
      logger.info('Audit export requested', { format, auditType, startDate, endDate });
      
      res.json(exportData);
    } catch (error) {
      logger.error('Error generating audit export', { error: String(error) });
      res.status(500).json({ message: "Error generating export" });
    }
  });
  
  // POST /api/admin/audit/sign-off - Mark audit records as compliance sign-off
  app.post("/api/admin/audit/sign-off", async (req: Request, res: Response) => {
    try {
      const { recordIds, signOffNotes } = req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // TODO: Implement compliance sign-off tracking
      // For now, log the sign-off
      logger.info('Compliance sign-off', { 
        recordIds, 
        signOffNotes, 
        signedOffBy: userId,
        timestamp: new Date().toISOString(),
      });
      
      res.json({ 
        message: "Records marked as signed off",
        signedOffCount: recordIds.length,
      });
    } catch (error) {
      logger.error('Error processing compliance sign-off', { error: String(error) });
      res.status(500).json({ message: "Error processing sign-off" });
    }
  });
}
