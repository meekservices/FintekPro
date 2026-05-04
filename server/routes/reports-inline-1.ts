import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, count, inArray } from 'drizzle-orm';
import { MultiSourceMFService } from '../services/multisource-mf-service';

const multiSourceMFService = new MultiSourceMFService(storage);

export function registerReportsInlinePart1Routes(app: Express): void {
  app.get("/api/capital-gains-reports", async (req, res) => {
    try {
      const { userId, financialYear } = req.query;
      const reports = await storage.getCapitalGainsReports(
        userId as string,
        financialYear as string
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching capital gains reports:", error);
      res.status(500).json({ error: "Failed to fetch capital gains reports" });
    }
  });

  app.get("/api/capital-gains-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getCapitalGainsReport(id);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Capital gains report not found" });
      }
    } catch (error) {
      console.error("Error fetching capital gains report:", error);
      res.status(500).json({ error: "Failed to fetch capital gains report" });
    }
  });

  app.post("/api/capital-gains-reports", async (req, res) => {
    try {
      const report = await storage.createCapitalGainsReport(req.body);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating capital gains report:", error);
      res.status(500).json({ error: "Failed to create capital gains report" });
    }
  });

  app.put("/api/capital-gains-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.updateCapitalGainsReport(id, req.body);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Capital gains report not found" });
      }
    } catch (error) {
      console.error("Error updating capital gains report:", error);
      res.status(500).json({ error: "Failed to update capital gains report" });
    }
  });

  // Transaction Reports  
  app.get("/api/transaction-reports", async (req, res) => {
    try {
      const { userId, financialYear } = req.query;
      const reports = await storage.getTransactionReports(
        userId as string,
        financialYear as string
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching transaction reports:", error);
      res.status(500).json({ error: "Failed to fetch transaction reports" });
    }
  });

  app.get("/api/transaction-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getTransactionReport(id);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Transaction report not found" });
      }
    } catch (error) {
      console.error("Error fetching transaction report:", error);
      res.status(500).json({ error: "Failed to fetch transaction report" });
    }
  });

  app.post("/api/transaction-reports", async (req, res) => {
    try {
      const report = await storage.createTransactionReport(req.body);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating transaction report:", error);
      res.status(500).json({ error: "Failed to create transaction report" });
    }
  });

  app.put("/api/transaction-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.updateTransactionReport(id, req.body);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Transaction report not found" });
      }
    } catch (error) {
      console.error("Error updating transaction report:", error);
      res.status(500).json({ error: "Failed to update transaction report" });
    }
  });

  // Transaction Records
  app.get("/api/transaction-records/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const records = await storage.getTransactionRecords(reportId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching transaction records:", error);
      res.status(500).json({ error: "Failed to fetch transaction records" });
    }
  });

  app.get("/api/transaction-records/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { financialYear } = req.query;
      const records = await storage.getTransactionRecordsByUser(
        userId,
        financialYear as string
      );
      res.json(records);
    } catch (error) {
      console.error("Error fetching user transaction records:", error);
      res.status(500).json({ error: "Failed to fetch user transaction records" });
    }
  });

  app.post("/api/transaction-records", async (req, res) => {
    try {
      const record = await storage.createTransactionRecord(req.body);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating transaction record:", error);
      res.status(500).json({ error: "Failed to create transaction record" });
    }
  });

  // Capital Gains Report Download/Export
  app.get("/api/capital-gains-reports/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;
      
      const report = await storage.getCapitalGainsReport(id);
      if (!report) {
        return res.status(404).json({ error: "Capital gains report not found" });
      }

      const filename = `capital-gains-${report.financialYear}-${report.source}-${Date.now()}`;
      
      if (format === 'csv') {
        // Generate CSV content
        const csvContent = [
          'Financial Year,Source,Long Term Gains,Short Term Gains,Dividend,TDS Deducted,Status,Generated Date',
          `${report.financialYear},${report.source.toUpperCase()},${report.totalLongTermGains},${report.totalShortTermGains},${report.totalDividend},${report.totalTdsDeducted},${report.status},${report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-IN') : 'N/A'}`
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvContent);
      } else if (format === 'pdf') {
        // Mock PDF generation - in real implementation, use a PDF library
        const pdfContent = `Capital Gains Report\n\nFinancial Year: ${report.financialYear}\nSource: ${report.source.toUpperCase()}\nLong Term Gains: ₹${report.totalLongTermGains}\nShort Term Gains: ₹${report.totalShortTermGains}\nDividend: ₹${report.totalDividend}\nTDS Deducted: ₹${report.totalTdsDeducted}\nStatus: ${report.status}\nGenerated: ${report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-IN') : 'N/A'}`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfContent);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(report);
      }
    } catch (error) {
      console.error("Error downloading capital gains report:", error);
      res.status(500).json({ error: "Failed to download capital gains report" });
    }
  });

  // Transaction Report Download/Export
  app.get("/api/transaction-reports/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;
      
      const report = await storage.getTransactionReport(id);
      if (!report) {
        return res.status(404).json({ error: "Transaction report not found" });
      }

      const filename = `transaction-report-${report.financialYear}-${report.source}-${Date.now()}`;
      
      if (format === 'csv') {
        // Generate CSV content
        const csvContent = [
          'Financial Year,Source,Asset Type,Total Purchases,Total Redemptions,Total Switches,Dividend Received,Brokerage,Taxes,Transaction Count',
          `${report.financialYear},${report.source.toUpperCase()},${report.assetType},${report.totalPurchases},${report.totalRedemptions},${report.totalSwitches},${report.totalDividendReceived},${report.totalBrokerage},${report.totalTaxes},${report.transactionCount}`
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvContent);
      } else if (format === 'pdf') {
        // Mock PDF generation
        const pdfContent = `Transaction Report\n\nFinancial Year: ${report.financialYear}\nSource: ${report.source.toUpperCase()}\nAsset Type: ${report.assetType}\nTotal Purchases: ₹${report.totalPurchases}\nTotal Redemptions: ₹${report.totalRedemptions}\nTotal Switches: ₹${report.totalSwitches}\nDividend Received: ₹${report.totalDividendReceived}\nBrokerage: ₹${report.totalBrokerage}\nTaxes: ₹${report.totalTaxes}\nTransaction Count: ${report.transactionCount}`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfContent);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(report);
      }
    } catch (error) {
      console.error("Error downloading transaction report:", error);
      res.status(500).json({ error: "Failed to download transaction report" });
    }
  });

  // External API Integration Endpoints for Fetching Reports
  app.post("/api/reports/fetch-from-iris", async (req, res) => {
    try {
      const { userId, financialYear, panNumber } = req.body;
      
      // Mock external API call to IRIS KFintech
      // In real implementation, this would call IRIS KFintech API
      const mockReportData = {
        source: "iris",
        totalShortTermGains: "25000.00",
        totalLongTermGains: "75000.00",
        totalDividend: "12000.00",
        totalTdsDeducted: "2400.00",
        reportData: {
          summary: { totalGains: 100000, taxableShortTerm: 25000 },
          holdings: []
        },
        status: "completed"
      };

      const report = await storage.createCapitalGainsReport({
        userId,
        financialYear,
        reportType: "capital_gains",
        fetchedAt: new Date(),
        ...mockReportData
      });

      res.status(201).json({
        message: "Report fetched successfully from IRIS",
        report
      });
    } catch (error) {
      console.error("Error fetching from IRIS:", error);
      res.status(500).json({ error: "Failed to fetch report from IRIS" });
    }
  });

}
