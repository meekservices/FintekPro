import { Router, Request, Response } from "express";
import { unifiedBrokerReportService } from "../services/reports/unified-broker-report-service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const comprehensiveReportsRouter = Router();

// GET /api/reports/tax-pnl
comprehensiveReportsRouter.get("/tax-pnl", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.id || (req.query.userId as string);
		if (!userId) {
			res.status(401).json({ success: false, error: "Authentication required" });
			return;
		}

		const financialYear = (req.query.financialYear as string) || "2024-2025";
		const quarter = (req.query.quarter as string) || "all";

		const summary = await unifiedBrokerReportService.getTaxPnlStatement({
			userId,
			financialYear,
			quarter,
		});

		res.json({ success: true, data: summary });
	} catch (error: any) {
		console.error("[ComprehensiveReports] Error fetching tax pnl:", error);
		res.status(500).json({ success: false, error: error.message || "Failed to generate Tax P&L statement" });
	}
});

// GET /api/reports/tax-pnl/download?format=xlsx|pdf
comprehensiveReportsRouter.get("/tax-pnl/download", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.id || (req.query.userId as string);
		if (!userId) {
			res.status(401).json({ success: false, error: "Authentication required" });
			return;
		}

		const financialYear = (req.query.financialYear as string) || "2024-2025";
		const quarter = (req.query.quarter as string) || "all";
		const format = (req.query.format as string)?.toLowerCase() || "xlsx";

		const statement = await unifiedBrokerReportService.getTaxPnlStatement({
			userId,
			financialYear,
			quarter,
		});

		if (format === "xlsx") {
			const buffer = await unifiedBrokerReportService.generateTaxPnlExcel(statement);
			res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
			res.setHeader("Content-Disposition", `attachment; filename="FintekPro_Tax_PnL_${financialYear}_${quarter}.xlsx"`);
			res.send(buffer);
		} else {
			// Generate Institutional PDF
			const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
			doc.setFontSize(18);
			doc.setTextColor(20, 40, 80);
			doc.text("FintekPro Wealth Systems", 40, 45);

			doc.setFontSize(12);
			doc.setTextColor(100);
			doc.text(`Tax P&L Statement | FY: ${statement.financialYear} | Quarter: ${statement.quarter.toUpperCase()}`, 40, 65);
			doc.text(`Client: ${statement.userName} | PAN: ${statement.userPan}`, 40, 82);

			autoTable(doc, {
				startY: 100,
				head: [["Tax Metric", "Amount (INR)", "Applicable Law / Provision"]],
				body: [
					["Equity Delivery STCG", `Rs. ${statement.equityDeliverySTCG.toLocaleString()}`, "Sec 111A (Taxable @ 20%)"],
					["Equity Delivery LTCG Gross", `Rs. ${statement.equityDeliveryLTCG.toLocaleString()}`, "Sec 112A (Gross Realized)"],
					["LTCG Exemption (up to 1.25L)", `Rs. ${statement.equityDeliveryLTCGExempt.toLocaleString()}`, "Sec 112A (Statutory Exemption)"],
					["LTCG Net Taxable", `Rs. ${statement.equityDeliveryLTCGTaxable.toLocaleString()}`, "Sec 112A (Taxable @ 12.5%)"],
					["Intraday Speculative PnL", `Rs. ${statement.intradaySpeculativePnl.toLocaleString()}`, "Sec 43(5) (Taxable at Slab)"],
					["F&O Non-Speculative PnL", `Rs. ${statement.fnoNonSpeculativePnl.toLocaleString()}`, "Sec 28 (Business Income)"],
					["F&O Trading Turnover", `Rs. ${statement.fnoTurnoverSec44AB.toLocaleString()}`, statement.taxAuditApplicable ? "Tax Audit Mandatory (> 10 Cr)" : "Audit Not Applicable (<= 10 Cr)"],
					["Total Statutory Levies (STT, Stamp, GST)", `Rs. ${statement.totalStatutoryCharges.total.toLocaleString()}`, "Regulatory Trading Expenses"],
					["NET REALISED TRADING P&L", `Rs. ${statement.totalNetPnl.toLocaleString()}`, "Net Gain/Loss post all costs"],
					["ESTIMATED CAPITAL GAINS TAX", `Rs. ${statement.estimatedTaxLiability.toLocaleString()}`, "Sec 111A (20%) + Sec 112A (12.5%)"],
				],
				theme: "striped",
				headStyles: { fillColor: [30, 58, 138] },
			});

			const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", `attachment; filename="FintekPro_Tax_PnL_${financialYear}.pdf"`);
			res.send(pdfBuffer);
		}
	} catch (error: any) {
		console.error("[ComprehensiveReports] Error downloading tax pnl:", error);
		res.status(500).json({ success: false, error: error.message || "Failed to download Tax P&L statement" });
	}
});

// GET /api/reports/financial-ledger
comprehensiveReportsRouter.get("/financial-ledger", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.id || (req.query.userId as string);
		if (!userId) {
			res.status(401).json({ success: false, error: "Authentication required" });
			return;
		}

		const startDate = req.query.startDate as string;
		const endDate = req.query.endDate as string;
		const category = req.query.category as string;

		const ledger = await unifiedBrokerReportService.getFinancialLedger({
			userId,
			startDate,
			endDate,
			category,
		});

		res.json({ success: true, data: ledger });
	} catch (error: any) {
		console.error("[ComprehensiveReports] Error fetching financial ledger:", error);
		res.status(500).json({ success: false, error: error.message || "Failed to generate Financial Ledger" });
	}
});

// GET /api/reports/financial-ledger/download?format=xlsx|pdf
comprehensiveReportsRouter.get("/financial-ledger/download", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.id || (req.query.userId as string);
		if (!userId) {
			res.status(401).json({ success: false, error: "Authentication required" });
			return;
		}

		const startDate = req.query.startDate as string;
		const endDate = req.query.endDate as string;
		const category = req.query.category as string;
		const format = (req.query.format as string)?.toLowerCase() || "xlsx";

		const ledger = await unifiedBrokerReportService.getFinancialLedger({
			userId,
			startDate,
			endDate,
			category,
		});

		if (format === "xlsx") {
			const buffer = await unifiedBrokerReportService.generateFinancialLedgerExcel(ledger);
			res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
			res.setHeader("Content-Disposition", `attachment; filename="FintekPro_Financial_Ledger.xlsx"`);
			res.send(buffer);
		} else {
			const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
			doc.setFontSize(18);
			doc.setTextColor(20, 40, 80);
			doc.text("FintekPro Wealth Systems", 40, 45);

			doc.setFontSize(12);
			doc.setTextColor(100);
			doc.text(`Financial Running Ledger | Period: ${ledger.startDate} to ${ledger.endDate}`, 40, 65);
			doc.text(`Client: ${ledger.userName} | PAN: ${ledger.pan}`, 40, 82);

			const rows = ledger.entries.map((e) => [
				e.voucherNumber,
				e.date,
				e.category,
				e.particulars,
				e.debit > 0 ? `Rs. ${e.debit.toLocaleString()}` : "-",
				e.credit > 0 ? `Rs. ${e.credit.toLocaleString()}` : "-",
				`Rs. ${e.runningBalance.toLocaleString()}`,
			]);

			autoTable(doc, {
				startY: 100,
				head: [["Vch No", "Date", "Category", "Particulars", "Debit", "Credit", "Balance"]],
				body: rows,
				theme: "striped",
				headStyles: { fillColor: [30, 58, 138] },
				styles: { fontSize: 8 },
			});

			const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", `attachment; filename="FintekPro_Financial_Ledger.pdf"`);
			res.send(pdfBuffer);
		}
	} catch (error: any) {
		console.error("[ComprehensiveReports] Error downloading financial ledger:", error);
		res.status(500).json({ success: false, error: error.message || "Failed to download Financial Ledger" });
	}
});

export default comprehensiveReportsRouter;
