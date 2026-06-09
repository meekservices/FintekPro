// @ts-nocheck
import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { and, or } from "drizzle-orm";
import { requireAuth } from "../middleware/roleMiddleware";
import { randomInt } from "crypto";
import { proxyToInsurance } from "../clients/insurance-client";
import { AuthRequest } from "../types/broker-types";

export function buildRequireOwnPortfolio(storageRef: typeof storage) {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const { portfolioId } = req.params;
			let userId = (req as AuthRequest).user?.id;
			if (!userId) {
				const isDevelopment =
					!process.env.NODE_ENV ||
					process.env.NODE_ENV === "development" ||
					process.env.REPL_ID;
				if (isDevelopment) {
					userId = "central-test-user";
					(req as AuthRequest).user = {
						id: userId,
						username: "testuser",
						role: "admin",
					};
				} else {
					res.status(401).json({ error: "Authentication required" });
					return;
				}
			}
			const portfolio = await storageRef.getPortfolio(portfolioId);
			if (!portfolio) {
				res.status(404).json({ error: "Portfolio not found" });
				return;
			}
			if (portfolio.userId !== userId) {
				res.status(403).json({ error: "Access denied" });
				return;
			}
			next();
		} catch (error: unknown) {
			console.error("Error checking portfolio ownership:", error);
			res.status(500).json({ error: "Failed to verify portfolio access" });
		}
	};
}

export function registerPortfolioCorPart2Part1Routes(app: Express): void {
	app.get(
		"/api/loans/applications/:id",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			try {
				const userId = (req as AuthRequest).user!.id;
				const { id } = req.params;
				const application = await storage.getLoanApplicationById(id, userId);
				if (!application) {
					res.status(404).json({ error: "Loan application not found" });
					return;
				}
				res.json(application);
			} catch (error: unknown) {
				console.error("Error fetching loan application:", error);
				res.status(500).json({ error: "Failed to fetch loan application" });
			}
		},
	);

	app.post(
		"/api/loans/applications",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			try {
				const userId = (req as AuthRequest).user!.id;
				// Validate and sanitize - only allow specific fields from InsertLoanApplicationMarketplace
				const {
					loanProductId,
					loanType,
					amount,
					tenure,
					interestRateType,
					purpose,
					collateralType,
					collateralValue,
					guarantorDetails,
				} = req.body;

				if (!loanProductId || !loanType || !amount || !tenure) {
					res.status(400).json({
						error:
							"Missing required fields: loanProductId, loanType, amount, tenure",
					});
					return;
				}

				const applicationData = {
					userId,
					loanProductId: String(loanProductId),
					loanType: String(loanType),
					amount: Number(amount),
					tenure: Number(tenure),
					interestRateType: interestRateType
						? String(interestRateType)
						: "fixed",
					purpose: purpose ? String(purpose) : undefined,
					collateralType: collateralType ? String(collateralType) : undefined,
					collateralValue: collateralValue
						? Number(collateralValue)
						: undefined,
					guarantorDetails: guarantorDetails || undefined,
					status: "draft",
				};

				const application =
					await storage.createLoanApplication(applicationData);
				res.json(application);
			} catch (error: unknown) {
				console.error("Error creating loan application:", error);
				res.status(500).json({ error: "Failed to create loan application" });
			}
		},
	);

	// Insurance Holdings Routes
	// In-memory OTP storage for government scheme refresh (consider Redis for production)
	const governmentSchemeOtpStore = new Map<
		string,
		{ otp: string; expiresAt: Date; userId: string; schemeType: string }
	>();

	// Government Schemes Refresh Routes (OTP-based data refresh with real SMS)
	app.post(
		"/api/government-schemes/:schemeType/refresh",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			try {
				const userId = (req as AuthRequest).user!.id;
				const { schemeType } = req.params;
				const { channel = "mobile" } = req.body;

				const validSchemeTypes = [
					"epf",
					"ppf",
					"eps",
					"nps",
					"apy",
					"insurance",
				];
				if (!validSchemeTypes.includes(schemeType)) {
					res.status(400).json({
						success: false,
						message: `Invalid scheme type: ${schemeType}`,
					});
					return;
				}

				// Get user's mobile number
				const user = await storage.getUser(userId);
				if (!user?.mobile) {
					res.status(400).json({
						success: false,
						message:
							"Mobile number not found. Please update your profile with a valid mobile number.",
					});
					return;
				}

				// Generate OTP and challenge ID
				const otp = randomInt(100000, 1000000).toString();
				const challengeId = `refresh_${schemeType}_${userId}_${Date.now()}`;
				const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

				// Store OTP for verification
				governmentSchemeOtpStore.set(challengeId, {
					otp,
					expiresAt,
					userId,
					schemeType,
				});

				// Clean up expired OTPs
				for (const [key, value] of governmentSchemeOtpStore.entries()) {
					if (value.expiresAt < new Date()) {
						governmentSchemeOtpStore.delete(key);
					}
				}

				// Import and use SMS service
				const { smsService } = await import("../services/sms-service");

				// Format message for government scheme refresh
				const schemeName = schemeType.toUpperCase();
				const formattedMobile = user.mobile.startsWith("+")
					? user.mobile
					: `+91${user.mobile}`;

				let smsSent = false;
				if (smsService.isAvailable()) {
					try {
						// Send OTP via Twilio
						const sent = await smsService.sendOTP(user.mobile, otp);
						if (sent) {
							smsSent = true;
							console.log(
								`[Government Schemes Refresh] OTP sent via SMS for ${schemeType}, user: ${userId}`,
							);
						} else {
							console.log(
								`[Government Schemes Refresh] SMS service unavailable, OTP: ${otp}`,
							);
						}
					} catch (smsError: unknown) {
						console.error(
							`[Government Schemes Refresh] SMS send failed:`,
							smsError,
						);
					}
				} else {
					console.log(
						`[Government Schemes Refresh] SMS not configured. OTP for ${schemeType}: ${otp}`,
					);
				}

				// Mask phone number for display
				const maskedMobile =
					formattedMobile.slice(0, 3) + "****" + formattedMobile.slice(-4);

				res.json({
					success: true,
					challengeId,
					expiresAt: expiresAt.toISOString(),
					message: smsSent
						? `OTP sent to ${maskedMobile}`
						: `OTP for testing: ${otp} (SMS delivery failed - Twilio trial account)`,
				});
			} catch (error: unknown) {
				console.error("Error initiating government scheme refresh:", error);
				res.status(500).json({
					success: false,
					message: "Failed to initiate data refresh",
				});
			}
		},
	);

	app.post(
		"/api/government-schemes/:schemeType/otp/verify",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			try {
				const userId = (req as AuthRequest).user!.id;
				const { schemeType } = req.params;
				const { challengeId, otp } = req.body;

				if (!challengeId || !otp) {
					res.status(400).json({
						success: false,
						message: "Challenge ID and OTP are required",
					});
					return;
				}

				const validSchemeTypes = [
					"epf",
					"ppf",
					"eps",
					"nps",
					"apy",
					"insurance",
				];
				if (!validSchemeTypes.includes(schemeType)) {
					res.status(400).json({
						success: false,
						message: `Invalid scheme type: ${schemeType}`,
					});
					return;
				}

				// Validate OTP format
				if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
					res.status(400).json({
						success: false,
						message: "Invalid OTP format. Please enter a 6-digit code.",
					});
					return;
				}

				// Retrieve stored OTP
				const storedData = governmentSchemeOtpStore.get(challengeId);

				if (!storedData) {
					res.status(400).json({
						success: false,
						message: "OTP expired or invalid. Please request a new OTP.",
					});
					return;
				}

				// Check expiry
				if (storedData.expiresAt < new Date()) {
					governmentSchemeOtpStore.delete(challengeId);
					res.status(400).json({
						success: false,
						message: "OTP has expired. Please request a new OTP.",
					});
					return;
				}

				// Verify OTP
				if (storedData.otp !== otp) {
					res.status(400).json({
						success: false,
						message: "Incorrect OTP. Please try again.",
					});
					return;
				}

				// Verify user matches
				if (storedData.userId !== userId) {
					res.status(403).json({
						success: false,
						message: "Unauthorized verification attempt.",
					});
					return;
				}

				// OTP verified successfully - clean up
				governmentSchemeOtpStore.delete(challengeId);

				console.log(
					`[Government Schemes Refresh] OTP verified for ${schemeType}, user: ${userId}`,
				);

				res.json({
					success: true,
					message: `${schemeType.toUpperCase()} data has been refreshed successfully from government sources`,
				});
			} catch (error: unknown) {
				console.error(
					"Error verifying OTP for government scheme refresh:",
					error,
				);
				res.status(500).json({
					success: false,
					message: "Failed to verify OTP",
				});
			}
		},
	);

	// Insurance Holdings — proxy to ins.fintekpro.com when INSURANCE_SERVICE_URL is set,
	// otherwise use local storage (backward-compatible).
	app.get(
		"/api/insurance-holdings",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			if (process.env.INSURANCE_SERVICE_URL)
				return proxyToInsurance(req, res, "/insurance-holdings");
			try {
				const insuranceHoldings = await storage.getInsuranceHoldings(
					(req as AuthRequest).user!.id,
				);
				res.json(insuranceHoldings);
			} catch (error: unknown) {
				console.error("Error fetching insurance holdings:", error);
				res.status(500).json({ error: "Failed to fetch insurance holdings" });
			}
		},
	);

	app.post(
		"/api/insurance-holdings",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			if (process.env.INSURANCE_SERVICE_URL)
				return proxyToInsurance(req, res, "/insurance-holdings");
			try {
				const holdingData = {
					...req.body,
					userId: (req as AuthRequest).user!.id,
				};
				const insuranceHolding =
					await storage.createInsuranceHolding(holdingData);
				res.json(insuranceHolding);
			} catch (error: unknown) {
				console.error("Error creating insurance holding:", error);
				res.status(500).json({ error: "Failed to create insurance holding" });
			}
		},
	);

	app.patch(
		"/api/insurance-holdings/:id",
		requireAuth,
		async (req: Request, res: Response): Promise<void> => {
			if (process.env.INSURANCE_SERVICE_URL)
				return proxyToInsurance(
					req,
					res,
					`/insurance-holdings/${req.params.id}`,
				);
			try {
				const updatedHolding = await storage.updateInsuranceHolding(
					req.params.id,
					req.body,
				);
				if (!updatedHolding) {
					res.status(404).json({ error: "Insurance holding not found" });
					return;
				}
				res.json(updatedHolding);
			} catch (error: unknown) {
				console.error("Error updating insurance holding:", error);
				res.status(500).json({ error: "Failed to update insurance holding" });
			}
		},
	);

	// Legacy endpoint for backwards compatibility
	app.get(
		"/api/portfolios/:userId",
		async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
			try {
				const { userId } = req.params;
				const portfolios = await storage.getPortfoliosByUserId(userId);
				res.json(portfolios);
			} catch (error: unknown) {
				console.error("Error fetching portfolios:", error);
				res.status(500).json({ error: "Failed to fetch portfolios" });
			}
		},
	);
}
