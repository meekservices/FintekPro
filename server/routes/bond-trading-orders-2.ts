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
import { isAuthenticated } from "../auth-setup";
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
import { bondOrderNotificationService } from "../services/bond-order-notification-service";

export function registerBondTradingOrderPart2Routes(app: Express): void {
	app.get("/api/admin/bond-commission", requireAdmin, async (req: any, res) => {
		try {
			const commissionConfig = {
				gsec: { buyRate: 0.05, sellRate: 0.05, minAmount: 50 },
				corporate: { buyRate: 0.1, sellRate: 0.1, minAmount: 100 },
				taxFree: { buyRate: 0.075, sellRate: 0.075, minAmount: 75 },
				ncd: { buyRate: 0.15, sellRate: 0.15, minAmount: 100 },
			};
			res.json({
				success: true,
				data: commissionConfig,
			});
		} catch (error: any) {
			console.error("Error fetching bond commission:", error);
			res.json({ success: true, data: {} });
		}
	});

	// BSE Direct API - Direct Market Trading

	// Get market quote for any symbol (auth required — market data is user-scoped)
	app.get(
		"/api/bonds/trading/direct/quote/:symbol",
		isAuthenticated,
		requireLevel1,
		async (req, res) => {
			try {
				const { symbol } = req.params;
				const segment = (req.query.segment as string) || "equity";

				const quote = await bseDirectApi.getMarketQuote(symbol, segment);

				if (!quote) {
					return res.status(404).json({
						status: "error",
						error: "Market quote not found",
					});
				}

				res.json({
					status: "success",
					data: quote,
				});
			} catch (error) {
				console.error("Error fetching market quote:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch market quote",
				});
			}
		},
	);

	// Place direct market order — auth + KYC Level-2 required (SEBI regulated trade)
	app.post(
		"/api/bonds/trading/direct/orders",
		isAuthenticated,
		requireLevel2,
		async (req: any, res, next) => {
			// Calculate total order amount for KYC validation (stocks use amount-based tiers)
			const quantity = req.body.quantity || 1;
			const price = req.body.price || 0;
			const estimatedAmount = quantity * price;
			req.body.amount = estimatedAmount;

			// Apply KYC middleware with calculated amount
			return validateKYC("stock", { amountField: "amount" })(
				req,
				res,
				async () => {
					try {
						const userId = req.user?.id;
						if (!userId) {
							return res.status(401).json({ error: "Authentication required" });
						}

						const orderRequest = {
							userId: userId,
							clientCode:
								req.body.clientCode || `CLI-${userId.substring(0, 8)}`,
							segment: req.body.segment, // 'equity', 'derivatives', 'currency', 'commodity'
							symbol: req.body.symbol,
							orderType: req.body.orderType, // 'buy' or 'sell'
							quantity: req.body.quantity,
							orderCategory: req.body.orderCategory, // 'market', 'limit', 'stop_loss'
							price: req.body.price,
							stopLossPrice: req.body.stopLossPrice,
							productType: req.body.productType, // 'delivery', 'intraday', 'margin'
							validity: req.body.validity, // 'day', 'ioc', 'gtc'
						};

						const response = await bseDirectApi.placeDirectOrder(orderRequest);

						if (response.success) {
							res.json({
								status: "success",
								...response,
							});
						} else {
							res.status(400).json({
								status: "error",
								error: response.message,
							});
						}
					} catch (error) {
						console.error("Error placing direct order:", error);
						res.status(500).json({
							status: "error",
							error: "Failed to place direct order",
						});
					}
				},
			);
		},
	);

	// Get user positions from BSE Direct (auth + KYC Level-1 required)
	app.get(
		"/api/bonds/trading/direct/positions",
		isAuthenticated,
		requireLevel1,
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const segment = req.query.segment as string;
				const positions = await bseDirectApi.getPositions(userId, segment);

				res.json({
					status: "success",
					data: positions,
					count: positions.length,
				});
			} catch (error) {
				console.error("Error fetching positions:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch positions",
				});
			}
		},
	);

	// Get user order book from BSE Direct (auth + KYC Level-1 required)
	app.get(
		"/api/bonds/trading/direct/orderbook",
		isAuthenticated,
		requireLevel1,
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const orderBook = await bseDirectApi.getOrderBook(userId);

				res.json({
					status: "success",
					data: orderBook,
					count: orderBook.length,
				});
			} catch (error) {
				console.error("Error fetching order book:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch order book",
				});
			}
		},
	);

	// Bond Order Management

	// Get user's bond orders (auth + KYC Level-1 required)
	app.get(
		"/api/bonds/orders",
		isAuthenticated,
		requireLevel1,
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const bondType = req.query.bondType as string;
				const orderStatus = req.query.status as string;

				const query = db
					.select()
					.from(bondOrders)
					.where(eq(bondOrders.userId, userId));

				const orders = await query;

				// Filter by bond type if specified
				let filteredOrders = orders;
				if (bondType) {
					filteredOrders = filteredOrders.filter(
						(o) => o.bondType === bondType,
					);
				}
				if (orderStatus) {
					filteredOrders = filteredOrders.filter(
						(o) => o.orderStatus === orderStatus,
					);
				}

				res.json({
					status: "success",
					data: filteredOrders,
					count: filteredOrders.length,
				});
			} catch (error) {
				console.error("Error fetching bond orders:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch bond orders",
				});
			}
		},
	);

	// Get bond order status — auth required to prevent order enumeration
	app.get(
		"/api/bonds/orders/:orderId/status",
		isAuthenticated,
		requireLevel1,
		async (req, res) => {
			try {
				const userId = (req as any).user?.id;
				if (!userId) {
					return res
						.status(401)
						.json({ status: "error", error: "Authentication required" });
				}

				const { orderId } = req.params;

				// Get order from database
				const [order] = await db
					.select()
					.from(bondOrders)
					.where(eq(bondOrders.id, orderId));

				if (!order) {
					return res.status(404).json({
						status: "error",
						error: "Order not found",
					});
				}

				// IDOR guard — users can only read their own orders
				if (order.userId !== userId) {
					return res.status(403).json({
						status: "error",
						error: "Not authorized to view this order",
					});
				}

				// Get live status from exchange
				let liveStatus;
				if (order.exchange === "nse") {
					liveStatus = await nseNcbApi.getOrderStatus(order.orderNumber);
				} else if (order.exchange === "bse") {
					liveStatus = await bseBondApi.getOrderStatus(order.orderNumber);
				}

				res.json({
					status: "success",
					data: {
						...order,
						liveStatus,
					},
				});
			} catch (error) {
				console.error("Error fetching order status:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch order status",
				});
			}
		},
	);

	// Cancel bond order — auth + KYC Level-2 required (financial write operation)
	app.post(
		"/api/bonds/orders/:orderId/cancel",
		isAuthenticated,
		requireLevel2,
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const { orderId } = req.params;

				const [order] = await db
					.select()
					.from(bondOrders)
					.where(eq(bondOrders.id, orderId));

				if (!order) {
					return res.status(404).json({
						status: "error",
						error: "Order not found",
					});
				}

				if (order.userId !== userId) {
					return res.status(403).json({
						status: "error",
						error: "Not authorized to cancel this order",
					});
				}

				const cancellableStatuses = ["pending", "placed"];
				if (
					!cancellableStatuses.includes(order.orderStatus?.toLowerCase() || "")
				) {
					return res.status(400).json({
						status: "error",
						error: `Cannot cancel order with status: ${order.orderStatus}. Only pending orders can be cancelled.`,
					});
				}

				await db
					.update(bondOrders)
					.set({
						orderStatus: "cancelled",
						lastUpdated: new Date(),
					})
					.where(eq(bondOrders.id, orderId));

				// Send cancellation notification
				bondOrderNotificationService
					.sendOrderCancellation({
						orderId,
						orderNumber: order.orderNumber || orderId.slice(0, 8),
						userId,
						bondName: order.bondName || "Bond Order",
						bondType: order.bondType || "bond",
						quantity: order.quantity || 0,
						amount: order.netAmount || order.grossAmount || "0",
						status: "cancelled",
						previousStatus: order.orderStatus,
					})
					.catch((err) =>
						console.error(
							"[Bond Notification] Cancel notification error:",
							err,
						),
					);
				console.log(
					`[Bond Order] Order ${orderId} cancelled by user ${userId}`,
				);

				res.json({
					status: "success",
					message: "Order cancelled successfully",
					data: { orderId, orderStatus: "cancelled" },
				});
			} catch (error) {
				console.error("Error cancelling order:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to cancel order",
				});
			}
		},
	);

	// Get user's bond holdings (auth + KYC Level-1 required)
	app.get(
		"/api/bonds/holdings",
		isAuthenticated,
		requireLevel1,
		async (req: any, res) => {
			try {
				const userId = req.user?.id;
				if (!userId) {
					return res.status(401).json({ error: "Authentication required" });
				}

				const bondType = req.query.bondType as string;
				const portfolioId = req.query.portfolioId as string;

				const query = db
					.select()
					.from(bondHoldings)
					.where(eq(bondHoldings.userId, userId));

				const holdings = await query;

				// Filter by bond type if specified
				let filteredHoldings = holdings;
				if (bondType) {
					filteredHoldings = filteredHoldings.filter(
						(h) => h.bondType === bondType,
					);
				}
				if (portfolioId) {
					filteredHoldings = filteredHoldings.filter(
						(h) => h.portfolioId === portfolioId,
					);
				}

				res.json({
					status: "success",
					data: filteredHoldings,
					count: filteredHoldings.length,
				});
			} catch (error) {
				console.error("Error fetching bond holdings:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to fetch bond holdings",
				});
			}
		},
	);

	// Get comprehensive AIF data from all AMCs with complete fund details
}
