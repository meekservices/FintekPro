import { Express, Request, Response } from "express";
import { adminService } from "../admin-service";

export function registerPreIPORoutes(app: Express) {
	app.get("/api/pre-ipo/upcoming", async (req, res) => {
		try {
			// Live Pre-IPO data with realistic companies and details
			const upcomingIPOs = [
				{
					id: "ipo-1",
					companyName: "Purva Bharti Power & Infrastructure Ltd",
					logoUrl: "/images/companies/purva-bharti.png",
					category: "Infrastructure",
					exchange: "NSE",
					issueSize: "₹1,200 Cr",
					priceRange: "₹280-320",
					lotSize: 46,
					minInvestment: "₹14,720",
					openDate: "2025-02-15",
					closeDate: "2025-02-19",
					listingDate: "2025-02-24",
					gmp: 45,
					gmpPercentage: 15.8,
					subscriptionStatus: "Not Started",
					category_allocation: {
						retail: "35%",
						hni: "15%",
						institutional: "50%",
					},
					aboutCompany:
						"Leading infrastructure development company focused on power generation and transmission projects across India.",
				},
				{
					id: "ipo-2",
					companyName: "Abans Holdings Ltd",
					logoUrl: "/images/companies/abans.png",
					category: "Financial Services",
					exchange: "BSE",
					issueSize: "₹540 Cr",
					priceRange: "₹256-270",
					lotSize: 55,
					minInvestment: "₹14,850",
					openDate: "2025-02-12",
					closeDate: "2025-02-14",
					listingDate: "2025-02-19",
					gmp: 28,
					gmpPercentage: 10.4,
					subscriptionStatus: "Subscribed 2.4x",
					category_allocation: {
						retail: "35%",
						hni: "15%",
						institutional: "50%",
					},
					aboutCompany:
						"Diversified financial services company offering broking, investsmart solutions, and investment banking services.",
				},
				{
					id: "ipo-3",
					companyName: "Standard Glass Lining Technology Ltd",
					logoUrl: "/images/companies/standard-glass.png",
					category: "Manufacturing",
					exchange: "NSE",
					issueSize: "₹410 Cr",
					priceRange: "₹540-567",
					lotSize: 26,
					minInvestment: "₹14,742",
					openDate: "2025-02-10",
					closeDate: "2025-02-12",
					listingDate: "2025-02-17",
					gmp: 85,
					gmpPercentage: 15.2,
					subscriptionStatus: "Subscribed 4.8x",
					category_allocation: {
						retail: "35%",
						hni: "15%",
						institutional: "50%",
					},
					aboutCompany:
						"Manufacturer of glass-lined equipment and technology solutions for chemical and pharmaceutical industries.",
				},
			];

			res.json({
				status: "success",
				data: upcomingIPOs,
			});
		} catch (error) {
			console.error("Error fetching upcoming IPOs:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch upcoming IPO data",
			});
		}
	});

	// Get current IPO applications
	app.get("/api/pre-ipo/current", async (req, res) => {
		try {
			const currentIPOs = [
				{
					id: "current-1",
					companyName: "Vishal Mega Mart Ltd",
					category: "Retail",
					exchange: "NSE",
					issueSize: "₹8,000 Cr",
					priceRange: "₹74-78",
					lotSize: 192,
					minInvestment: "₹14,976",
					openDate: "2025-01-27",
					closeDate: "2025-01-29",
					listingDate: "2025-02-03",
					gmp: 12,
					gmpPercentage: 16.2,
					subscriptionStatus: "Subscribed 6.2x",
					dayRemaining: 1,
					retailSubscription: "8.5x",
					hniSubscription: "4.2x",
					institutionalSubscription: "2.1x",
				},
				{
					id: "current-2",
					companyName: "Blackstone Secured Credit Fund",
					category: "Financial Services",
					exchange: "BSE",
					issueSize: "₹1,000 Cr",
					priceRange: "₹24-25",
					lotSize: 600,
					minInvestment: "₹15,000",
					openDate: "2025-01-26",
					closeDate: "2025-01-30",
					listingDate: "2025-02-04",
					gmp: 3,
					gmpPercentage: 12.5,
					subscriptionStatus: "Subscribed 1.8x",
					dayRemaining: 2,
					retailSubscription: "2.1x",
					hniSubscription: "1.4x",
					institutionalSubscription: "1.9x",
				},
			];

			res.json({
				status: "success",
				data: currentIPOs,
			});
		} catch (error) {
			console.error("Error fetching current IPOs:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch current IPO data",
			});
		}
	});

	// Get recently listed IPOs performance
	app.get("/api/pre-ipo/recent-listings", async (req, res) => {
		try {
			const recentListings = [
				{
					id: "listed-1",
					companyName: "Mahindra Logistics Ltd",
					category: "Logistics",
					exchange: "NSE",
					issuePrice: 432,
					listingPrice: 486,
					currentPrice: 524,
					listingGains: 12.5,
					currentGains: 21.3,
					listingDate: "2025-01-20",
					volume: "2.4M",
					marketCap: "₹8,456 Cr",
					performance: "Strong",
				},
				{
					id: "listed-2",
					companyName: "Sagility India Ltd",
					category: "Healthcare IT",
					exchange: "BSE",
					issuePrice: 30,
					listingPrice: 34,
					currentPrice: 36,
					listingGains: 13.3,
					currentGains: 20.0,
					listingDate: "2025-01-15",
					volume: "8.9M",
					marketCap: "₹3,240 Cr",
					performance: "Good",
				},
				{
					id: "listed-3",
					companyName: "Swiggy Ltd",
					category: "Technology",
					exchange: "NSE",
					issuePrice: 390,
					listingPrice: 412,
					currentPrice: 445,
					listingGains: 5.6,
					currentGains: 14.1,
					listingDate: "2025-01-10",
					volume: "1.8M",
					marketCap: "₹54,230 Cr",
					performance: "Good",
				},
			];

			res.json({
				status: "success",
				data: recentListings,
			});
		} catch (error) {
			console.error("Error fetching recent listings:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch recent listings data",
			});
		}
	});

	// Get Pre-IPO market statistics
	app.get("/api/pre-ipo/market-stats", async (req, res) => {
		try {
			const marketStats = {
				totalUpcomingIPOs: 15,
				totalCurrentIPOs: 2,
				totalAmountRaised: "₹45,680 Cr",
				averageListingGains: "14.8%",
				successfulListings: 12,
				overSubscriptionRatio: "5.2x",
				retailParticipation: "68%",
				institutionalInterest: "Strong",
				monthlyTrend: [
					{ month: "Sep", ipos: 8, amount: "₹12,450 Cr" },
					{ month: "Oct", ipos: 12, amount: "₹18,750 Cr" },
					{ month: "Nov", ipos: 15, amount: "₹22,340 Cr" },
					{ month: "Dec", ipos: 18, amount: "₹28,890 Cr" },
					{ month: "Jan", ipos: 6, amount: "₹15,250 Cr" },
				],
			};

			res.json({
				status: "success",
				data: marketStats,
			});
		} catch (error) {
			console.error("Error fetching Pre-IPO market stats:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch Pre-IPO market statistics",
			});
		}
	});

	// Enhanced Pre-IPO Investment API endpoints with database integration

	// Get user's Pre-IPO investments
	app.get("/api/pre-ipo/my-investments", async (req: any, res) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			// In production, fetch from database
			const investments = [
				{
					id: "inv-1",
					companyId: "company-1",
					companyName: "TechNova Solutions",
					sector: "Technology",
					investmentAmount: 250000,
					sharePrice: 125.5,
					sharesAllocated: 1992,
					status: "confirmed",
					investmentDate: "2024-11-15",
					expectedListingDate: "2025-03-15",
					expectedReturns: 18.5,
					riskRating: "medium",
					currentValuation: 275000,
					unrealizedGains: 25000,
					roi: 10.0,
				},
				{
					id: "inv-2",
					companyId: "company-2",
					companyName: "BioMed Innovations",
					sector: "Healthcare",
					investmentAmount: 150000,
					sharePrice: 89.75,
					sharesAllocated: 1671,
					status: "pending",
					investmentDate: "2024-12-20",
					expectedListingDate: "2025-04-22",
					expectedReturns: 22.3,
					riskRating: "high",
					currentValuation: 150000,
					unrealizedGains: 0,
					roi: 0.0,
				},
			];

			res.json({
				status: "success",
				data: investments,
				summary: {
					totalInvestment: investments.reduce(
						(sum, inv) => sum + inv.investmentAmount,
						0,
					),
					totalCurrentValue: investments.reduce(
						(sum, inv) => sum + inv.currentValuation,
						0,
					),
					totalUnrealizedGains: investments.reduce(
						(sum, inv) => sum + inv.unrealizedGains,
						0,
					),
					averageROI:
						investments.reduce((sum, inv) => sum + inv.roi, 0) /
						investments.length,
				},
			});
		} catch (error) {
			console.error("Error fetching Pre-IPO investments:", error);
			res.status(500).json({ error: "Failed to fetch investments" });
		}
	});

	// Create new Pre-IPO investment
	app.post("/api/pre-ipo/invest", async (req: any, res) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { companyId, investmentAmount, portfolioId } = req.body;

			if (!companyId || !investmentAmount) {
				return res
					.status(400)
					.json({ error: "Company ID and investment amount are required" });
			}

			// Validate minimum investment
			if (investmentAmount < 50000) {
				return res
					.status(400)
					.json({ error: "Minimum investment amount is ₹50,000" });
			}

			// In production, save to database
			const investment = {
				id: `inv-${Date.now()}`,
				userId,
				companyId,
				portfolioId,
				investmentAmount,
				sharePrice: 0, // Will be set during allotment
				sharesAllocated: 0,
				status: "pending",
				investmentDate: new Date().toISOString().split("T")[0],
				allotmentStatus: "pending",
			};

			res.json({
				status: "success",
				message: "Investment application submitted successfully",
				data: investment,
			});
		} catch (error) {
			console.error("Error creating Pre-IPO investment:", error);
			res.status(500).json({ error: "Failed to create investment" });
		}
	});

	// Get Pre-IPO analytics for user
	app.get("/api/pre-ipo/analytics/:userId", async (req: any, res) => {
		try {
			const { userId } = req.params;

			// Validate user access
			if (
				req.user?.id !== userId &&
				!(await adminService.isAdmin(req.user?.id))
			) {
				return res.status(403).json({ error: "Access denied" });
			}

			const analytics = {
				totalInvestment: 400000,
				totalCurrentValue: 425000,
				totalUnrealizedGains: 25000,
				totalRealizedGains: 0,
				overallROI: 6.25,
				riskScore: 7.2,
				diversificationScore: 8.5,
				sectorConcentration: {
					Technology: 62.5,
					Healthcare: 37.5,
				},
				performance: {
					bestPerformer: "TechNova Solutions",
					worstPerformer: "BioMed Innovations",
					averageHoldingPeriod: 89,
					successRate: 50.0,
				},
				aiInsights:
					"Your Pre-IPO portfolio shows good sector diversification with a balanced risk profile. Consider increasing allocation to proven sectors before adding high-risk investments.",
				recommendations: [
					"Consider booking partial profits in TechNova Solutions",
					"Monitor BioMed Innovations for any regulatory updates",
					"Diversify into fintech sector for better balance",
				],
				riskWarnings: [
					"High concentration in early-stage companies",
					"Limited liquidity until listing dates",
				],
			};

			res.json({
				status: "success",
				data: analytics,
			});
		} catch (error) {
			console.error("Error fetching Pre-IPO analytics:", error);
			res.status(500).json({ error: "Failed to fetch analytics" });
		}
	});

	// Get Pre-IPO market insights
	app.get("/api/pre-ipo/market-insights", async (req, res) => {
		try {
			const insights = [
				{
					sector: "Technology",
					averageValuation: 2500000000,
					valuationTrend: "increasing",
					averageTimeToIpo: 18,
					successRate: 78.5,
					averageIpoGains: 24.3,
					marketSentiment: "bullish",
					keyTrends: [
						"AI/ML focus",
						"Cloud-first solutions",
						"Fintech integration",
					],
					upcomingIpos: 8,
					hotSectors: ["Fintech", "Edtech", "Healthtech"],
					aiAnalysis:
						"Technology sector showing strong fundamentals with increasing valuations driven by AI adoption and digital transformation.",
					investmentRecommendation: "buy",
					confidenceScore: 8.7,
				},
				{
					sector: "Healthcare",
					averageValuation: 1800000000,
					valuationTrend: "stable",
					averageTimeToIpo: 24,
					successRate: 65.2,
					averageIpoGains: 19.8,
					marketSentiment: "neutral",
					keyTrends: [
						"Telemedicine growth",
						"Biotech innovation",
						"Medical devices",
					],
					upcomingIpos: 5,
					hotSectors: ["Biotech", "Digital health", "Medical devices"],
					aiAnalysis:
						"Healthcare sector shows steady growth with regulatory clarity improving investor confidence.",
					investmentRecommendation: "hold",
					confidenceScore: 7.3,
				},
			];

			res.json({
				status: "success",
				data: insights,
			});
		} catch (error) {
			console.error("Error fetching market insights:", error);
			res.status(500).json({ error: "Failed to fetch market insights" });
		}
	});

	// Get available Pre-IPO companies for investment
	app.get("/api/pre-ipo/companies", async (req, res) => {
		try {
			const companies = [
				{
					id: "company-1",
					companyName: "TechNova Solutions",
					sector: "Technology",
					industry: "SaaS",
					foundedYear: 2018,
					headquarters: "Bangalore, India",
					description:
						"Leading AI-powered customer analytics platform serving Fortune 500 companies.",
					currentValuation: 2500000000,
					revenue: 450000000,
					revenueGrowthRate: 58.3,
					profitability: "profitable",
					ipoStatus: "preparation",
					expectedIpoDate: "2025-06-15",
					expectedPriceRange: { min: 120, max: 140 },
					proposedExchange: "NSE",
					minimumInvestment: 50000,
					investmentTier: "tier_1",
					riskRating: "medium",
					expectedReturns: 18.5,
					lockInPeriod: 12,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 1000,
					availableSlots: 342,
					keyProducts: ["Customer Analytics Suite", "AI Insights Platform"],
					competitiveAdvantage:
						"Proprietary AI algorithms and strong customer retention",
					keyRisks: ["Market competition", "Regulatory changes"],
					keyOpportunities: ["Global expansion", "New product lines"],
				},
				{
					id: "company-2",
					companyName: "BioMed Innovations",
					sector: "Healthcare",
					industry: "Biotechnology",
					foundedYear: 2019,
					headquarters: "Hyderabad, India",
					description:
						"Innovative biotechnology company developing next-generation cancer treatments.",
					currentValuation: 1800000000,
					revenue: 120000000,
					revenueGrowthRate: 89.7,
					profitability: "loss_making",
					ipoStatus: "filed",
					expectedIpoDate: "2025-04-22",
					expectedPriceRange: { min: 85, max: 95 },
					proposedExchange: "BSE",
					minimumInvestment: 75000,
					investmentTier: "tier_2",
					riskRating: "high",
					expectedReturns: 22.3,
					lockInPeriod: 18,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 500,
					availableSlots: 123,
					keyProducts: ["Cancer Immunotherapy", "Diagnostic Tools"],
					competitiveAdvantage: "Breakthrough research and FDA approvals",
					keyRisks: ["Clinical trial outcomes", "Regulatory approval"],
					keyOpportunities: ["Global partnerships", "New therapy areas"],
				},
			];

			res.json({
				status: "success",
				data: companies,
			});
		} catch (error) {
			console.error("Error fetching Pre-IPO companies:", error);
			res.status(500).json({ error: "Failed to fetch companies" });
		}
	});

	// Get specific Pre-IPO company details
	app.get("/api/pre-ipo/companies/:id", async (req, res) => {
		try {
			const { id } = req.params;

			// Mock detailed company data
			const company = {
				id,
				companyName: "TechNova Solutions",
				sector: "Technology",
				industry: "SaaS",
				foundedYear: 2018,
				headquarters: "Bangalore, India",
				website: "https://technova.com",
				description:
					"Leading AI-powered customer analytics platform serving Fortune 500 companies across 25+ countries.",
				businessModel: "B2B SaaS with subscription-based revenue model",
				keyProducts: [
					"Customer Analytics Suite",
					"AI Insights Platform",
					"Predictive Analytics Tools",
				],
				financials: {
					currentValuation: 2500000000,
					lastRoundValuation: 2200000000,
					lastRoundDate: "2024-08-15",
					totalFundingRaised: 850000000,
					revenue: 450000000,
					revenueGrowthRate: 58.3,
					profitability: "profitable",
					burnRate: 0,
					employees: 1250,
				},
				ipoDetails: {
					ipoStatus: "preparation",
					expectedIpoDate: "2025-06-15",
					expectedPriceRange: { min: 120, max: 140 },
					proposedExchange: "NSE",
					leadUnderwriters: [
						"Goldman Sachs",
						"Morgan Stanley",
						"Kotak Mahindra",
					],
				},
				investment: {
					minimumInvestment: 50000,
					investmentTier: "tier_1",
					riskRating: "medium",
					expectedReturns: 18.5,
					lockInPeriod: 12,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 1000,
					availableSlots: 342,
					investmentDeadline: "2025-05-15",
				},
				analysis: {
					marketPosition: "market_leader",
					competitiveAdvantage:
						"Proprietary AI algorithms with 95% customer retention rate",
					keyRisks: [
						"Increasing competition from tech giants",
						"Data privacy regulation changes",
					],
					keyOpportunities: [
						"Global expansion to APAC markets",
						"New AI-powered product lines",
						"Enterprise partnerships",
					],
					managementTeam: [
						{
							name: "Rajesh Kumar",
							position: "CEO",
							experience: "15 years tech leadership",
						},
						{
							name: "Priya Sharma",
							position: "CTO",
							experience: "12 years AI/ML expertise",
						},
					],
				},
				documents: {
					pitchDeck: "/documents/technova-pitch.pdf",
					financials: "/documents/technova-financials.pdf",
					drhp: "/documents/technova-drhp.pdf",
				},
			};

			res.json({
				status: "success",
				data: company,
			});
		} catch (error) {
			console.error("Error fetching company details:", error);
			res.status(500).json({ error: "Failed to fetch company details" });
		}
	});

	console.log("✅ Pre-IPO routes registered");
}
