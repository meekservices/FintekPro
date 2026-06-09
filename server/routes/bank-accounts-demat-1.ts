// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { requireLevel2 } from "../middleware/kyc-level-gate";
import {
	verifyBankAccountPennyDrop,
	validateIFSC,
	validateAccountNumber,
	isNameMatchAcceptable,
} from "../penny-drop-service";
import { lookupIFSC, isValidIFSCFormat } from "../ifsc-lookup-service";
import { ProductAccountService } from "../product-account-service";
import { BSEStarKYCService } from "../services/bse-star-kyc-service";
import { digilockerService } from "../services/digilockerService";

export function registerBankAccountsDemaPart1Routes(app: Express): void {
	app.get("/api/zoho-commerce/test", async (req, res) => {
		try {
			res.json({
				success: true,
				data: {
					message: "Zoho Commerce integration is ready for FintekPro",
					features: [
						"Product synchronization",
						"Order management",
						"Customer data sync",
						"Inventory tracking",
						"Payment processing",
						"Webhook support",
						"Financial product e-commerce",
					],
					status: "ready",
				},
			});
		} catch (error) {
			console.error("Error testing Zoho Commerce:", error);
			res.status(500).json({
				error: "Failed to test integration",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// MF Central API - Proposals Management
	app.get("/api/proposals/:portfolioId?", async (req: any, res) => {
		try {
			// Use development bypass for demo purposes
			const isDevelopment =
				!process.env.NODE_ENV ||
				process.env.NODE_ENV === "development" ||
				process.env.REPL_ID;
			if (!req.user && isDevelopment) {
				req.user = { id: "central-test-user" };
			}

			const { portfolioId } = req.params;

			res.json([]);
		} catch (error) {
			console.error("Error fetching proposals:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch investment proposals",
			});
		}
	});

	// Real-time Portfolio Performance API for confetti celebrations
	app.get("/api/portfolios/:portfolioId/performance", async (req: any, res) => {
		try {
			// Use development bypass for demo purposes
			const isDevelopment =
				!process.env.NODE_ENV ||
				process.env.NODE_ENV === "development" ||
				process.env.REPL_ID;
			if (!req.user && isDevelopment) {
				req.user = { id: "central-test-user" };
			}

			const { portfolioId } = req.params;

			// Simulate real-time portfolio performance with dynamic values
			const baseTime = Date.now();
			const timeVariation = Math.sin(baseTime / 30000) * 0.05; // Oscillates every 30 seconds
			const randomVariation = (Math.random() - 0.5) * 0.02; // ±1% random variation

			// Base portfolio values
			const baseValue = 2850000; // ₹28.5L base portfolio
			const baseReturns = 650000; // ₹6.5L base returns

			// Apply dynamic variations to simulate real-time changes
			const currentVariation = timeVariation + randomVariation;
			const totalValue = Math.round(baseValue * (1 + currentVariation));
			const totalReturns = Math.round(baseReturns * (1 + currentVariation));
			const returnPercentage =
				Math.round((totalReturns / (totalValue - totalReturns)) * 100 * 100) /
				100;

			// Today's gain simulation (more volatile for celebration triggers)
			const todayVariation =
				Math.sin(baseTime / 10000) * 0.03 + (Math.random() - 0.3) * 0.02; // Bias toward gains
			const todaysGain = Math.round(Math.max(0, baseValue * todayVariation));
			const todaysGainPercentage =
				Math.round((todaysGain / totalValue) * 100 * 100) / 100;

			const performance = {
				totalValue,
				totalReturns,
				returnPercentage,
				todaysGain,
				todaysGainPercentage,
				previousValue: totalValue - todaysGain, // For comparison
				investedAmount: totalValue - totalReturns,
				timestamp: new Date().toISOString(),
				// Add milestone information for confetti triggers
				milestoneReached: null,
				celebrationTrigger: false,
			};

			// Check for celebration triggers (simulated milestones)
			const profitMilestones = [100000, 500000, 1000000, 2500000, 5000000];
			const percentMilestones = [10, 25, 50, 75, 100];

			for (const milestone of profitMilestones) {
				if (
					totalReturns >= milestone &&
					Math.abs(totalReturns - milestone) < 50000
				) {
					performance.milestoneReached = `₹${(milestone / 100000).toFixed(0)}L Profit`;
					performance.celebrationTrigger = true;
					break;
				}
			}

			if (!performance.celebrationTrigger) {
				for (const milestone of percentMilestones) {
					if (
						returnPercentage >= milestone &&
						Math.abs(returnPercentage - milestone) < 2
					) {
						performance.milestoneReached = `${milestone}% Returns`;
						performance.celebrationTrigger = true;
						break;
					}
				}
			}

			res.json(performance);
		} catch (error) {
			console.error("Error fetching portfolio performance:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch portfolio performance",
			});
		}
	});

	// Execute investment proposals through MF Central API
	app.post("/api/proposals/execute", async (req: any, res) => {
		try {
			// Use development bypass for demo purposes
			const isDevelopment =
				!process.env.NODE_ENV ||
				process.env.NODE_ENV === "development" ||
				process.env.REPL_ID;
			if (!req.user && isDevelopment) {
				req.user = { id: "central-test-user" };
			}

			const { proposalIds, portfolioId } = req.body;

			if (
				!proposalIds ||
				!Array.isArray(proposalIds) ||
				proposalIds.length === 0
			) {
				return res.status(400).json({
					success: false,
					error: "Invalid proposal IDs provided",
				});
			}

			// Mock MF Central API transaction execution
			const executionResults = [];

			for (const proposalId of proposalIds) {
				// Simulate MF Central API call for each proposal
				const mockTransactionResult = {
					proposalId,
					transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
					status: "success",
					message: "Investment order placed successfully through MF Central",
					executedAt: new Date().toISOString(),
					mfCentralResponse: {
						orderStatus: "ACCEPTED",
						acknowledgmentNumber: `ACK${Date.now()}`,
						expectedSettlement: "T+1",
						unitAllocation: "T+3",
					},
				};

				executionResults.push(mockTransactionResult);

				// Add delay to simulate real API processing
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			// Log the execution for compliance
			console.log(
				`[MF Central] Executed ${proposalIds.length} proposals for portfolio ${portfolioId}:`,
				executionResults,
			);

			res.json({
				success: true,
				message: `Successfully executed ${proposalIds.length} investment proposals`,
				results: executionResults,
				summary: {
					totalProposals: proposalIds.length,
					successfulExecutions: executionResults.filter(
						(r) => r.status === "success",
					).length,
					failedExecutions: executionResults.filter(
						(r) => r.status === "failed",
					).length,
					processingTime: new Date().toISOString(),
				},
			});
		} catch (error) {
			console.error("Error executing proposals:", error);
			res.status(500).json({
				success: false,
				error: "Failed to execute investment proposals through MF Central API",
				details: error.message,
			});
		}
	});

	// IFSC Lookup Route
	// Lookup bank and branch details from IFSC code
	app.get("/api/ifsc/:code", async (req, res) => {
		try {
			const ifscCode = req.params.code;

			// Validate IFSC format
			if (!isValidIFSCFormat(ifscCode)) {
				return res.status(400).json({
					error: "Invalid IFSC code format",
					message: "IFSC code must be 11 characters (e.g., SBIN0001234)",
				});
			}

			// Lookup IFSC details
			const result = await lookupIFSC(ifscCode);

			if (!result.success) {
				return res.status(404).json({
					error: result.errorMessage || "IFSC code not found",
				});
			}

			res.json(result.data);
		} catch (error) {
			console.error("Error looking up IFSC:", error);
			res.status(500).json({
				error: "Failed to lookup IFSC code",
				message: error.message,
			});
		}
	});

	// Bank Account Management Routes
	// Regulatory info endpoint (must be before POST /api/bank-accounts)
	app.get("/api/bank-accounts/regulatory-info", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}
			const accounts = await storage.getUserBankAccounts(req.user.id);
			const activeAccounts = accounts.filter((a) => a.isActive);
			res.json({
				maxAccountsAllowed: 5,
				currentActiveAccounts: activeAccounts.length,
				remainingSlots: Math.max(0, 5 - activeAccounts.length),
				regulatoryBasis: {
					sebi: "SEBI Circular SEBI/HO/MIRSD/POD-1/P/CIR/2024/37 - Multiple bank account registration for trading/demat",
					amfi: "AMFI Best Practices Circular No. 135/BP/108/2023-24 - Maximum 5 bank accounts per investor for MF transactions",
					rbi: "RBI Master Direction on KYC - Bank account verification mandatory for financial transactions",
				},
				primaryAccount: activeAccounts.find((a) => a.isPrimary) || null,
				verifiedAccounts: activeAccounts.filter((a) => a.isVerified).length,
				pendingVerification: activeAccounts.filter((a) => !a.isVerified).length,
			});
		} catch (error) {
			console.error("Error fetching regulatory info:", error);
			res.status(500).json({ error: "Failed to fetch regulatory info" });
		}
	});

	// Get user bank accounts
	app.get("/api/bank-accounts", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const accounts = await storage.getUserBankAccounts(req.user.id);
			res.json(accounts);
		} catch (error) {
			console.error("Error fetching bank accounts:", error);
			res.status(500).json({ error: "Failed to fetch bank accounts" });
		}
	});

	// Create new bank account
	app.post("/api/bank-accounts", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			// Check if user already has 5 accounts (SEBI/AMFI regulatory limit)
			const existingAccounts = await storage.getUserBankAccounts(req.user.id);
			const activeExisting = existingAccounts.filter((a) => a.isActive);
			if (activeExisting.length >= 5) {
				return res.status(400).json({
					error: "Maximum of 5 bank accounts allowed per user",
					regulatoryBasis:
						"SEBI Circular SEBI/HO/MIRSD/POD-1/P/CIR/2024/37 & AMFI Best Practices Circular No. 135/BP/108/2023-24",
					currentCount: activeExisting.length,
					maxAllowed: 5,
				});
			}

			// Validate account number uniqueness for the user
			const duplicateAccount = activeExisting.find(
				(acc) => acc.accountNumber === req.body.accountNumber,
			);
			if (duplicateAccount) {
				return res.status(400).json({
					error: "Account number already exists for this user",
				});
			}

			const isFirstAccount = activeExisting.length === 0;
			const bankAccountData = {
				...req.body,
				userId: req.user!.id,
				isDefaultForMutualFunds: false,
				isDefaultForDematTransactions: false,
				isActive: true,
				isVerified: false,
				verificationStatus: "pending",
				isPrimary: isFirstAccount,
			};

			const account = await storage.createBankAccount(bankAccountData);
			res.status(201).json(account);
		} catch (error) {
			console.error("Error creating bank account:", error);
			res.status(500).json({ error: "Failed to create bank account" });
		}
	});

	// Update bank account
	app.put("/api/bank-accounts/:id", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const account = await storage.getBankAccount(req.params.id);
			if (!account) {
				return res.status(404).json({ error: "Bank account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const updatedAccount = await storage.updateBankAccount(
				req.params.id,
				req.body,
			);
			res.json(updatedAccount);
		} catch (error) {
			console.error("Error updating bank account:", error);
			res.status(500).json({ error: "Failed to update bank account" });
		}
	});

	// Delete bank account
	app.delete("/api/bank-accounts/:id", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const account = await storage.getBankAccount(req.params.id);
			if (!account) {
				return res.status(404).json({ error: "Bank account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			if (account.isPrimary) {
				const allAccounts = await storage.getUserBankAccounts(req.user.id);
				const otherActiveAccounts = allAccounts.filter(
					(a) => a.isActive && a.id !== account.id,
				);
				if (otherActiveAccounts.length > 0) {
					return res.status(400).json({
						error:
							"Cannot delete primary account while other accounts exist. Please set another account as primary first.",
					});
				}
			}

			const deleted = await storage.deleteBankAccount(req.params.id);
			if (deleted) {
				res.json({
					success: true,
					message: "Bank account deleted successfully",
				});
			} else {
				res.status(404).json({ error: "Bank account not found" });
			}
		} catch (error) {
			console.error("Error deleting bank account:", error);
			res.status(500).json({ error: "Failed to delete bank account" });
		}
	});

	// Set default bank account
	app.put("/api/bank-accounts/:id/set-default", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const account = await storage.getBankAccount(req.params.id);
			if (!account) {
				return res.status(404).json({ error: "Bank account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const { defaultType } = req.body;
			if (defaultType !== "mutualFunds" && defaultType !== "primary") {
				return res.status(400).json({
					error: "Invalid default type. Must be 'mutualFunds' or 'primary'",
				});
			}

			if (defaultType === "primary" && !account.isVerified) {
				return res.status(400).json({
					error: "Only verified accounts can be set as primary",
				});
			}

			const success = await storage.setDefaultBankAccount(
				req.params.id,
				defaultType,
			);
			if (success) {
				res.json({
					success: true,
					message: "Default account updated successfully",
				});
			} else {
				res.status(400).json({ error: "Failed to set default account" });
			}
		} catch (error) {
			console.error("Error setting default bank account:", error);
			res.status(500).json({ error: "Failed to set default bank account" });
		}
	});

	// Penny Drop Verification Routes
	// Verify bank account using penny drop
	app.post("/api/bank-accounts/verify-penny-drop", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { accountId } = req.body;
			if (!accountId) {
				return res.status(400).json({ error: "Account ID is required" });
			}

			const account = await storage.getBankAccount(accountId);
			if (!account) {
				return res.status(404).json({ error: "Bank account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Check verification attempts limit (max 3)
			if (account.verificationAttempts && account.verificationAttempts >= 3) {
				return res.status(429).json({
					error:
						"Maximum verification attempts exceeded. Please contact support.",
					maxAttemptsReached: true,
				});
			}

			// Validate bank details format
			if (!validateAccountNumber(account.accountNumber)) {
				return res.status(400).json({
					error: "Invalid account number format. Must be 9-18 digits.",
				});
			}

			if (!validateIFSC(account.ifscCode)) {
				return res.status(400).json({
					error:
						"Invalid IFSC code format. Must be 11 characters (e.g., SBIN0001234)",
				});
			}

			if (!account.accountHolderName) {
				return res.status(400).json({
					error: "Account holder name is required for verification",
				});
			}

			// Initiate penny drop verification
			const verificationResult = await verifyBankAccountPennyDrop(
				account.accountNumber,
				account.ifscCode,
				account.accountHolderName,
			);

			// Update verification attempts
			const newAttempts = (account.verificationAttempts || 0) + 1;

			if (verificationResult.success) {
				// Check if name match is acceptable (80% threshold)
				const nameMatch = verificationResult.nameMatchScore
					? isNameMatchAcceptable(verificationResult.nameMatchScore)
					: false;

				// Update account with verification results
				// Use the verified name from the bank as the official account holder name
				await storage.updateBankAccount(accountId, {
					accountHolderName: verificationResult.verifiedName, // Update to bank's verified name
					isVerified: nameMatch,
					verificationStatus: nameMatch ? "verified" : "failed",
					verificationDate: new Date(),
					pennyDropTransactionId: verificationResult.transactionId,
					pennyDropAmount: verificationResult.amount?.toString(),
					nameMatchScore: verificationResult.nameMatchScore,
					bankAccountStatus: verificationResult.accountStatus,
					verificationMethod: "penny_drop",
					verificationAttempts: newAttempts,
					lastVerificationAttempt: new Date(),
					providerResponse: verificationResult.providerResponse,
					verifiedAccountHolderName: verificationResult.verifiedName,
				});

				return res.json({
					success: true,
					verified: nameMatch,
					transactionId: verificationResult.transactionId,
					nameMatchScore: verificationResult.nameMatchScore,
					verifiedName: verificationResult.verifiedName,
					providedName: account.accountHolderName,
					accountStatus: verificationResult.accountStatus,
					message: nameMatch
						? "Bank account verified successfully"
						: `Name mismatch detected. Bank name: ${verificationResult.verifiedName}, Provided: ${account.accountHolderName}`,
					nameMatchAcceptable: nameMatch,
				});
			}
			// Verification failed - update attempts
			await storage.updateBankAccount(accountId, {
				isVerified: false,
				verificationStatus: "failed",
				verificationAttempts: newAttempts,
				lastVerificationAttempt: new Date(),
				providerResponse: verificationResult.providerResponse,
			});

			return res.status(400).json({
				success: false,
				error: verificationResult.errorMessage || "Verification failed",
				attemptsRemaining: Math.max(0, 3 - newAttempts),
			});
		} catch (error) {
			console.error("Error in penny drop verification:", error);
			res.status(500).json({ error: "Failed to verify bank account" });
		}
	});

	// Get bank account verification status
	app.get("/api/bank-accounts/:id/verification-status", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const account = await storage.getBankAccount(req.params.id);
			if (!account) {
				return res.status(404).json({ error: "Bank account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			res.json({
				accountId: account.id,
				isVerified: account.isVerified,
				verificationStatus: account.verificationStatus,
				verificationDate: account.verificationDate,
				verificationMethod: account.verificationMethod,
				verificationAttempts: account.verificationAttempts || 0,
				lastVerificationAttempt: account.lastVerificationAttempt,
				nameMatchScore: account.nameMatchScore,
				verifiedAccountHolderName: account.verifiedAccountHolderName,
				providedAccountHolderName: account.accountHolderName,
				bankAccountStatus: account.bankAccountStatus,
				transactionId: account.pennyDropTransactionId,
				maxAttemptsReached: (account.verificationAttempts || 0) >= 3,
			});
		} catch (error) {
			console.error("Error fetching verification status:", error);
			res.status(500).json({ error: "Failed to fetch verification status" });
		}
	});

	// Demat Account Management Routes
	// Get user demat accounts
	app.get("/api/demat-accounts", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const accounts = await storage.getUserDematAccounts(req.user.id);
			res.json(accounts);
		} catch (error) {
			console.error("Error fetching demat accounts:", error);
			res.status(500).json({ error: "Failed to fetch demat accounts" });
		}
	});

	// Create new demat account
	app.post("/api/demat-accounts", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			// Check if user already has 3 accounts (limit)
			const existingAccounts = await storage.getUserDematAccounts(req.user.id);
			if (existingAccounts.length >= 3) {
				return res.status(400).json({
					error: "Maximum of 3 demat accounts allowed per user",
				});
			}

			// Validate DP ID + Client ID uniqueness for the user
			const duplicateAccount = existingAccounts.find(
				(acc) =>
					acc.dpId === req.body.dpId && acc.clientId === req.body.clientId,
			);
			if (duplicateAccount) {
				return res.status(400).json({
					error: "Demat account with this DP ID and Client ID already exists",
				});
			}

			const dematAccountData = {
				...req.body,
				userId: req.user.id,
			};

			const newAccount = await storage.createDematAccount(dematAccountData);
			res.status(201).json(newAccount);
		} catch (error) {
			console.error("Error creating demat account:", error);
			res.status(500).json({ error: "Failed to create demat account" });
		}
	});

	// Update demat account
	app.put("/api/demat-accounts/:id", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const account = await storage.getDematAccount(req.params.id);
			if (!account) {
				return res.status(404).json({ error: "Demat account not found" });
			}

			if (account.userId !== req.user.id) {
				return res.status(403).json({ error: "Access denied" });
			}

			const updatedAccount = await storage.updateDematAccount(
				req.params.id,
				req.body,
			);
			if (updatedAccount) {
				res.json(updatedAccount);
			} else {
				res.status(404).json({ error: "Demat account not found" });
			}
		} catch (error) {
			console.error("Error updating demat account:", error);
			res.status(500).json({ error: "Failed to update demat account" });
		}
	});

	// Delete demat account
}
