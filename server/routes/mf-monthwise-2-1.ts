// @ts-nocheck
import { Express } from "express";
import { randomInt } from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { amfiService } from "../amfi-service";
import { auditLogArchivalService } from "../services/audit-log-archival";
import { marketingService } from "../marketing-automation";
import { whatsappService } from "../whatsapp";

export function registerMFMonthwiPart2Part1Routes(app: Express): void {
	app.get("/api/cams/schemes/:schemeCode?", async (req, res) => {
		try {
			const { schemeCode } = req.params;

			const schemes = await camsApi.getSchemeDetails(schemeCode);

			res.json({
				status: "success",
				data: schemes,
				count: schemes.length,
				message: "Scheme details fetched successfully",
			});
		} catch (error) {
			console.error("Error fetching CAMS scheme details:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch scheme details",
			});
		}
	});

	// Get NAV data from CAMS
	app.get("/api/cams/nav/:schemeCode", async (req, res) => {
		try {
			const { schemeCode } = req.params;
			const { date } = req.query;

			if (!schemeCode) {
				return res.status(400).json({
					status: "error",
					error: "Scheme code is required",
				});
			}

			const navData = await camsApi.getNavData(schemeCode, date as string);

			res.json({
				status: "success",
				data: navData,
				message: "NAV data fetched successfully",
			});
		} catch (error) {
			console.error("Error fetching CAMS NAV data:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch NAV data",
			});
		}
	});

	// Validate investor through CAMS
	app.get("/api/cams/investor/validate/:pan", async (req, res) => {
		try {
			const { pan } = req.params;

			if (!pan) {
				return res.status(400).json({
					status: "error",
					error: "PAN number is required",
				});
			}

			const validation = await camsApi.validateInvestor(pan);

			res.json({
				status: "success",
				data: validation,
				message: validation.isValid
					? "Investor validated successfully"
					: "Invalid investor PAN",
			});
		} catch (error) {
			console.error("Error validating investor through CAMS:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to validate investor",
			});
		}
	});

	// Generate consolidated statement through CAMS
	app.post("/api/cams/statement/generate", async (req, res) => {
		try {
			const { pan, fromDate, toDate, format } = req.body;

			if (!pan || !fromDate || !toDate) {
				return res.status(400).json({
					status: "error",
					error: "PAN, from date, and to date are required",
				});
			}

			const statement = await camsApi.getConsolidatedStatement(
				pan,
				fromDate,
				toDate,
				format || "PDF",
			);

			res.json({
				status: "success",
				data: statement,
				message: "Statement generated successfully",
			});
		} catch (error) {
			console.error("Error generating CAMS statement:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to generate statement",
			});
		}
	});

	// CAMS capital gains report
	app.get("/api/cams/capital-gains", async (req, res) => {
		try {
			const { pan, financialYear, transactionType, folioNumber } = req.query;

			// Simulate CAMS mutual fund capital gains data
			const camsCapitalGains = [
				{
					id: "cams-cg-1",
					pan: pan || "ABCDE1234F",
					folioNumber: "CAM123456789",
					schemeCode: "FRAN-INDIA-G",
					schemeName: "Franklin India Bluechip Fund - Growth",
					isin: "INF154K01014",
					amcName:
						"Franklin Templeton Asset Management (India) Private Limited",
					registrar: "CAMS",
					financialYear: "2024-25",
					transactionType: "LONG_TERM",
					purchaseDate: "2023-03-20",
					redemptionDate: "2024-08-25",
					purchaseNav: 580.75,
					redemptionNav: 642.9,
					units: 172.46,
					purchaseValue: 100143.55,
					redemptionValue: 110846.93,
					exitLoad: 0, // No exit load for > 1 year
					otherCharges: 18.75,
					grossGain: 10703.38,
					netRealizedGain: 10684.63,
					taxableGain: 10684.63,
					taxRate: 12.5, // LTCG tax rate for equity mutual funds
					taxLiability: 1335.58,
					netGainAfterTax: 9349.05,
					holdingPeriod: 523, // days
					category: "Large Cap Equity",
				},
				{
					id: "cams-cg-2",
					pan: pan || "ABCDE1234F",
					folioNumber: "CAM987654321",
					schemeCode: "INVESCO-CONTRA-G",
					schemeName: "Invesco India Contra Fund - Growth",
					isin: "INF220K01015",
					amcName: "Invesco Asset Management (India) Private Limited",
					registrar: "CAMS",
					financialYear: "2024-25",
					transactionType: "SHORT_TERM",
					purchaseDate: "2024-01-15",
					redemptionDate: "2024-09-10",
					purchaseNav: 75.2,
					redemptionNav: 84.85,
					units: 1331.38,
					purchaseValue: 100119.78,
					redemptionValue: 112969.58,
					exitLoad: 338.91, // 1% exit load for < 1 year
					otherCharges: 28.5,
					grossGain: 12849.8,
					netRealizedGain: 12482.39,
					taxableGain: 12482.39,
					taxRate: 20, // STCG tax rate for equity mutual funds
					taxLiability: 2496.48,
					netGainAfterTax: 9985.91,
					holdingPeriod: 238, // days
					category: "Multi Cap Equity",
				},
				{
					id: "cams-cg-3",
					pan: pan || "ABCDE1234F",
					folioNumber: "CAM456789123",
					schemeCode: "MOTILAL-MIDCAP-G",
					schemeName: "Motilal Oswal Midcap Fund - Growth",
					isin: "INF769K01021",
					amcName: "Motilal Oswal Asset Management Company Limited",
					registrar: "CAMS",
					financialYear: "2024-25",
					transactionType: "LONG_TERM",
					purchaseDate: "2022-10-10",
					redemptionDate: "2024-06-20",
					purchaseNav: 42.15,
					redemptionNav: 56.8,
					units: 2375.44,
					purchaseValue: 100115.29,
					redemptionValue: 134924.99,
					exitLoad: 0,
					otherCharges: 22.25,
					grossGain: 34809.7,
					netRealizedGain: 34787.45,
					taxableGain: 34787.45,
					taxRate: 12.5,
					taxLiability: 4348.43,
					netGainAfterTax: 30439.02,
					holdingPeriod: 618, // days
					category: "Mid Cap Equity",
				},
				{
					id: "cams-cg-4",
					pan: pan || "ABCDE1234F",
					folioNumber: "CAM321654987",
					schemeCode: "ADITYA-LIQUID-G",
					schemeName: "Aditya Birla Sun Life Liquid Fund - Growth",
					isin: "INF209K01024",
					amcName: "Aditya Birla Sun Life Asset Management Company Limited",
					registrar: "CAMS",
					financialYear: "2024-25",
					transactionType: "SHORT_TERM",
					purchaseDate: "2024-05-15",
					redemptionDate: "2024-08-30",
					purchaseNav: 298.45,
					redemptionNav: 301.8,
					units: 335.45,
					purchaseValue: 100135.02,
					redemptionValue: 101240.11,
					exitLoad: 0, // No exit load for liquid funds
					otherCharges: 5.5,
					grossGain: 1105.09,
					netRealizedGain: 1099.59,
					taxableGain: 1099.59,
					taxRate: 20, // STCG tax rate (applicable to liquid/debt funds regardless of holding period)
					taxLiability: 219.92,
					netGainAfterTax: 879.67,
					holdingPeriod: 107, // days
					category: "Liquid Fund",
				},
			];

			// Filter by financial year if provided
			let filteredGains = camsCapitalGains;
			if (financialYear) {
				filteredGains = filteredGains.filter(
					(cg) => cg.financialYear === financialYear,
				);
			}
			if (transactionType) {
				filteredGains = filteredGains.filter(
					(cg) => cg.transactionType === transactionType,
				);
			}
			if (folioNumber) {
				filteredGains = filteredGains.filter(
					(cg) => cg.folioNumber === folioNumber,
				);
			}

			const summary = {
				totalTransactions: filteredGains.length,
				totalRealizedGains: filteredGains.reduce(
					(sum, cg) => sum + cg.netRealizedGain,
					0,
				),
				totalTaxLiability: filteredGains.reduce(
					(sum, cg) => sum + cg.taxLiability,
					0,
				),
				totalNetGainAfterTax: filteredGains.reduce(
					(sum, cg) => sum + cg.netGainAfterTax,
					0,
				),
				totalExitLoad: filteredGains.reduce((sum, cg) => sum + cg.exitLoad, 0),
				longTermGains: filteredGains.filter(
					(cg) => cg.transactionType === "LONG_TERM",
				).length,
				shortTermGains: filteredGains.filter(
					(cg) => cg.transactionType === "SHORT_TERM",
				).length,
				averageHoldingPeriod: Math.round(
					filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) /
						filteredGains.length,
				),
				schemeCategories: Array.from(
					new Set(filteredGains.map((cg) => cg.category)),
				),
			};

			res.json({
				status: "success",
				data: filteredGains,
				summary,
				registrar: "CAMS",
				searchCriteria: { pan, financialYear, transactionType, folioNumber },
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error fetching CAMS capital gains:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch CAMS capital gains data",
			});
		}
	});

	// NSDL API endpoints

	// Helper function for NSDL API calls
	async function fetchNSDL(endpoint: string, data?: any) {
		// In production, this would use actual NSDL credentials and endpoints
		// For demo purposes, we'll simulate NSDL responses
		console.log(`NSDL API Call: ${endpoint}`, data);

		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 500));

		return { status: "success", data: data || {} };
	}

	// NSDL Demat Account Services
	app.post("/api/nsdl/demat/account/open", async (req, res) => {
		try {
			const { clientName, pan, mobile, email, address, kycDocuments } =
				req.body;

			if (!clientName || !pan || !mobile) {
				return res.status(400).json({
					status: "error",
					error: "Client name, PAN, and mobile number are required",
				});
			}

			// Simulate NSDL Insta Demat Account Opening
			const accountData = {
				clientId: `CL${Date.now()}`,
				demateAccountNumber: `${Math.random().toString().slice(2, 16)}`,
				dpId: "IN300394",
				dpName: "Demo Depository Participant",
				clientName,
				pan,
				mobile,
				email,
				status: "ACTIVE",
				accountType: "SINGLE_HOLDING",
				openingDate: new Date().toISOString().split("T")[0],
				kycStatus: "COMPLETED",
				holdingNomination: "NOT_APPLICABLE",
			};

			await fetchNSDL("/account/open", accountData);

			res.json({
				status: "success",
				message: "NSDL Demat account opened successfully",
				data: accountData,
			});
		} catch (error) {
			console.error("Error opening NSDL demat account:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to open demat account",
			});
		}
	});

	app.get("/api/nsdl/demat/holdings/:accountNumber", async (req, res) => {
		try {
			const { accountNumber } = req.params;

			// Simulate NSDL holdings data
			const holdingsData = {
				accountNumber,
				dpId: "IN300394",
				clientName: "Demo Client",
				asOfDate: new Date().toISOString().split("T")[0],
				holdings: [
					{
						isin: "INE002A01018",
						securityName: "Reliance Industries Ltd",
						quantity: 100,
						marketValue: "267500.00",
						freeQuantity: 100,
						lockedQuantity: 0,
						pledgedQuantity: 0,
					},
					{
						isin: "INE009A01021",
						securityName: "Infosys Limited",
						quantity: 50,
						marketValue: "95000.00",
						freeQuantity: 45,
						lockedQuantity: 0,
						pledgedQuantity: 5,
					},
					{
						isin: "INE467B01029",
						securityName: "HDFC Bank Ltd",
						quantity: 75,
						marketValue: "127500.00",
						freeQuantity: 75,
						lockedQuantity: 0,
						pledgedQuantity: 0,
					},
				],
				totalMarketValue: "490000.00",
			};

			await fetchNSDL("/holdings/fetch", { accountNumber });

			res.json({
				status: "success",
				data: holdingsData,
			});
		} catch (error) {
			console.error("Error fetching NSDL holdings:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch holdings data",
			});
		}
	});

	// NSDL eDIS (Electronic Delivery Instruction Slip)
	app.post("/api/nsdl/edis/instruction", async (req, res) => {
		try {
			const { accountNumber, isin, quantity, brokerCode, tradeDate, otp } =
				req.body;

			if (!accountNumber || !isin || !quantity || !brokerCode || !otp) {
				return res.status(400).json({
					status: "error",
					error:
						"Account number, ISIN, quantity, broker code, and OTP are required",
				});
			}

			// Simulate eDIS instruction processing
			const edisInstruction = {
				instructionId: `DIS${Date.now()}`,
				accountNumber,
				isin,
				quantity,
				brokerCode,
				tradeDate,
				status: "APPROVED",
				processingDate: new Date().toISOString(),
				remarks: "Electronic Delivery Instruction processed successfully",
			};

			await fetchNSDL("/edis/submit", edisInstruction);

			res.json({
				status: "success",
				message: "eDIS instruction submitted successfully",
				data: edisInstruction,
			});
		} catch (error) {
			console.error("Error processing eDIS instruction:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to process delivery instruction",
			});
		}
	});

	app.post("/api/nsdl/edis/otp/generate", async (req, res) => {
		try {
			const { accountNumber, mobile } = req.body;

			if (!accountNumber || !mobile) {
				return res.status(400).json({
					status: "error",
					error: "Account number and mobile number are required",
				});
			}

			// Simulate OTP generation
			const otpData = {
				referenceId: `OTP${Date.now()}`,
				accountNumber,
				mobile,
				otp: Math.floor(100000 + Math.random() * 900000).toString(), // Demo OTP
				validityMinutes: 10,
				status: "SENT",
			};

			await fetchNSDL("/otp/generate", { accountNumber, mobile });

			res.json({
				status: "success",
				message: "OTP sent successfully to registered mobile number",
				data: {
					referenceId: otpData.referenceId,
					validityMinutes: otpData.validityMinutes,
				},
			});
		} catch (error) {
			console.error("Error generating OTP:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to generate OTP",
			});
		}
	});

	// NSDL Margin Pledge API
}
