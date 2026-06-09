// @ts-nocheck
import { Express } from "express";
import { db } from "../db";
import { requireAdmin } from "../middleware/roleMiddleware";
import {
	requireLevel1,
	requireLevel2,
	injectKYCLevel,
} from "../middleware/kyc-level-gate";
import { validateKYC } from "../kyc-middleware";
import { nseNcbApi } from "../nseNcbApi";
import { bseBondApi } from "../bseBondApi";
import { bseDirectApi } from "../bseDirectApi";
import {
	governmentSecurities,
	corporateBonds,
	bondOrders,
	bondHoldings,
	insertBondOrderSchema,
} from "@shared/schema";
import { eq, desc, sql, and, or, gte, lte, inArray } from "drizzle-orm";
import { isProductionEnvironment } from "../utils/enrichment-guard";
import { auditLogArchivalService } from "../services/audit-log-archival";
import { bondOrderNotificationService } from "../services/bond-order-notification-service";

export function registerBondTradingOrderPart1Routes(app: Express): void {
	app.get("/api/bonds/trading/gsec/auctions", async (req, res) => {
		try {
			const auctions = await nseNcbApi.getUpcomingAuctions();
			res.json({
				status: "success",
				data: auctions,
				count: auctions.length,
			});
		} catch (error: any) {
			console.warn(
				`[NSE] NCB auctions fetch failed: ${error?.message || "Unknown error"}`,
			);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch G-Sec auctions",
			});
		}
	});

	// Get G-Sec details by ISIN
	app.get("/api/bonds/trading/gsec/:isin", async (req, res) => {
		try {
			const { isin } = req.params;
			const gsec = await nseNcbApi.getGSecDetails(isin);

			if (!gsec) {
				return res.status(404).json({
					status: "error",
					error: "G-Sec not found",
				});
			}

			res.json({
				status: "success",
				data: gsec,
			});
		} catch (error) {
			console.error("Error fetching G-Sec details:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch G-Sec details",
			});
		}
	});

	// Place NCB order for government security (requires Full KYC - all bonds)
	app.post(
		"/api/bonds/trading/gsec/orders",
		validateKYC("bond"),
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const orderRequest = {
					userId: userId,
					clientCode: req.body.clientCode || `CLI-${userId.substring(0, 8)}`,
					isin: req.body.isin,
					auctionNumber: req.body.auctionNumber,
					bidAmount: req.body.bidAmount,
					panNumber: req.body.panNumber,
					dematAccountNumber: req.body.dematAccountNumber,
				};

				const response = await nseNcbApi.placeNCBOrder(orderRequest);

				if (response.success && response.orderId) {
					// Store bond order in database
					const bondOrder = await db
						.insert(bondOrders)
						.values({
							orderNumber: response.orderId,
							userId: userId,
							clientCode: orderRequest.clientCode,
							bondType: "government",
							isin: orderRequest.isin,
							bondName: `G-Sec ${orderRequest.isin}`,
							orderType: "buy",
							orderCategory: "market",
							quantity: Math.floor(orderRequest.bidAmount / 100), // Face value ₹100
							faceValue: "100",
							totalFaceValue: orderRequest.bidAmount.toString(),
							grossAmount: orderRequest.bidAmount.toString(),
							netAmount: orderRequest.bidAmount.toString(),
							orderStatus: "pending",
							exchange: "nse",
							dematAccountNumber: orderRequest.dematAccountNumber,
							kycLevel: "basic",
							kycValidated: true,
							orderPlacedBy: "client",
						} as any)
						.returning();

					// Send order confirmation notification
					bondOrderNotificationService
						.sendOrderConfirmation({
							orderId: bondOrder[0].id,
							orderNumber: bondOrder[0].orderNumber,
							userId: userId,
							bondName: bondOrder[0].bondName || "G-Sec Bond",
							bondType: "government",
							quantity: bondOrder[0].quantity || 0,
							amount: bondOrder[0].netAmount || bondOrder[0].grossAmount || "0",
							status: "placed",
							settlementDate: bondOrder[0].settlementDate,
						})
						.catch((err) =>
							console.error(
								"[Bond Notification] Order confirmation error:",
								err,
							),
						);

					res.json({
						status: "success",
						...response,
						bondOrderId: bondOrder[0].id,
					});
				} else {
					res.status(400).json({
						status: "error",
						error: response.message,
					});
				}
			} catch (error) {
				console.error("Error placing NCB order:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to place NCB order",
				});
			}
		},
	);

	// BSE Bond API - Corporate Bonds

	// Get tradable corporate bonds from BSE
	app.get("/api/bonds/trading/corporate", async (req, res) => {
		try {
			const filters = {
				minRating: req.query.minRating as string,
				maxTenor: req.query.maxTenor
					? Number.parseInt(req.query.maxTenor as string)
					: undefined,
				minYield: req.query.minYield
					? Number.parseFloat(req.query.minYield as string)
					: undefined,
				issuerSector: req.query.issuerSector as string,
			};

			const bonds = await bseBondApi.getTradableBonds(filters);
			res.json({
				status: "success",
				data: bonds,
				count: bonds.length,
			});
		} catch (error) {
			console.error("Error fetching corporate bonds:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch corporate bonds",
			});
		}
	});

	// Get corporate bond details by ISIN
	app.get("/api/bonds/trading/corporate/:isin", async (req, res) => {
		try {
			const { isin } = req.params;
			const bond = await bseBondApi.getBondDetails(isin);

			if (!bond) {
				return res.status(404).json({
					status: "error",
					error: "Corporate bond not found",
				});
			}

			res.json({
				status: "success",
				data: bond,
			});
		} catch (error) {
			console.error("Error fetching corporate bond details:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch corporate bond details",
			});
		}
	});

	// Place corporate bond order (requires Full KYC - all bonds)
	app.post(
		"/api/bonds/trading/corporate/orders",
		validateKYC("bond"),
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const orderRequest = {
					userId: userId,
					clientCode: req.body.clientCode || `CLI-${userId.substring(0, 8)}`,
					isin: req.body.isin,
					bondType: "corporate" as const,
					orderType: req.body.orderType, // 'buy' or 'sell'
					quantity: req.body.quantity,
					orderCategory: req.body.orderCategory, // 'market' or 'limit'
					limitPrice: req.body.limitPrice,
					dematAccountNumber: req.body.dematAccountNumber,
				};

				const response = await bseBondApi.placeBondOrder(orderRequest);

				if (response.success && response.orderId) {
					// Get bond details for storage
					const bondDetails = await bseBondApi.getBondDetails(
						orderRequest.isin,
					);

					// Store bond order in database
					const bondOrder = await db
						.insert(bondOrders)
						.values({
							orderNumber: response.orderId,
							userId: userId,
							clientCode: orderRequest.clientCode,
							bondType: "corporate",
							isin: orderRequest.isin,
							bondName:
								bondDetails?.bondName || `Corporate Bond ${orderRequest.isin}`,
							orderType: orderRequest.orderType,
							orderCategory: orderRequest.orderCategory,
							quantity: orderRequest.quantity,
							faceValue: bondDetails?.faceValue.toString() || "1000",
							totalFaceValue: (
								(bondDetails?.faceValue || 1000) * orderRequest.quantity
							).toString(),
							orderPrice: response.executionDetails?.executionPrice?.toString(),
							grossAmount: response.executionDetails?.grossAmount?.toString(),
							accruedInterest:
								response.executionDetails?.accruedInterest?.toString(),
							netAmount: response.executionDetails?.netAmount?.toString(),
							orderStatus: "pending",
							exchange: "bse",
							dematAccountNumber: orderRequest.dematAccountNumber,
							kycLevel: "full",
							kycValidated: true,
							orderPlacedBy: "client",
						} as any)
						.returning();

					res.json({
						status: "success",
						...response,
						bondOrderId: bondOrder[0].id,
					});
					// Send order confirmation notification for corporate bond
					bondOrderNotificationService
						.sendOrderConfirmation({
							orderId: bondOrder[0].id,
							orderNumber: bondOrder[0].orderNumber,
							userId: userId,
							bondName: bondOrder[0].bondName || "Corporate Bond",
							bondType: "corporate",
							quantity: bondOrder[0].quantity || 0,
							amount: bondOrder[0].netAmount || bondOrder[0].grossAmount || "0",
							status: "placed",
							settlementDate: bondOrder[0].settlementDate,
						})
						.catch((err) =>
							console.error(
								"[Bond Notification] Order confirmation error:",
								err,
							),
						);
				} else {
					res.status(400).json({
						status: "error",
						error: response.message,
					});
				}
			} catch (error) {
				console.error("Error placing corporate bond order:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to place corporate bond order",
				});
			}
		},
	);

	// Tax-Free Bonds Trading API (for trading interface)
	app.get("/api/bonds/trading/tax-free", async (req, res) => {
		try {
			const taxFreeBonds = [
				{
					id: "tax-trading-1",
					isin: "INE053F07010",
					name: "NHAI 7.35% 2035",
					issuer: "National Highways Authority of India",
					couponRate: 7.35,
					faceValue: 1000,
					currentPrice: 1125,
					yield: 6.15,
					maturityDate: "2035-03-15",
					rating: "AAA",
					taxBenefit: "Tax-free interest under Section 10(15)",
					exchange: "NSE",
				},
				{
					id: "tax-trading-2",
					isin: "INE134E08098",
					name: "REC 7.28% 2033",
					issuer: "Rural Electrification Corporation",
					couponRate: 7.28,
					faceValue: 1000,
					currentPrice: 1098,
					yield: 6.25,
					maturityDate: "2033-09-20",
					rating: "AAA",
					taxBenefit: "Tax-free interest under Section 10(15)",
					exchange: "BSE",
				},
			];
			res.json({
				success: true,
				data: taxFreeBonds,
			});
		} catch (error: any) {
			console.error("Error fetching tax-free bonds for trading:", error);
			res.json({ success: true, data: [] });
		}
	});

	// NCD Trading API (for trading interface)
	app.get("/api/bonds/trading/ncd", async (req, res) => {
		try {
			const ncds = [
				{
					id: "ncd-trading-1",
					isin: "INE860H07AN7",
					name: "Shriram Transport Finance NCD",
					issuer: "Shriram Transport Finance Company",
					couponRate: 9.5,
					faceValue: 1000,
					currentPrice: 1045,
					yield: 8.95,
					maturityDate: "2027-06-30",
					rating: "AA+",
					exchange: "NSE",
				},
				{
					id: "ncd-trading-2",
					isin: "INE134E08099",
					name: "Muthoot Finance NCD",
					issuer: "Muthoot Finance Limited",
					couponRate: 9.25,
					faceValue: 1000,
					currentPrice: 1032,
					yield: 8.8,
					maturityDate: "2028-03-15",
					rating: "AA+",
					exchange: "BSE",
				},
			];
			res.json({
				success: true,
				data: ncds,
			});
		} catch (error: any) {
			console.error("Error fetching NCDs for trading:", error);
			res.json({ success: true, data: [] });
		}
	});

	// Bond commission configuration API (protected for admin access)
}
