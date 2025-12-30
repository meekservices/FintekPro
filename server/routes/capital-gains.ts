import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { capitalGainsReports, insertCapitalGainsReportSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

export function registerCapitalGainsRoutes(app: Express): void {
  app.post("/api/nsdl/capital-gains", async (req, res) => {
    try {
      const { accountNumber, financialYear, fromDate, toDate } = req.body;

      if (!accountNumber || !financialYear) {
        return res.status(400).json({ error: "Account number and financial year are required" });
      }

      const mockCapitalGainsData = {
        accountNumber,
        financialYear,
        reportType: "capital_gains",
        source: "nsdl",
        summary: {
          totalShortTermGains: "125430.50",
          totalLongTermGains: "89750.25",
          totalDividend: "15600.00",
          totalTdsDeducted: "2340.75",
          totalTransactions: 45
        },
        transactions: [
          {
            id: "txn1",
            isin: "INE009A01021",
            companyName: "Infosys Limited",
            symbol: "INFY",
            transactionType: "sell",
            buyDate: "2022-03-15",
            sellDate: "2023-08-20",
            buyQuantity: 100,
            sellQuantity: 100,
            buyPrice: "1450.50",
            sellPrice: "1650.75",
            buyValue: "145050.00",
            sellValue: "165075.00",
            gainLoss: "20025.00",
            gainType: "long_term",
            tdsDeducted: "0.00"
          }
        ],
        generatedAt: new Date().toISOString()
      };

      res.json(mockCapitalGainsData);
    } catch (error) {
      console.error("Error fetching NSDL capital gains:", error);
      res.status(500).json({ error: "Failed to fetch capital gains data" });
    }
  });

  app.post("/api/cdsl/capital-gains", async (req, res) => {
    try {
      const { boid, financialYear, fromDate, toDate } = req.body;

      if (!boid || !financialYear) {
        return res.status(400).json({ error: "BOID and financial year are required" });
      }

      const mockCapitalGainsData = {
        boid,
        financialYear,
        reportType: "capital_gains",
        source: "cdsl",
        summary: {
          totalShortTermGains: "98765.25",
          totalLongTermGains: "156780.50",
          totalDividend: "12450.00",
          totalTdsDeducted: "1867.50",
          totalTransactions: 38
        },
        transactions: [
          {
            id: "ctxn1",
            isin: "INE040A01034",
            companyName: "HDFC Bank Limited",
            symbol: "HDFCBANK",
            transactionType: "sell",
            buyDate: "2021-11-10",
            sellDate: "2023-06-15",
            buyQuantity: 50,
            sellQuantity: 50,
            buyPrice: "1320.00",
            sellPrice: "1680.50",
            buyValue: "66000.00",
            sellValue: "84025.00",
            gainLoss: "18025.00",
            gainType: "long_term",
            tdsDeducted: "0.00"
          }
        ],
        generatedAt: new Date().toISOString()
      };

      res.json(mockCapitalGainsData);
    } catch (error) {
      console.error("Error fetching CDSL capital gains:", error);
      res.status(500).json({ error: "Failed to fetch capital gains data" });
    }
  });

  app.post("/api/capital-gains/save-report", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { report, source } = req.body;
      if (!report) {
        return res.status(400).json({ error: "Report data is required" });
      }

      const savedReport = await storage.createCapitalGainsReport({
        userId: req.user.id,
        financialYear: report.financialYear,
        source: source || 'nsdl',
        totalShortTermGains: report.summary?.totalShortTermGains || "0",
        totalLongTermGains: report.summary?.totalLongTermGains || "0",
        totalDividend: report.summary?.totalDividend || "0",
        totalTdsDeducted: report.summary?.totalTdsDeducted || "0",
        transactions: report.transactions || [],
        status: "completed"
      });

      res.status(201).json(savedReport);
    } catch (error) {
      console.error("Error saving capital gains report:", error);
      res.status(500).json({ error: "Failed to save capital gains report" });
    }
  });

  app.get("/api/capital-gains/reports", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const reports = await storage.getCapitalGainsReportsByUserId(req.user.id);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching capital gains reports:", error);
      res.status(500).json({ error: "Failed to fetch capital gains reports" });
    }
  });

  app.get("/api/capital-gains/reports/:reportId", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { reportId } = req.params;
      const report = await storage.getCapitalGainsReport(reportId);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching capital gains report:", error);
      res.status(500).json({ error: "Failed to fetch capital gains report" });
    }
  });

  app.delete("/api/capital-gains/reports/:reportId", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { reportId } = req.params;
      const report = await storage.getCapitalGainsReport(reportId);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(capitalGainsReports).where(eq(capitalGainsReports.id, reportId));
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting capital gains report:", error);
      res.status(500).json({ error: "Failed to delete capital gains report" });
    }
  });

  console.log("✅ Capital Gains routes registered");
}
