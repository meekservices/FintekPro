import { Express } from "express";
import { bajajFinanceAPI } from "../bajaj-finance-api";
import { tataCapitalAPI } from "../tata-capital-api";
import { InsuranceMarketplaceAPI } from "../policybazaar-api";
import { CibilAPI } from "../cibil-api";
import {
	getPersonalizedLoanRecommendations,
	trackLoanRecommendationAction,
} from "../intelligent-loan-recommendations";
import { requireLevel1 } from "../middleware/kyc-level-gate";

export function registerLoanProvidersRoutes(app: Express): void {
	app.post("/api/bajaj-finance/calculate-emi", async (req, res) => {
		try {
			const { principal, interestRate, tenure } = req.body;

			if (!principal || !interestRate || !tenure) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: principal, interestRate, tenure",
					});
			}

			const result = bajajFinanceAPI.calculateEMI(
				Number(principal),
				Number(interestRate),
				Number(tenure),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating EMI:", error);
			res.status(500).json({ error: "Failed to calculate EMI" });
		}
	});

	// Personal Loan Calculator
	app.post("/api/bajaj-finance/personal-loan", async (req, res) => {
		try {
			const { amount, tenure } = req.body;

			if (!amount || !tenure) {
				return res
					.status(400)
					.json({ error: "Missing required parameters: amount, tenure" });
			}

			const result = bajajFinanceAPI.calculatePersonalLoan(
				Number(amount),
				Number(tenure),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating personal loan:", error);
			res.status(500).json({ error: "Failed to calculate personal loan" });
		}
	});

	// Business Loan Calculator
	app.post("/api/bajaj-finance/business-loan", async (req, res) => {
		try {
			const { amount, tenure, businessType } = req.body;

			if (!amount || !tenure || !businessType) {
				return res
					.status(400)
					.json({
						error: "Missing required parameters: amount, tenure, businessType",
					});
			}

			const result = bajajFinanceAPI.calculateBusinessLoan(
				Number(amount),
				Number(tenure),
				String(businessType),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating business loan:", error);
			res.status(500).json({ error: "Failed to calculate business loan" });
		}
	});

	// Fixed Deposit Calculator
	app.post("/api/bajaj-finance/fixed-deposit", async (req, res) => {
		try {
			const { amount, tenure, fdType = "regular" } = req.body;

			if (!amount || !tenure) {
				return res
					.status(400)
					.json({ error: "Missing required parameters: amount, tenure" });
			}

			const result = bajajFinanceAPI.calculateFD(
				Number(amount),
				Number(tenure),
				fdType as "regular" | "senior-citizen",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating FD:", error);
			res.status(500).json({ error: "Failed to calculate fixed deposit" });
		}
	});

	// Two Wheeler Loan Calculator
	app.post("/api/bajaj-finance/two-wheeler-loan", async (req, res) => {
		try {
			const { vehiclePrice, downPayment, tenure } = req.body;

			if (!vehiclePrice || !downPayment || !tenure) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: vehiclePrice, downPayment, tenure",
					});
			}

			const result = bajajFinanceAPI.calculateTwoWheelerLoan(
				Number(vehiclePrice),
				Number(downPayment),
				Number(tenure),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating two wheeler loan:", error);
			res.status(500).json({ error: "Failed to calculate two wheeler loan" });
		}
	});

	// Insurance Premium Calculator
	app.post("/api/bajaj-finance/insurance-premium", async (req, res) => {
		try {
			const { age, sumAssured, policyType } = req.body;

			if (!age || !sumAssured || !policyType) {
				return res
					.status(400)
					.json({
						error: "Missing required parameters: age, sumAssured, policyType",
					});
			}

			const result = bajajFinanceAPI.calculateInsurancePremium(
				Number(age),
				Number(sumAssured),
				policyType as "life" | "health" | "motor",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating insurance premium:", error);
			res.status(500).json({ error: "Failed to calculate insurance premium" });
		}
	});

	// SIP Calculator
	app.post("/api/bajaj-finance/sip-calculator", async (req, res) => {
		try {
			const { monthlyAmount, annualReturn, tenure } = req.body;

			if (!monthlyAmount || !annualReturn || !tenure) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: monthlyAmount, annualReturn, tenure",
					});
			}

			const result = bajajFinanceAPI.calculateSIP(
				Number(monthlyAmount),
				Number(annualReturn),
				Number(tenure),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating SIP:", error);
			res.status(500).json({ error: "Failed to calculate SIP" });
		}
	});

	// Get Current Interest Rates
	app.get("/api/bajaj-finance/interest-rates", async (req, res) => {
		try {
			const rates = bajajFinanceAPI.getCurrentRates();
			res.json({ success: true, data: rates });
		} catch (error) {
			console.error("Error fetching interest rates:", error);
			res.status(500).json({ error: "Failed to fetch interest rates" });
		}
	});

	// Loan Eligibility Checker
	app.post("/api/bajaj-finance/check-eligibility", async (req, res) => {
		try {
			const { salary, age, loanType } = req.body;

			if (!salary || !age || !loanType) {
				return res
					.status(400)
					.json({
						error: "Missing required parameters: salary, age, loanType",
					});
			}

			const result = bajajFinanceAPI.checkLoanEligibility(
				Number(salary),
				Number(age),
				String(loanType),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error checking loan eligibility:", error);
			res.status(500).json({ error: "Failed to check loan eligibility" });
		}
	});

	// ===========================================
	// TATA CAPITAL API ROUTES
	// ===========================================

	// Personal Loan Calculator
	app.post("/api/tata-capital/personal-loan", async (req, res) => {
		try {
			const { principal, tenure, employmentType } = req.body;

			if (!principal || !tenure || !employmentType) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: principal, tenure, employmentType",
					});
			}

			const result = tataCapitalAPI.calculatePersonalLoan(
				Number(principal),
				Number(tenure),
				employmentType as "salaried" | "self-employed",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating personal loan:", error);
			res.status(500).json({ error: "Failed to calculate personal loan" });
		}
	});

	// Home Loan Calculator
	app.post("/api/tata-capital/home-loan", async (req, res) => {
		try {
			const { principal, tenure, propertyType } = req.body;

			if (!principal || !tenure || !propertyType) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: principal, tenure, propertyType",
					});
			}

			const result = tataCapitalAPI.calculateHomeLoan(
				Number(principal),
				Number(tenure),
				propertyType as "ready" | "under-construction",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating home loan:", error);
			res.status(500).json({ error: "Failed to calculate home loan" });
		}
	});

	// Business Loan Calculator
	app.post("/api/tata-capital/business-loan", async (req, res) => {
		try {
			const { principal, tenure, businessVintage, turnover } = req.body;

			if (!principal || !tenure || !businessVintage || !turnover) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: principal, tenure, businessVintage, turnover",
					});
			}

			const result = tataCapitalAPI.calculateBusinessLoan(
				Number(principal),
				Number(tenure),
				Number(businessVintage),
				Number(turnover),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating business loan:", error);
			res.status(500).json({ error: "Failed to calculate business loan" });
		}
	});

	// Used Car Loan Calculator
	app.post("/api/tata-capital/used-car-loan", async (req, res) => {
		try {
			const { vehiclePrice, vehicleAge, downPayment, tenure } = req.body;

			if (
				!vehiclePrice ||
				vehicleAge === undefined ||
				!downPayment ||
				!tenure
			) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: vehiclePrice, vehicleAge, downPayment, tenure",
					});
			}

			const result = tataCapitalAPI.calculateUsedCarLoan(
				Number(vehiclePrice),
				Number(vehicleAge),
				Number(downPayment),
				Number(tenure),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating used car loan:", error);
			res.status(500).json({ error: "Failed to calculate used car loan" });
		}
	});

	// Loan Against Property Calculator
	app.post("/api/tata-capital/loan-against-property", async (req, res) => {
		try {
			const { propertyValue, loanAmount, tenure, propertyType } = req.body;

			if (!propertyValue || !loanAmount || !tenure || !propertyType) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: propertyValue, loanAmount, tenure, propertyType",
					});
			}

			const result = tataCapitalAPI.calculateLoanAgainstProperty(
				Number(propertyValue),
				Number(loanAmount),
				Number(tenure),
				propertyType as "residential" | "commercial",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating loan against property:", error);
			res
				.status(500)
				.json({ error: "Failed to calculate loan against property" });
		}
	});

	// Loan Against Securities Calculator
	app.post("/api/tata-capital/loan-against-securities", async (req, res) => {
		try {
			const { portfolioValue, loanAmount, securityType } = req.body;

			if (!portfolioValue || !loanAmount || !securityType) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: portfolioValue, loanAmount, securityType",
					});
			}

			const result = tataCapitalAPI.calculateLoanAgainstSecurities(
				Number(portfolioValue),
				Number(loanAmount),
				securityType as "equity" | "mutual-fund" | "bonds",
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error calculating loan against securities:", error);
			res
				.status(500)
				.json({ error: "Failed to calculate loan against securities" });
		}
	});

	// Credit Eligibility Check
	app.post("/api/tata-capital/check-eligibility", async (req, res) => {
		try {
			const { pan, income, loanType } = req.body;

			if (!pan || !income || !loanType) {
				return res
					.status(400)
					.json({
						error: "Missing required parameters: pan, income, loanType",
					});
			}

			const result = await tataCapitalAPI.checkCreditEligibility(
				String(pan),
				Number(income),
				String(loanType),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error checking credit eligibility:", error);
			res.status(500).json({ error: "Failed to check credit eligibility" });
		}
	});

	// GST Verification
	app.post("/api/tata-capital/verify-gst", async (req, res) => {
		try {
			const { gstin } = req.body;

			if (!gstin) {
				return res
					.status(400)
					.json({ error: "Missing required parameter: gstin" });
			}

			const result = await tataCapitalAPI.verifyGST(String(gstin));

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error verifying GST:", error);
			res.status(500).json({ error: "Failed to verify GST" });
		}
	});

	// Bank Statement Analysis
	app.post("/api/tata-capital/analyze-bank-statement", async (req, res) => {
		try {
			const { statements } = req.body;

			if (!statements) {
				return res
					.status(400)
					.json({ error: "Missing required parameter: statements" });
			}

			const result = tataCapitalAPI.analyzeBankStatement(statements);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error analyzing bank statement:", error);
			res.status(500).json({ error: "Failed to analyze bank statement" });
		}
	});

	// Outstanding Balance
	app.get(
		"/api/tata-capital/outstanding-balance/:loanAccountNumber",
		async (req, res) => {
			try {
				const { loanAccountNumber } = req.params;

				if (!loanAccountNumber) {
					return res.status(400).json({ error: "Missing loan account number" });
				}

				const result =
					await tataCapitalAPI.getOutstandingBalance(loanAccountNumber);

				res.json({ success: true, data: result });
			} catch (error) {
				console.error("Error fetching outstanding balance:", error);
				res.status(500).json({ error: "Failed to fetch outstanding balance" });
			}
		},
	);

	// Foreclosure Details
	app.get(
		"/api/tata-capital/foreclosure/:loanAccountNumber",
		async (req, res) => {
			try {
				const { loanAccountNumber } = req.params;

				if (!loanAccountNumber) {
					return res.status(400).json({ error: "Missing loan account number" });
				}

				const result =
					await tataCapitalAPI.getForeclosureDetails(loanAccountNumber);

				res.json({ success: true, data: result });
			} catch (error) {
				console.error("Error fetching foreclosure details:", error);
				res.status(500).json({ error: "Failed to fetch foreclosure details" });
			}
		},
	);

	// Account Aggregator Data
	app.get(
		"/api/tata-capital/account-aggregator/:customerId",
		async (req, res) => {
			try {
				const { customerId } = req.params;

				if (!customerId) {
					return res.status(400).json({ error: "Missing customer ID" });
				}

				const result =
					await tataCapitalAPI.getAccountAggregatorData(customerId);

				res.json({ success: true, data: result });
			} catch (error) {
				console.error("Error fetching account aggregator data:", error);
				res
					.status(500)
					.json({ error: "Failed to fetch account aggregator data" });
			}
		},
	);

	// CKYC Verification
	app.post("/api/tata-capital/ckyc-verification", async (req, res) => {
		try {
			const { ckycId } = req.body;

			if (!ckycId) {
				return res
					.status(400)
					.json({ error: "Missing required parameter: ckycId" });
			}

			const result = await tataCapitalAPI.performCKYC(String(ckycId));

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error performing CKYC verification:", error);
			res.status(500).json({ error: "Failed to perform CKYC verification" });
		}
	});

	// Create Lead
	app.post("/api/tata-capital/create-lead", async (req, res) => {
		try {
			const { name, mobile, email, loanType, loanAmount, city } = req.body;

			if (!name || !mobile || !email || !loanType || !loanAmount || !city) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: name, mobile, email, loanType, loanAmount, city",
					});
			}

			const result = await tataCapitalAPI.createLead({
				name: String(name),
				mobile: String(mobile),
				email: String(email),
				loanType: String(loanType),
				loanAmount: Number(loanAmount),
				city: String(city),
			});

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error creating lead:", error);
			res.status(500).json({ error: "Failed to create lead" });
		}
	});

	// Instant Disbursement
	app.post("/api/tata-capital/instant-disbursement", async (req, res) => {
		try {
			const { loanAccountNumber, amount, beneficiaryAccount } = req.body;

			if (!loanAccountNumber || !amount || !beneficiaryAccount) {
				return res
					.status(400)
					.json({
						error:
							"Missing required parameters: loanAccountNumber, amount, beneficiaryAccount",
					});
			}

			const result = await tataCapitalAPI.instantDisbursement(
				String(loanAccountNumber),
				Number(amount),
				String(beneficiaryAccount),
			);

			res.json({ success: true, data: result });
		} catch (error) {
			console.error("Error processing instant disbursement:", error);
			res.status(500).json({ error: "Failed to process instant disbursement" });
		}
	});

	// Get Current Interest Rates
	app.get("/api/tata-capital/interest-rates", async (req, res) => {
		try {
			const rates = tataCapitalAPI.getCurrentRates();
			res.json({ success: true, data: rates });
		} catch (error) {
			console.error("Error fetching Tata Capital interest rates:", error);
			res.status(500).json({ error: "Failed to fetch interest rates" });
		}
	});

	// PolicyBazaar API endpoints
	// Enhanced Insurance Marketplace API Routes
	app.post(
		"/api/policybazaar/quotes",
		InsuranceMarketplaceAPI.getInsuranceQuotes,
	);
	app.post(
		"/api/policybazaar/health-calculator",
		InsuranceMarketplaceAPI.calculateHealthInsurance,
	);
	app.post(
		"/api/policybazaar/life-calculator",
		InsuranceMarketplaceAPI.calculateLifeInsurance,
	);
	app.post(
		"/api/policybazaar/motor-calculator",
		InsuranceMarketplaceAPI.calculateMotorInsurance,
	);
	app.post(
		"/api/policybazaar/travel-calculator",
		InsuranceMarketplaceAPI.calculateTravelInsurance,
	);
	app.post(
		"/api/policybazaar/purchase",
		InsuranceMarketplaceAPI.purchasePolicy,
	);
	app.post("/api/policybazaar/status", InsuranceMarketplaceAPI.getPolicyStatus);

	// New Marketplace Features
	app.post(
		"/api/insurance/compare",
		requireLevel1,
		InsuranceMarketplaceAPI.compareInsurancePlans,
	);
	app.get("/api/insurance/providers/:type", requireLevel1, (req, res) => {
		const insuranceType = req.params.type;
		const providers = InsuranceMarketplaceAPI.getProvidersByType(insuranceType);
		res.json({ success: true, data: providers });
	});

	// CIBIL API endpoints
	app.post("/api/cibil/credit-score", CibilAPI.checkCreditScore);
	app.post("/api/cibil/detailed-report", CibilAPI.getDetailedReport);
	app.post("/api/cibil/monitoring", CibilAPI.setupCreditMonitoring);
	app.post("/api/cibil/improvement-tips", CibilAPI.getCreditImprovementTips);
	app.post("/api/cibil/loan-eligibility", CibilAPI.checkLoanEligibility);
	app.post("/api/cibil/card-eligibility", CibilAPI.checkCreditCardEligibility);
	app.post("/api/cibil/fetch-loan-liabilities", CibilAPI.fetchLoanLiabilities);

	// Personalized Loan Recommendations
	app.get(
		"/api/loans/personalized-recommendations",
		getPersonalizedLoanRecommendations,
	);
	app.post("/api/loans/track-recommendation", trackLoanRecommendationAction);
}
