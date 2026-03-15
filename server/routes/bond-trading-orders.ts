import { Express } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/roleMiddleware';
import { requireLevel1, requireLevel2, injectKYCLevel } from '../middleware/kyc-level-gate';
import { validateKYC } from '../kyc-middleware';
import { nseNcbApi } from '../nseNcbApi';
import { bseBondApi } from '../bseBondApi';
import { bseDirectApi } from '../bseDirectApi';
import { governmentSecurities, corporateBonds, bondOrders, bondHoldings, insertBondOrderSchema } from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray } from 'drizzle-orm';
import { isProductionEnvironment } from '../utils/enrichment-guard';

export function registerBondTradingOrdersRoutes(app: Express): void {
  // ==================================================================================
  // BOND TRADING & ORDERS - Live Trading APIs (NSE NCB, BSE Bond, BSE Direct)
  // ==================================================================================

  // NSE NCB (Non-Competitive Bidding) - Government Securities
  
  // Get upcoming G-Sec/T-Bill/SDL auctions from NSE NCB
  app.get("/api/bonds/trading/gsec/auctions", async (req, res) => {
    try {
      const auctions = await nseNcbApi.getUpcomingAuctions();
      res.json({
        status: "success",
        data: auctions,
        count: auctions.length
      });
    } catch (error: any) {
      console.warn(`[NSE] NCB auctions fetch failed: ${error?.message || 'Unknown error'}`);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch G-Sec auctions"
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
          error: "G-Sec not found"
        });
      }

      res.json({
        status: "success",
        data: gsec
      });
    } catch (error) {
      console.error("Error fetching G-Sec details:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch G-Sec details"
      });
    }
  });

  // Place NCB order for government security (requires Full KYC - all bonds)
  app.post("/api/bonds/trading/gsec/orders", validateKYC('bond'), async (req: any, res) => {
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
        dematAccountNumber: req.body.dematAccountNumber
      };

      const response = await nseNcbApi.placeNCBOrder(orderRequest);

      if (response.success && response.orderId) {
        // Store bond order in database
        const bondOrder = await db.insert(bondOrders).values({
          orderNumber: response.orderId,
          userId: userId,
          clientCode: orderRequest.clientCode,
          bondType: 'government',
          isin: orderRequest.isin,
          bondName: `G-Sec ${orderRequest.isin}`,
          orderType: 'buy',
          orderCategory: 'market',
          quantity: Math.floor(orderRequest.bidAmount / 100), // Face value ₹100
          faceValue: '100',
          totalFaceValue: orderRequest.bidAmount.toString(),
          grossAmount: orderRequest.bidAmount.toString(),
          netAmount: orderRequest.bidAmount.toString(),
          orderStatus: 'pending',
          exchange: 'nse',
          dematAccountNumber: orderRequest.dematAccountNumber,
          kycLevel: 'basic',
          kycValidated: true,
          orderPlacedBy: 'client'
        }).returning();

        // Send order confirmation notification
        bondOrderNotificationService.sendOrderConfirmation({
          orderId: bondOrder[0].id,
          orderNumber: bondOrder[0].orderNumber,
          userId: userId,
          bondName: bondOrder[0].bondName || "G-Sec Bond",
          bondType: "government",
          quantity: bondOrder[0].quantity || 0,
          amount: bondOrder[0].netAmount || bondOrder[0].grossAmount || "0",
          status: "placed",
          settlementDate: bondOrder[0].settlementDate,
        }).catch(err => console.error("[Bond Notification] Order confirmation error:", err));

        res.json({
          status: "success",
          ...response,
          bondOrderId: bondOrder[0].id
        });
      } else {
        res.status(400).json({
          status: "error",
          error: response.message
        });
      }
    } catch (error) {
      console.error("Error placing NCB order:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to place NCB order"
      });
    }
  });

  // BSE Bond API - Corporate Bonds
  
  // Get tradable corporate bonds from BSE
  app.get("/api/bonds/trading/corporate", async (req, res) => {
    try {
      const filters = {
        minRating: req.query.minRating as string,
        maxTenor: req.query.maxTenor ? parseInt(req.query.maxTenor as string) : undefined,
        minYield: req.query.minYield ? parseFloat(req.query.minYield as string) : undefined,
        issuerSector: req.query.issuerSector as string
      };

      const bonds = await bseBondApi.getTradableBonds(filters);
      res.json({
        status: "success",
        data: bonds,
        count: bonds.length
      });
    } catch (error) {
      console.error("Error fetching corporate bonds:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch corporate bonds"
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
          error: "Corporate bond not found"
        });
      }

      res.json({
        status: "success",
        data: bond
      });
    } catch (error) {
      console.error("Error fetching corporate bond details:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch corporate bond details"
      });
    }
  });

  // Place corporate bond order (requires Full KYC - all bonds)
  app.post("/api/bonds/trading/corporate/orders", validateKYC('bond'), async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const orderRequest = {
        userId: userId,
        clientCode: req.body.clientCode || `CLI-${userId.substring(0, 8)}`,
        isin: req.body.isin,
        bondType: 'corporate' as const,
        orderType: req.body.orderType, // 'buy' or 'sell'
        quantity: req.body.quantity,
        orderCategory: req.body.orderCategory, // 'market' or 'limit'
        limitPrice: req.body.limitPrice,
        dematAccountNumber: req.body.dematAccountNumber
      };

      const response = await bseBondApi.placeBondOrder(orderRequest);

      if (response.success && response.orderId) {
        // Get bond details for storage
        const bondDetails = await bseBondApi.getBondDetails(orderRequest.isin);
        
        // Store bond order in database
        const bondOrder = await db.insert(bondOrders).values({
          orderNumber: response.orderId,
          userId: userId,
          clientCode: orderRequest.clientCode,
          bondType: 'corporate',
          isin: orderRequest.isin,
          bondName: bondDetails?.bondName || `Corporate Bond ${orderRequest.isin}`,
          orderType: orderRequest.orderType,
          orderCategory: orderRequest.orderCategory,
          quantity: orderRequest.quantity,
          faceValue: bondDetails?.faceValue.toString() || '1000',
          totalFaceValue: ((bondDetails?.faceValue || 1000) * orderRequest.quantity).toString(),
          orderPrice: response.executionDetails?.executionPrice?.toString(),
          grossAmount: response.executionDetails?.grossAmount?.toString(),
          accruedInterest: response.executionDetails?.accruedInterest?.toString(),
          netAmount: response.executionDetails?.netAmount?.toString(),
          orderStatus: 'pending',
          exchange: 'bse',
          dematAccountNumber: orderRequest.dematAccountNumber,
          kycLevel: 'full',
          kycValidated: true,
          orderPlacedBy: 'client'
        } as any).returning();

        res.json({
          status: "success",
          ...response,
          bondOrderId: bondOrder[0].id
        });
        // Send order confirmation notification for corporate bond
        bondOrderNotificationService.sendOrderConfirmation({
          orderId: bondOrder[0].id,
          orderNumber: bondOrder[0].orderNumber,
          userId: userId,
          bondName: bondOrder[0].bondName || "Corporate Bond",
          bondType: "corporate",
          quantity: bondOrder[0].quantity || 0,
          amount: bondOrder[0].netAmount || bondOrder[0].grossAmount || "0",
          status: "placed",
          settlementDate: bondOrder[0].settlementDate,
        }).catch(err => console.error("[Bond Notification] Order confirmation error:", err));
      } else {
        res.status(400).json({
          status: "error",
          error: response.message
        });
      }
    } catch (error) {
      console.error("Error placing corporate bond order:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to place corporate bond order"
      });
    }
  });


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
          exchange: "NSE"
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
          exchange: "BSE"
        }
      ];
      res.json({
        success: true,
        data: taxFreeBonds
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
          couponRate: 9.50,
          faceValue: 1000,
          currentPrice: 1045,
          yield: 8.95,
          maturityDate: "2027-06-30",
          rating: "AA+",
          exchange: "NSE"
        },
        {
          id: "ncd-trading-2",
          isin: "INE134E08099",
          name: "Muthoot Finance NCD",
          issuer: "Muthoot Finance Limited",
          couponRate: 9.25,
          faceValue: 1000,
          currentPrice: 1032,
          yield: 8.80,
          maturityDate: "2028-03-15",
          rating: "AA+",
          exchange: "BSE"
        }
      ];
      res.json({
        success: true,
        data: ncds
      });
    } catch (error: any) {
      console.error("Error fetching NCDs for trading:", error);
      res.json({ success: true, data: [] });
    }
  });

  // Bond commission configuration API (protected for admin access)
  app.get("/api/admin/bond-commission", requireAdmin, async (req: any, res) => {
    try {
      const commissionConfig = {
        gsec: { buyRate: 0.05, sellRate: 0.05, minAmount: 50 },
        corporate: { buyRate: 0.10, sellRate: 0.10, minAmount: 100 },
        taxFree: { buyRate: 0.075, sellRate: 0.075, minAmount: 75 },
        ncd: { buyRate: 0.15, sellRate: 0.15, minAmount: 100 }
      };
      res.json({
        success: true,
        data: commissionConfig
      });
    } catch (error: any) {
      console.error("Error fetching bond commission:", error);
      res.json({ success: true, data: {} });
    }
  });

  // BSE Direct API - Direct Market Trading
  
  // Get market quote for any symbol
  app.get("/api/bonds/trading/direct/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const segment = (req.query.segment as string) || 'equity';
      
      const quote = await bseDirectApi.getMarketQuote(symbol, segment);
      
      if (!quote) {
        return res.status(404).json({
          status: "error",
          error: "Market quote not found"
        });
      }

      res.json({
        status: "success",
        data: quote
      });
    } catch (error) {
      console.error("Error fetching market quote:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch market quote"
      });
    }
  });

  // Place direct market order (requires Full Stock KYC - amount-based Enhanced for >₹200K)
  app.post("/api/bonds/trading/direct/orders", async (req: any, res, next) => {
    // Calculate total order amount for KYC validation (stocks use amount-based tiers)
    const quantity = req.body.quantity || 1;
    const price = req.body.price || 0;
    const estimatedAmount = quantity * price;
    req.body.amount = estimatedAmount;
    
    // Apply KYC middleware with calculated amount
    return validateKYC('stock', { amountField: 'amount' })(req, res, async () => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const orderRequest = {
          userId: userId,
          clientCode: req.body.clientCode || `CLI-${userId.substring(0, 8)}`,
          segment: req.body.segment, // 'equity', 'derivatives', 'currency', 'commodity'
          symbol: req.body.symbol,
          orderType: req.body.orderType, // 'buy' or 'sell'
          quantity: req.body.quantity,
          orderCategory: req.body.orderCategory, // 'market', 'limit', 'stop_loss'
          price: req.body.price,
          stopLossPrice: req.body.stopLossPrice,
          productType: req.body.productType, // 'delivery', 'intraday', 'margin'
          validity: req.body.validity // 'day', 'ioc', 'gtc'
        };

        const response = await bseDirectApi.placeDirectOrder(orderRequest);

      if (response.success) {
        res.json({
          status: "success",
          ...response
        });
      } else {
        res.status(400).json({
          status: "error",
          error: response.message
        });
        }
      } catch (error) {
        console.error("Error placing direct order:", error);
        res.status(500).json({
          status: "error",
          error: "Failed to place direct order"
        });
      }
    });
  });

  // Get user positions from BSE Direct
  app.get("/api/bonds/trading/direct/positions", async (req: any, res) => {
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
        count: positions.length
      });
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch positions"
      });
    }
  });

  // Get user order book from BSE Direct
  app.get("/api/bonds/trading/direct/orderbook", async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const orderBook = await bseDirectApi.getOrderBook(userId);

      res.json({
        status: "success",
        data: orderBook,
        count: orderBook.length
      });
    } catch (error) {
      console.error("Error fetching order book:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch order book"
      });
    }
  });

  // Bond Order Management
  
  // Get user's bond orders
  app.get("/api/bonds/orders", async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const bondType = req.query.bondType as string;
      const orderStatus = req.query.status as string;

      let query = db.select().from(bondOrders).where(eq(bondOrders.userId, userId));

      const orders = await query;

      // Filter by bond type if specified
      let filteredOrders = orders;
      if (bondType) {
        filteredOrders = filteredOrders.filter(o => o.bondType === bondType);
      }
      if (orderStatus) {
        filteredOrders = filteredOrders.filter(o => o.orderStatus === orderStatus);
      }

      res.json({
        status: "success",
        data: filteredOrders,
        count: filteredOrders.length
      });
    } catch (error) {
      console.error("Error fetching bond orders:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch bond orders"
      });
    }
  });

  // Get bond order status
  app.get("/api/bonds/orders/:orderId/status", async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Get order from database
      const [order] = await db.select().from(bondOrders).where(eq(bondOrders.id, orderId));
      
      if (!order) {
        return res.status(404).json({
          status: "error",
          error: "Order not found"
        });
      }

      // Get live status from exchange
      let liveStatus;
      if (order.exchange === 'nse') {
        liveStatus = await nseNcbApi.getOrderStatus(order.orderNumber);
      } else if (order.exchange === 'bse') {
        liveStatus = await bseBondApi.getOrderStatus(order.orderNumber);
      }

      res.json({
        status: "success",
        data: {
          ...order,
          liveStatus
        }
      });
    } catch (error) {
      console.error("Error fetching order status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch order status"
      });
    }
  });

  // Cancel bond order (only for pending orders)
  app.post("/api/bonds/orders/:orderId/cancel", async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { orderId } = req.params;
      
      const [order] = await db.select().from(bondOrders).where(eq(bondOrders.id, orderId));
      
      if (!order) {
        return res.status(404).json({
          status: "error",
          error: "Order not found"
        });
      }

      if (order.userId !== userId) {
        return res.status(403).json({
          status: "error",
          error: "Not authorized to cancel this order"
        });
      }

      const cancellableStatuses = ["pending", "placed"];
      if (!cancellableStatuses.includes(order.orderStatus?.toLowerCase() || "")) {
        return res.status(400).json({
          status: "error",
          error: `Cannot cancel order with status: ${order.orderStatus}. Only pending orders can be cancelled.`
        });
      }

      await db.update(bondOrders)
        .set({
          orderStatus: "cancelled",
          lastUpdated: new Date(),
        })
        .where(eq(bondOrders.id, orderId));

      // Send cancellation notification
      bondOrderNotificationService.sendOrderCancellation({
        orderId,
        orderNumber: order.orderNumber || orderId.slice(0, 8),
        userId,
        bondName: order.bondName || "Bond Order",
        bondType: order.bondType || "bond",
        quantity: order.quantity || 0,
        amount: order.netAmount || order.grossAmount || "0",
        status: "cancelled",
        previousStatus: order.orderStatus,
      }).catch(err => console.error("[Bond Notification] Cancel notification error:", err));
      console.log(`[Bond Order] Order ${orderId} cancelled by user ${userId}`);

      res.json({
        status: "success",
        message: "Order cancelled successfully",
        data: { orderId, orderStatus: "cancelled" }
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to cancel order"
      });
    }
  });

  // Get user's bond holdings
  app.get("/api/bonds/holdings", async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const bondType = req.query.bondType as string;
      const portfolioId = req.query.portfolioId as string;

      let query = db.select().from(bondHoldings).where(eq(bondHoldings.userId, userId));

      const holdings = await query;

      // Filter by bond type if specified
      let filteredHoldings = holdings;
      if (bondType) {
        filteredHoldings = filteredHoldings.filter(h => h.bondType === bondType);
      }
      if (portfolioId) {
        filteredHoldings = filteredHoldings.filter(h => h.portfolioId === portfolioId);
      }

      res.json({
        status: "success",
        data: filteredHoldings,
        count: filteredHoldings.length
      });
    } catch (error) {
      console.error("Error fetching bond holdings:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch bond holdings"
      });
    }
  });

  // Get comprehensive AIF data from all AMCs with complete fund details
  app.get("/api/aif/comprehensive", requireLevel2, async (req, res) => {
    try {
      const { amc, category, subCategory, riskRating } = req.query;
      const amcStr = typeof amc === 'string' ? amc : Array.isArray(amc) ? amc[0] : undefined;
      const categoryStr = typeof category === 'string' ? category : Array.isArray(category) ? category[0] : undefined;
      const subCategoryStr = typeof subCategory === 'string' ? subCategory : Array.isArray(subCategory) ? subCategory[0] : undefined;
      const riskRatingStr = typeof riskRating === 'string' ? riskRating : Array.isArray(riskRating) ? riskRating[0] : undefined;
      
      // Fetch real-time AIF data from comprehensive API
      const realAifData = await comprehensiveAIFPMSAPI.getComprehensiveAIFData(
        undefined, // aifId
        category as string
      );
      
      // Use only real AIF data from API - no mock data
      const allFundsData = realAifData;

      const enhancedStats = {
        totalFunds: allFundsData.length,
        totalAUM: allFundsData.reduce((sum, fund) => {
          const currentAUM = (fund as any).currentAUM;
          const aum = (fund as any).aum;
          return sum + (currentAUM || aum || 0);
        }, 0),
        averageReturns: {
          "1Y": allFundsData.length > 0 ? allFundsData.reduce((sum, fund) => {
            const pastPerf = (fund as any).pastPerformance;
            const returns1y = (fund as any).returns1y;
            return sum + (pastPerf?.['1Y'] || returns1y || 0);
          }, 0) / allFundsData.length : 0,
          "3Y": allFundsData.length > 0 ? allFundsData.reduce((sum, fund) => {
            const pastPerf = (fund as any).pastPerformance;
            const returns3y = (fund as any).returns3y;
            return sum + (pastPerf?.['3Y'] || returns3y || 0);
          }, 0) / allFundsData.length : 0,
          "5Y": allFundsData.length > 0 ? allFundsData.reduce((sum, fund) => {
            const pastPerf = (fund as any).pastPerformance;
            const returns5y = (fund as any).returns5y;
            return sum + (pastPerf?.['5Y'] || returns5y || 0);
          }, 0) / allFundsData.length : 0
        },
        categoryBreakdown: {
          "Category I": allFundsData.filter(f => f.category === 'Category I').length,
          "Category II": allFundsData.filter(f => f.category === 'Category II').length,
          "Category III": allFundsData.filter(f => f.category === 'Category III').length
        },
        activeAMCs: new Set(allFundsData.map(fund => (typeof fund.fundManager !== 'string' && fund.fundManager?.name) || (fund as any).amcName || 'Unknown')).size
      };

      res.json({
        status: "success",
        data: allFundsData,
        statistics: enhancedStats,
        filters: {
          amc: amc || 'all',
          category: category || 'all',
          subCategory: subCategory || 'all',
          riskRating: riskRating || 'all'
        },
        availableFilters: {
          amcs: ['Kotak Mahindra', 'ICICI Prudential', 'Aditya Birla Sun Life', 'DSP', 'Nippon India', 'UTI'],
          categories: ['Category I', 'Category II', 'Category III'],
          subCategories: ['Private Equity Fund', 'Venture Capital Fund', 'Infrastructure Fund', 'Hedge Fund'],
          riskRatings: ['Low', 'Medium', 'Medium-High', 'High', 'Very High']
        },
        dataSources: ['SEBI', 'PMS Bazaar', 'PMS World', 'Internal'],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching comprehensive AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch comprehensive AIF data"
      });
    }
  });

  // Get NSE AIF funds data
  app.get("/api/aif/nse-funds", requireLevel2, async (req, res) => {
    try {
      const nseFunds = [
        {
          id: "nse-aif-1",
          name: "NSE Large Cap AIF Fund",
          category: "Category II",
          subCategory: "Private Equity Fund",
          exchange: "NSE",
          fundManager: "NSE Investment Managers",
          launchDate: "2022-01-15",
          nav: 125.45,
          aum: "₹2,450 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "3 years",
          exitLoad: "2%",
          managementFee: "2.5%",
          performanceFee: "20%",
          returns: {
            "1Y": 18.5,
            "2Y": 22.3,
            "3Y": 19.8,
            "5Y": 24.2,
            "inception": 21.7
          },
          riskRating: "High",
          benchmark: "NSE 500 TRI",
          sector: "Multi-Sector",
          status: "Open",
          lastUpdated: "2025-01-27",
          regulatoryInfo: {
            sebiRegistration: "IN/AIF2/22-23/1045",
            trustee: "NSE Trustee Services",
            custodian: "HDFC Bank"
          }
        },
        {
          id: "nse-aif-2", 
          name: "NSE Infrastructure Development Fund",
          category: "Category I",
          subCategory: "Infrastructure Fund",
          exchange: "NSE",
          fundManager: "NSE Infra Capital",
          launchDate: "2021-06-20",
          nav: 98.75,
          aum: "₹1,850 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "5 years",
          exitLoad: "1%",
          managementFee: "1.8%",
          performanceFee: "15%",
          returns: {
            "1Y": 15.2,
            "2Y": 18.7,
            "3Y": 16.4,
            "5Y": 20.1,
            "inception": 17.8
          },
          riskRating: "Medium-High",
          benchmark: "NSE Infrastructure Index",
          sector: "Infrastructure",
          status: "Open",
          lastUpdated: "2025-01-27",
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/21-22/0789",
            trustee: "NSE Trustee Services",
            custodian: "SBI Custodial Services"
          }
        }
      ];

      res.json({
        status: "success",
        data: nseFunds,
        exchange: "NSE",
        totalFunds: nseFunds.length,
        totalAUM: "₹4,300 Cr",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NSE AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE AIF data"
      });
    }
  });

  // Get BSE AIF funds data
  app.get("/api/aif/bse-funds", requireLevel2, async (req, res) => {
    try {
      const bseFunds = [
        {
          id: "bse-aif-1",
          name: "BSE SME Growth Fund",
          category: "Category II", 
          subCategory: "Private Equity Fund",
          exchange: "BSE",
          fundManager: "BSE SME Capital",
          launchDate: "2022-03-10",
          nav: 142.30,
          aum: "₹1,650 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "4 years",
          exitLoad: "2.5%",
          managementFee: "2.8%",
          performanceFee: "25%",
          returns: {
            "1Y": 25.8,
            "2Y": 28.4,
            "3Y": 24.7,
            "5Y": 0, // Not available
            "inception": 26.1
          },
          riskRating: "Very High",
          benchmark: "BSE SME IPO Index",
          sector: "Small & Mid Cap",
          status: "Open",
          lastUpdated: "2025-01-27",
          regulatoryInfo: {
            sebiRegistration: "IN/AIF2/22-23/1156",
            trustee: "BSE Trustee Company",
            custodian: "ICICI Bank"
          }
        },
        {
          id: "bse-aif-3",
          name: "BSE Debt Plus Fund",
          category: "Category III",
          subCategory: "Hedge Fund",
          exchange: "BSE",
          fundManager: "BSE Alternative Investments",
          launchDate: "2021-09-15",
          nav: 111.85,
          aum: "₹980 Cr",
          minimumInvestment: "₹1,00,00,000", 
          lockInPeriod: "1 year",
          exitLoad: "1.5%",
          managementFee: "2.2%",
          performanceFee: "20%",
          returns: {
            "1Y": 12.4,
            "2Y": 14.8,
            "3Y": 13.2,
            "5Y": 15.6,
            "inception": 14.1
          },
          riskRating: "Medium",
          benchmark: "CRISIL Corporate Bond Composite Index",
          sector: "Debt & Arbitrage",
          status: "Open",
          lastUpdated: "2025-01-27",
          regulatoryInfo: {
            sebiRegistration: "IN/AIF3/21-22/0923",
            trustee: "BSE Trustee Company",
            custodian: "Axis Bank"
          }
        }
      ];

      res.json({
        status: "success",
        data: bseFunds,
        exchange: "BSE",
        totalFunds: bseFunds.length,
        totalAUM: "₹2,630 Cr",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching BSE AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE AIF data"
      });
    }
  });

  // Get MCX AIF funds data (commodity-focused)
  app.get("/api/aif/mcx-funds", requireLevel2, async (req, res) => {
    try {
      const mcxFunds = [
        {
          id: "mcx-aif-1",
          name: "MCX Commodity Alpha Fund",
          category: "Category III",
          subCategory: "Hedge Fund", 
          exchange: "MCX",
          fundManager: "MCX Alternative Capital",
          launchDate: "2022-05-01",
          nav: 108.92,
          aum: "₹750 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "2 years",
          exitLoad: "2%",
          managementFee: "2.3%",
          performanceFee: "25%",
          returns: {
            "1Y": 16.8,
            "2Y": 19.5,
            "3Y": 17.2,
            "5Y": 0, // Not available
            "inception": 18.1
          },
          riskRating: "High",
          benchmark: "MCX Composite Index",
          sector: "Commodities",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Gold", "Silver", "Crude Oil", "Natural Gas"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF3/22-23/1278",
            trustee: "MCX Trust Services",
            custodian: "Kotak Mahindra Bank"
          }
        },
        {
          id: "mcx-aif-2",
          name: "MCX Energy Transition Fund",
          category: "Category I",
          subCategory: "Social Venture Fund",
          exchange: "MCX",
          fundManager: "MCX Green Capital",
          launchDate: "2023-01-20",
          nav: 95.67,
          aum: "₹420 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "7 years",
          exitLoad: "1%",
          managementFee: "1.5%",
          performanceFee: "12%",
          returns: {
            "1Y": 11.3,
            "2Y": 13.7,
            "3Y": 0, // Not available
            "5Y": 0, // Not available
            "inception": 12.8
          },
          riskRating: "Medium-High",
          benchmark: "S&P Global Clean Energy Index",
          sector: "Clean Energy",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Solar Energy", "Wind Power", "Battery Storage", "Green Hydrogen"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/23-24/1456",
            trustee: "MCX Trust Services", 
            custodian: "YES Bank"
          }
        }
      ];

      res.json({
        status: "success",
        data: mcxFunds,
        exchange: "MCX",
        totalFunds: mcxFunds.length,
        totalAUM: "₹1,170 Cr",
        specialization: "Commodity & Energy Funds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching MCX AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MCX AIF data"
      });
    }
  });

  // Get NCDEX AIF funds data (agricultural-focused)
  app.get("/api/aif/ncdex-funds", requireLevel2, async (req, res) => {
    try {
      const ncdexFunds = [
        {
          id: "ncdex-aif-1",
          name: "NCDEX AgriTech Innovation Fund",
          category: "Category I",
          subCategory: "Venture Capital Fund",
          exchange: "NCDEX",
          fundManager: "NCDEX Venture Partners",
          launchDate: "2022-08-15",
          nav: 118.45,
          aum: "₹580 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "5 years", 
          exitLoad: "1.5%",
          managementFee: "2.0%",
          performanceFee: "20%",
          returns: {
            "1Y": 14.7,
            "2Y": 17.8,
            "3Y": 16.2,
            "5Y": 0, // Not available
            "inception": 16.9
          },
          riskRating: "High",
          benchmark: "NCDEX Agricultural Index",
          sector: "AgriTech & Food Processing",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Agricultural Technology", "Food Processing", "Supply Chain", "Sustainable Farming"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/22-23/1234",
            trustee: "NCDEX Trustee Services",
            custodian: "Union Bank of India"
          }
        },
        {
          id: "ncdex-aif-2",
          name: "NCDEX Rural Development Fund", 
          category: "Category I",
          subCategory: "Social Venture Fund",
          exchange: "NCDEX",
          fundManager: "NCDEX Social Impact",
          launchDate: "2021-11-10",
          nav: 106.23,
          aum: "₹390 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "6 years",
          exitLoad: "1%",
          managementFee: "1.8%",
          performanceFee: "15%",
          returns: {
            "1Y": 9.8,
            "2Y": 12.4,
            "3Y": 11.6,
            "5Y": 0, // Not available
            "inception": 11.2
          },
          riskRating: "Medium",
          benchmark: "Rural Development Index",
          sector: "Rural & Social Impact",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Rural Infrastructure", "Microfinance", "Agricultural Equipment", "Rural Healthcare"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/21-22/0987",
            trustee: "NCDEX Trustee Services",
            custodian: "Bank of Baroda"
          }
        }
      ];

      res.json({
        status: "success",
        data: ncdexFunds,
        exchange: "NCDEX",
        totalFunds: ncdexFunds.length,
        totalAUM: "₹970 Cr",
        specialization: "Agricultural & Rural Development Funds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NCDEX AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX AIF data"
      });
    }
  });

  // Get MSEI AIF funds data (SME and specialized)
  app.get("/api/aif/msei-funds", requireLevel2, async (req, res) => {
    try {
      const mseiFunds = [
        {
          id: "msei-aif-1",
          name: "MSEI Startup Accelerator Fund",
          category: "Category I",
          subCategory: "Venture Capital Fund",
          exchange: "MSEI",
          fundManager: "MSEI Ventures",
          launchDate: "2023-02-28",
          nav: 89.34,
          aum: "₹280 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "8 years",
          exitLoad: "2%",
          managementFee: "2.5%",
          performanceFee: "25%",
          returns: {
            "1Y": 8.2,
            "2Y": 10.7,
            "3Y": 0, // Not available
            "5Y": 0, // Not available
            "inception": 9.1
          },
          riskRating: "Very High",
          benchmark: "MSEI Startup Index",
          sector: "Technology Startups",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Fintech", "Healthtech", "Edtech", "Deep Tech"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/23-24/1567",
            trustee: "MSEI Trust Company",
            custodian: "IndusInd Bank"
          }
        },
        {
          id: "msei-aif-2",
          name: "MSEI Healthcare Innovation Fund",
          category: "Category II",
          subCategory: "Private Equity Fund",
          exchange: "MSEI",
          fundManager: "MSEI Healthcare Capital",
          launchDate: "2022-07-05",
          nav: 134.78,
          aum: "₹650 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "4 years",
          exitLoad: "2%",
          managementFee: "2.3%",
          performanceFee: "20%",
          returns: {
            "1Y": 22.1,
            "2Y": 24.6,
            "3Y": 23.4,
            "5Y": 0, // Not available
            "inception": 23.7
          },
          riskRating: "High",
          benchmark: "MSEI Healthcare Index",
          sector: "Healthcare & Pharmaceuticals",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Pharmaceutical Manufacturing", "Medical Devices", "Digital Health", "Biotechnology"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF2/22-23/1345",
            trustee: "MSEI Trust Company",
            custodian: "HDFC Bank"
          }
        }
      ];

      res.json({
        status: "success", 
        data: mseiFunds,
        exchange: "MSEI",
        totalFunds: mseiFunds.length,
        totalAUM: "₹930 Cr",
        specialization: "SME & Innovation Funds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching MSEI AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI AIF data"
      });
    }
  });

  // Get comprehensive multi-exchange AIF data
  app.get("/api/aif/all-exchanges", requireLevel2, async (req, res) => {
    try {
      const exchange = req.query.exchange as string;
      const category = req.query.category as string;

      // Fetch from all exchanges
      const [nseResponse, bseResponse, mcxResponse, ncdexResponse, mseiResponse] = await Promise.all([
        fetch(`${req.protocol}://${req.get('host')}/api/aif/nse-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/bse-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/mcx-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/ncdex-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/msei-funds`)
      ]);

      const [nseData, bseData, mcxData, ncdexData, mseiData] = await Promise.all([
        nseResponse.json(),
        bseResponse.json(), 
        mcxResponse.json(),
        ncdexResponse.json(),
        mseiResponse.json()
      ]);

      let allFunds = [
        ...nseData.data,
        ...bseData.data,
        ...mcxData.data,
        ...ncdexData.data,
        ...mseiData.data
      ];

      // Filter by exchange if specified
      if (exchange && exchange !== 'all') {
        allFunds = allFunds.filter(fund => 
          fund.exchange.toLowerCase() === exchange.toLowerCase()
        );
      }

      // Filter by category if specified
      if (category && category !== 'all') {
        allFunds = allFunds.filter(fund => 
          fund.category.toLowerCase().includes(category.toLowerCase()) ||
          fund.subCategory.toLowerCase().includes(category.toLowerCase())
        );
      }

      // Calculate comprehensive market statistics
      const marketStats = {
        totalFunds: allFunds.length,
        exchangeBreakdown: {
          NSE: nseData.data.length,
          BSE: bseData.data.length,
          MCX: mcxData.data.length,
          NCDEX: ncdexData.data.length,
          MSEI: mseiData.data.length
        },
        totalAUM: allFunds.reduce((sum, fund) => {
          const aum = parseFloat(fund.aum.replace(/[₹,\sCr]/g, ''));
          return sum + aum;
        }, 0),
        averageReturns: {
          "1Y": (allFunds.reduce((sum, fund) => sum + fund.returns["1Y"], 0) / allFunds.length).toFixed(1),
          "3Y": (allFunds.reduce((sum, fund) => sum + (fund.returns["3Y"] || 0), 0) / allFunds.filter(f => f.returns["3Y"]).length).toFixed(1),
          "5Y": (allFunds.reduce((sum, fund) => sum + (fund.returns["5Y"] || 0), 0) / allFunds.filter(f => f.returns["5Y"]).length).toFixed(1)
        },
        categoryDistribution: {
          "Category I": allFunds.filter(f => f.category === 'Category I').length,
          "Category II": allFunds.filter(f => f.category === 'Category II').length,
          "Category III": allFunds.filter(f => f.category === 'Category III').length
        },
        riskDistribution: {
          "High": allFunds.filter(f => f.riskRating && f.riskRating.includes('High')).length,
          "Medium": allFunds.filter(f => f.riskRating && f.riskRating.includes('Medium')).length,
          "Low": allFunds.filter(f => f.riskRating && f.riskRating.includes('Low')).length
        },
        topPerformer: allFunds.reduce((max, fund) => 
          fund.returns["1Y"] > max.returns["1Y"] ? fund : max, allFunds[0]
        )
      };

      res.json({
        status: "success",
        data: allFunds,
        marketStats,
        filters: { exchange: exchange || 'all', category: category || 'all' },
        exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX', 'MSEI'],
        categories: ['Category I', 'Category II', 'Category III'],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching all exchanges AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch AIF data from all exchanges"
      });
    }
  });

  // NSDL API endpoints for capital gains and holdings
  app.get("/api/nsdl/holdings", async (req, res) => {
    try {
      const { pan, fromDate, toDate, isin } = req.query;
      
      const nsdlHoldings = [
        {
          id: "nsdl-holding-1",
          isin: "INE002A01018",
          symbol: "RELIANCE",
          companyName: "Reliance Industries Limited",
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 250,
          faceValue: 10,
          marketValue: 625000,
          currentPrice: 2500.50,
          avgCostPrice: 2400.75,
          totalCostValue: 600187.50,
          unrealizedGainLoss: 24812.50,
          gainLossPercentage: 4.13,
          pledgedQuantity: 0,
          lockedQuantity: 0,
          availableQuantity: 250,
          transactions: [
            {
              date: "2024-08-15",
              type: "BUY",
              quantity: 100,
              price: 2380.50,
              value: 238050
            },
            {
              date: "2024-10-20",
              type: "BUY", 
              quantity: 150,
              price: 2412.50,
              value: 361875
            }
          ]
        },
        {
          id: "nsdl-holding-2",
          isin: "INE009A01021", 
          symbol: "INFY",
          companyName: "Infosys Limited",
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 500,
          faceValue: 5,
          marketValue: 925000,
          currentPrice: 1850.25,
          avgCostPrice: 1780.60,
          totalCostValue: 890300,
          unrealizedGainLoss: 34700,
          gainLossPercentage: 3.90,
          pledgedQuantity: 50,
          lockedQuantity: 0,
          availableQuantity: 450,
          transactions: [
            {
              date: "2024-09-10",
              type: "BUY",
              quantity: 300,
              price: 1765.80,
              value: 529740
            },
            {
              date: "2024-11-05",
              type: "BUY",
              quantity: 200,
              price: 1802.80,
              value: 360560
            }
          ]
        },
        {
          id: "nsdl-holding-3",
          isin: "INE040A01034",
          symbol: "HDFCBANK",
          companyName: "HDFC Bank Limited", 
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 300,
          faceValue: 1,
          marketValue: 495000,
          currentPrice: 1650.75,
          avgCostPrice: 1580.25,
          totalCostValue: 474075,
          unrealizedGainLoss: 20925,
          gainLossPercentage: 4.41,
          pledgedQuantity: 0,
          lockedQuantity: 25,
          availableQuantity: 275,
          transactions: [
            {
              date: "2024-07-22",
              type: "BUY",
              quantity: 200,
              price: 1565.50,
              value: 313100
            },
            {
              date: "2024-12-12",
              type: "BUY",
              quantity: 100,
              price: 1609.75,
              value: 160975
            }
          ]
        }
      ];

      // Filter by ISIN if provided
      let filteredHoldings = isin ? nsdlHoldings.filter(h => h.isin === isin) : nsdlHoldings;

      const summary = {
        totalHoldings: filteredHoldings.length,
        totalMarketValue: filteredHoldings.reduce((sum, h) => sum + h.marketValue, 0),
        totalCostValue: filteredHoldings.reduce((sum, h) => sum + h.totalCostValue, 0),
        totalUnrealizedGainLoss: filteredHoldings.reduce((sum, h) => sum + h.unrealizedGainLoss, 0),
        averageGainLossPercentage: (filteredHoldings.reduce((sum, h) => sum + h.gainLossPercentage, 0) / filteredHoldings.length).toFixed(2),
        totalPledgedValue: filteredHoldings.reduce((sum, h) => sum + (h.pledgedQuantity * h.currentPrice), 0)
      };

      res.json({
        status: "success",
        data: filteredHoldings,
        summary,
        depository: "NSDL",
        searchCriteria: { pan, fromDate, toDate, isin },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NSDL holdings:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSDL holdings data"
      });
    }
  });

  // NSDL capital gains report
  app.get("/api/nsdl/capital-gains", async (req, res) => {
    try {
      const { pan, financialYear, transactionType } = req.query;

      const nsdlCapitalGains = [
        {
          id: "nsdl-cg-1",
          isin: "INE002A01018",
          symbol: "RELIANCE",
          companyName: "Reliance Industries Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2023-05-15",
          sellDate: "2024-08-20",
          buyPrice: 2280.50,
          sellPrice: 2450.75,
          quantity: 100,
          buyValue: 228050,
          sellValue: 245075,
          brokerage: 450,
          stt: 612.19,
          otherCharges: 125.50,
          netRealizedGain: 15837.31,
          taxableGain: 15837.31,
          taxRate: 12.5, // LTCG tax rate
          taxLiability: 1979.66,
          netGainAfterTax: 13857.65,
          holdingPeriod: 462 // days
        },
        {
          id: "nsdl-cg-2", 
          isin: "INE009A01021",
          symbol: "INFY",
          companyName: "Infosys Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          buyDate: "2024-04-10",
          sellDate: "2024-09-25",
          buyPrice: 1680.25,
          sellPrice: 1820.75,
          quantity: 200,
          buyValue: 336050,
          sellValue: 364150,
          brokerage: 350,
          stt: 910.38,
          otherCharges: 95.75,
          netRealizedGain: 26743.87,
          taxableGain: 26743.87,
          taxRate: 20, // STCG tax rate
          taxLiability: 5348.77,
          netGainAfterTax: 21395.10,
          holdingPeriod: 168 // days
        },
        {
          id: "nsdl-cg-3",
          isin: "INE040A01034",
          symbol: "HDFCBANK", 
          companyName: "HDFC Bank Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2022-12-05",
          sellDate: "2024-06-18",
          buyPrice: 1425.80,
          sellPrice: 1580.90,
          quantity: 150,
          buyValue: 213870,
          sellValue: 237135,
          brokerage: 295,
          stt: 592.84,
          otherCharges: 78.25,
          netRealizedGain: 22198.91,
          taxableGain: 22198.91,
          taxRate: 12.5,
          taxLiability: 2774.86,
          netGainAfterTax: 19424.05,
          holdingPeriod: 561 // days
        }
      ];

      // Filter by financial year and transaction type if provided
      let filteredGains = nsdlCapitalGains;
      if (financialYear) {
        filteredGains = filteredGains.filter(cg => cg.financialYear === financialYear);
      }
      if (transactionType) {
        filteredGains = filteredGains.filter(cg => cg.transactionType === transactionType);
      }

      const summary = {
        totalTransactions: filteredGains.length,
        totalRealizedGains: filteredGains.reduce((sum, cg) => sum + cg.netRealizedGain, 0),
        totalTaxLiability: filteredGains.reduce((sum, cg) => sum + cg.taxLiability, 0),
        totalNetGainAfterTax: filteredGains.reduce((sum, cg) => sum + cg.netGainAfterTax, 0),
        longTermGains: filteredGains.filter(cg => cg.transactionType === 'LONG_TERM').length,
        shortTermGains: filteredGains.filter(cg => cg.transactionType === 'SHORT_TERM').length,
        averageHoldingPeriod: Math.round(filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) / filteredGains.length)
      };

      res.json({
        status: "success",
        data: filteredGains,
        summary,
        depository: "NSDL",
        searchCriteria: { pan, financialYear, transactionType },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NSDL capital gains:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSDL capital gains data"
      });
    }
  });

  // CDSL API endpoints for depository services
  app.get("/api/cdsl/holdings", async (req, res) => {
    try {
      const { pan, fromDate, toDate, isin } = req.query;
      
      const cdslHoldings = [
        {
          id: "cdsl-holding-1",
          isin: "INE467B01029",
          symbol: "ASIANPAINT",
          companyName: "Asian Paints Limited",
          depository: "CDSL",
          dpId: "12018600",
          clientId: "00123456",
          holdingDate: "2025-01-27",
          quantity: 180,
          faceValue: 1,
          marketValue: 558000,
          currentPrice: 3100.25,
          avgCostPrice: 2980.50,
          totalCostValue: 536490,
          unrealizedGainLoss: 21510,
          gainLossPercentage: 4.01,
          pledgedQuantity: 0,
          lockedQuantity: 0,
          availableQuantity: 180,
          transactions: [
            {
              date: "2024-06-20",
              type: "BUY",
              quantity: 80,
              price: 2960.75,
              value: 236860
            },
            {
              date: "2024-09-15",
              type: "BUY",
              quantity: 100,
              price: 2995.30,
              value: 299530
            }
          ]
        },
        {
          id: "cdsl-holding-2",
          isin: "INE081A01020",
          symbol: "WIPRO",
          companyName: "Wipro Limited",
          depository: "CDSL", 
          dpId: "12018600",
          clientId: "00123456",
          holdingDate: "2025-01-27",
          quantity: 400,
          faceValue: 2,
          marketValue: 180000,
          currentPrice: 450.75,
          avgCostPrice: 425.80,
          totalCostValue: 170320,
          unrealizedGainLoss: 9680,
          gainLossPercentage: 5.68,
          pledgedQuantity: 100,
          lockedQuantity: 0,
          availableQuantity: 300,
          transactions: [
            {
              date: "2024-08-05",
              type: "BUY",
              quantity: 250,
              price: 420.60,
              value: 105150
            },
            {
              date: "2024-10-30",
              type: "BUY",
              quantity: 150,
              price: 434.80,
              value: 65220
            }
          ]
        },
        {
          id: "cdsl-holding-3",
          isin: "INE758T01015",
          symbol: "BAJFINANCE",
          companyName: "Bajaj Finance Limited",
          depository: "CDSL",
          dpId: "12018600", 
          clientId: "00123456",
          holdingDate: "2025-01-27",
          quantity: 120,
          faceValue: 2,
          marketValue: 825600,
          currentPrice: 6880.50,
          avgCostPrice: 6720.25,
          totalCostValue: 806430,
          unrealizedGainLoss: 19170,
          gainLossPercentage: 2.38,
          pledgedQuantity: 0,
          lockedQuantity: 10,
          availableQuantity: 110,
          transactions: [
            {
              date: "2024-07-12",
              type: "BUY", 
              quantity: 70,
              price: 6695.50,
              value: 468685
            },
            {
              date: "2024-11-25",
              type: "BUY",
              quantity: 50,
              price: 6754.90,
              value: 337745
            }
          ]
        }
      ];

      // Filter by ISIN if provided
      let filteredHoldings = isin ? cdslHoldings.filter(h => h.isin === isin) : cdslHoldings;

      const summary = {
        totalHoldings: filteredHoldings.length,
        totalMarketValue: filteredHoldings.reduce((sum, h) => sum + h.marketValue, 0),
        totalCostValue: filteredHoldings.reduce((sum, h) => sum + h.totalCostValue, 0),
        totalUnrealizedGainLoss: filteredHoldings.reduce((sum, h) => sum + h.unrealizedGainLoss, 0),
        averageGainLossPercentage: (filteredHoldings.reduce((sum, h) => sum + h.gainLossPercentage, 0) / filteredHoldings.length).toFixed(2),
        totalPledgedValue: filteredHoldings.reduce((sum, h) => sum + (h.pledgedQuantity * h.currentPrice), 0)
      };

      res.json({
        status: "success",
        data: filteredHoldings,
        summary,
        depository: "CDSL",
        searchCriteria: { pan, fromDate, toDate, isin },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching CDSL holdings:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch CDSL holdings data"
      });
    }
  });

  // CDSL capital gains report
  app.get("/api/cdsl/capital-gains", async (req, res) => {
    try {
      const { pan, financialYear, transactionType } = req.query;

      const cdslCapitalGains = [
        {
          id: "cdsl-cg-1",
          isin: "INE467B01029", 
          symbol: "ASIANPAINT",
          companyName: "Asian Paints Limited",
          depository: "CDSL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2023-03-20",
          sellDate: "2024-07-15",
          buyPrice: 2650.80,
          sellPrice: 2850.25,
          quantity: 150,
          buyValue: 397620,
          sellValue: 427537.50,
          brokerage: 425,
          stt: 1068.84,
          otherCharges: 145.25,
          netRealizedGain: 28278.41,
          taxableGain: 28278.41,
          taxRate: 12.5,
          taxLiability: 3534.80,
          netGainAfterTax: 24743.61,
          holdingPeriod: 482 // days
        },
        {
          id: "cdsl-cg-2",
          isin: "INE081A01020",
          symbol: "WIPRO", 
          companyName: "Wipro Limited",
          depository: "CDSL",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          buyDate: "2024-05-20",
          sellDate: "2024-10-10",
          buyPrice: 380.50,
          sellPrice: 425.75,
          quantity: 300,
          buyValue: 114150,
          sellValue: 127725,
          brokerage: 245,
          stt: 319.18,
          otherCharges: 68.50,
          netRealizedGain: 12942.32,
          taxableGain: 12942.32,
          taxRate: 20,
          taxLiability: 2588.46,
          netGainAfterTax: 10353.86,
          holdingPeriod: 143 // days
        },
        {
          id: "cdsl-cg-3",
          isin: "INE758T01015",
          symbol: "BAJFINANCE",
          companyName: "Bajaj Finance Limited", 
          depository: "CDSL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2023-01-10",
          sellDate: "2024-09-05",
          buyPrice: 6120.50,
          sellPrice: 6650.75,
          quantity: 80,
          buyValue: 489640,
          sellValue: 532060,
          brokerage: 520,
          stt: 1330.15,
          otherCharges: 175.80,
          netRealizedGain: 40034.05,
          taxableGain: 40034.05,
          taxRate: 12.5,
          taxLiability: 5004.26,
          netGainAfterTax: 35029.79,
          holdingPeriod: 603 // days
        }
      ];

      // Filter by financial year and transaction type if provided
      let filteredGains = cdslCapitalGains;
      if (financialYear) {
        filteredGains = filteredGains.filter(cg => cg.financialYear === financialYear);
      }
      if (transactionType) {
        filteredGains = filteredGains.filter(cg => cg.transactionType === transactionType);
      }

      const summary = {
        totalTransactions: filteredGains.length,
        totalRealizedGains: filteredGains.reduce((sum, cg) => sum + cg.netRealizedGain, 0),
        totalTaxLiability: filteredGains.reduce((sum, cg) => sum + cg.taxLiability, 0),
        totalNetGainAfterTax: filteredGains.reduce((sum, cg) => sum + cg.netGainAfterTax, 0),
        longTermGains: filteredGains.filter(cg => cg.transactionType === 'LONG_TERM').length,
        shortTermGains: filteredGains.filter(cg => cg.transactionType === 'SHORT_TERM').length,
        averageHoldingPeriod: Math.round(filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) / filteredGains.length)
      };

      res.json({
        status: "success",
        data: filteredGains,
        summary,
        depository: "CDSL",
        searchCriteria: { pan, financialYear, transactionType },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching CDSL capital gains:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch CDSL capital gains data"
      });
    }
  });

  // Combined NSDL + CDSL comprehensive search
  app.get("/api/depository/combined-search", async (req, res) => {
    try {
      const { pan, fromDate, toDate, isin, reportType = 'holdings' } = req.query;

      // Fetch from both depositories
      const [nsdlResponse, cdslResponse] = await Promise.all([
        fetch(`${req.protocol}://${req.get('host')}/api/nsdl/${reportType as string}?${new URLSearchParams(req.query as any)}`),
        fetch(`${req.protocol}://${req.get('host')}/api/cdsl/${reportType as string}?${new URLSearchParams(req.query as any)}`)
      ]);

      const [nsdlData, cdslData] = await Promise.all([
        nsdlResponse.json(),
        cdslResponse.json()
      ]);

      const combinedData = [
        ...nsdlData.data,
        ...cdslData.data
      ];

      // Calculate combined statistics
      const combinedSummary = {
        totalRecords: combinedData.length,
        nsdlRecords: nsdlData.data.length,
        cdslRecords: cdslData.data.length,
        ...(reportType === 'holdings' ? {
          totalMarketValue: combinedData.reduce((sum, item) => sum + (item.marketValue || 0), 0),
          totalCostValue: combinedData.reduce((sum, item) => sum + (item.totalCostValue || 0), 0),
          totalUnrealizedGainLoss: combinedData.reduce((sum, item) => sum + (item.unrealizedGainLoss || 0), 0),
          averageGainLossPercentage: (combinedData.reduce((sum, item) => sum + (item.gainLossPercentage || 0), 0) / combinedData.length).toFixed(2)
        } : {
          totalRealizedGains: combinedData.reduce((sum, item) => sum + (item.netRealizedGain || 0), 0),
          totalTaxLiability: combinedData.reduce((sum, item) => sum + (item.taxLiability || 0), 0),
          totalNetGainAfterTax: combinedData.reduce((sum, item) => sum + (item.netGainAfterTax || 0), 0)
        })
      };

      res.json({
        status: "success",
        data: combinedData,
        summary: combinedSummary,
        nsdlSummary: nsdlData.summary,
        cdslSummary: cdslData.summary,
        depositories: ["NSDL", "CDSL"],
        reportType,
        searchCriteria: { pan, fromDate, toDate, isin },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching combined depository data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch combined depository data"
      });
    }
  });

  // Test routes — development/staging only, disabled in production
  if (!isProductionEnvironment()) {
  // Test AMFI integration
  app.get("/api/test-amfi", async (req, res) => {
    try {
      console.log('🧪 Testing AMFI integration...');
      const popularFunds = await amfiService.getPopularFundsWithPerformance();
      res.json({
        success: true,
        source: (popularFunds[0] as any)?.provenance?.primarySource || 'unknown',
        fundsCount: popularFunds.length,
        sampleFund: popularFunds[0]
      });
    } catch (error) {
      console.error('❌ AMFI test failed:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Twilio SMS test endpoint
  app.post("/api/test/twilio-sms", async (req, res) => {
    try {
      const { mobile } = req.body;
      
      if (!mobile) {
        return res.status(400).json({ 
          success: false, 
          error: "Mobile number is required" 
        });
      }

      const { smsService } = await import("../services/sms-service");
      
      if (!smsService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: "Twilio SMS service not configured",
          message: "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER"
        });
      }

      const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`🧪 Testing Twilio SMS to ${mobile.substring(0, 4)}****`);
      
      const result = await smsService.sendOTP(mobile, testOTP);
      
      res.json({
        success: result,
        message: result ? "Test SMS sent successfully" : "Failed to send SMS",
        mobile: `${mobile.substring(0, 4)}****${mobile.slice(-2)}`,
        testOTP: process.env.NODE_ENV === "development" ? testOTP : undefined
      });
    } catch (error: any) {
      console.error("❌ Twilio SMS test failed:", error);
      res.status(500).json({ 
        success: false,
        error: error.message || String(error)
      });
    }
  });

  // Twilio WhatsApp test endpoint
  app.post("/api/test/twilio-whatsapp", async (req, res) => {
    try {
      const { mobile, message, alertType, details } = req.body;
      
      if (!mobile) {
        return res.status(400).json({ success: false, error: "Mobile number is required" });
      }

      const { twilioWhatsAppService } = await import("../services/twilio-whatsapp-service");
      
      if (!twilioWhatsAppService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: "WhatsApp service not configured",
          message: "Missing TWILIO_WHATSAPP_NUMBER or TWILIO_PHONE_NUMBER"
        });
      }

      let result;
      if (alertType && details) {
        result = await twilioWhatsAppService.sendPortfolioAlert(mobile, alertType, details);
      } else {
        result = await twilioWhatsAppService.sendMessage(mobile, message || "Test message from FintekPro");
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("❌ WhatsApp test failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Twilio Verify test endpoint
  app.post("/api/test/twilio-verify", async (req, res) => {
    try {
      const { mobile, email, channel, code, action } = req.body;
      
      const { twilioVerifyService } = await import("../services/twilio-verify-service");
      
      if (!twilioVerifyService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: "Verify service not configured",
          message: "Missing TWILIO_VERIFY_SERVICE_SID - Create a Verify Service in Twilio Console"
        });
      }

      if (action === "check" && code) {
        const to = email || mobile;
        if (!to) {
          return res.status(400).json({ success: false, error: "Mobile or email required" });
        }
        const result = await twilioVerifyService.checkVerification(to, code);
        return res.json(result);
      }

      const to = channel === "email" ? email : mobile;
      if (!to) {
        return res.status(400).json({ success: false, error: "Mobile or email required based on channel" });
      }

      const result = await twilioVerifyService.sendVerification(to, channel || "sms");
      res.json(result);
    } catch (error: any) {
      console.error("❌ Verify test failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Twilio Voice OTP test endpoint
  app.post("/api/test/twilio-voice", async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      
      if (!mobile) {
        return res.status(400).json({ success: false, error: "Mobile number is required" });
      }

      const { twilioVoiceService } = await import("../services/twilio-voice-service");
      
      if (!twilioVoiceService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: "Voice service not configured",
          message: "Missing Twilio credentials"
        });
      }

      const testOTP = otp || Math.floor(100000 + Math.random() * 900000).toString();
      console.log("🧪 Testing Twilio Voice OTP to " + mobile.substring(0, 4) + "****");
      
      const result = await twilioVoiceService.sendOTPCall(mobile, testOTP);
      
      res.json({
        ...result,
        testOTP: process.env.NODE_ENV === "development" ? testOTP : undefined
      });
    } catch (error: any) {
      console.error("❌ Voice test failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  } // end !isProductionEnvironment() — test routes block

  // AMFI API endpoints for mutual fund data
  app.get("/api/amfi/mutual-funds", async (req, res) => {
    try {
      const { category, amc, nav_min, nav_max, returns_period = '1Y', sort_by = 'returns' } = req.query;
      
      // Get real AMFI data
      const popularFunds = await amfiService.getPopularFundsWithPerformance();
      
      // Transform AMFI data to API format
      let amfiMutualFunds = popularFunds.map((fund, index) => ({
        id: `amfi-mf-${index + 1}`,
        scheme_code: fund.schemeCode,
        scheme_name: fund.schemeName,
        amc: fund.fundHouse,
        category: fund.category,
        sub_category: fund.category,
        nav: fund.currentNav,
        nav_date: fund.lastUpdated,
        fund_size: "N/A", // Not available in MF API
        expense_ratio: 1.2, // Default value, not available in free API
        min_investment: 5000,
        fund_manager: "N/A",
        benchmark: "N/A",
        launch_date: "N/A",
        returns: {
          "1D": null,
          "1W": null,
          "1M": fund.returns['1M'] || 0,
          "3M": null,
          "6M": fund.returns['6M'] || 0,
          "1Y": fund.returns['1Y'] || 0,
          "2Y": null,
          "3Y": fund.returns['3Y'] || 0,
          "5Y": fund.returns['5Y'] || 0,
          "since_inception": null
        },
        risk_level: "Moderate",
        rating: 4,
        exit_load: "1% if redeemed within 365 days"
      }));
      
      // Using only real AMFI data - mock funds removed

      // Filter by category if provided
      let filteredFunds = category ? amfiMutualFunds.filter(fund => 
        fund.category.toLowerCase().includes(String(category).toLowerCase()) ||
        fund.sub_category.toLowerCase().includes(String(category).toLowerCase())
      ) : amfiMutualFunds;

      // Filter by AMC if provided
      if (amc) {
        filteredFunds = filteredFunds.filter(fund => 
          fund.amc.toLowerCase().includes(String(amc).toLowerCase())
        );
      }

      // Filter by NAV range if provided
      if (nav_min) {
        filteredFunds = filteredFunds.filter(fund => fund.nav >= parseFloat(String(nav_min)));
      }
      if (nav_max) {
        filteredFunds = filteredFunds.filter(fund => fund.nav <= parseFloat(String(nav_max)));
      }

      // Sort by returns or other criteria
      if (sort_by === 'returns') {
        const period = String(returns_period || '1Y');
        filteredFunds.sort((a, b) => ((b.returns as any)[period] || 0) - ((a.returns as any)[period] || 0));
      } else if (sort_by === 'nav') {
        filteredFunds.sort((a, b) => b.nav - a.nav);
      } else if (sort_by === 'fund_size') {
        filteredFunds.sort((a, b) => {
          const parseSize = (size: any) => parseFloat(size.replace(/[₹,\sCr]/g, ''));
          return parseSize(b.fund_size) - parseSize(a.fund_size);
        });
      }

      const summary = {
        totalFunds: filteredFunds.length,
        avgReturns1Y: (filteredFunds.reduce((sum, fund) => sum + fund.returns["1Y"], 0) / filteredFunds.length).toFixed(2),
        avgExpenseRatio: (filteredFunds.reduce((sum, fund) => sum + fund.expense_ratio, 0) / filteredFunds.length).toFixed(2),
        topPerformer: filteredFunds[0]?.scheme_name || "N/A",
        categories: Array.from(new Set(filteredFunds.map(fund => fund.category))),
        amcList: Array.from(new Set(filteredFunds.map(fund => fund.amc)))
      };

      res.json({
        status: "success",
        data: filteredFunds,
        summary,
        filters: { category, amc, nav_min, nav_max, returns_period, sort_by },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching AMFI mutual funds:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch mutual fund data from AMFI"
      });
    }
  });

  // AMFI NAV history endpoint
  app.get("/api/amfi/nav-history/:scheme_code", async (req, res) => {
    try {
      const { scheme_code } = req.params;
      const { period = '1Y' } = req.query;

      const navHistory = [
        { date: "2025-01-27", nav: 87.4521 },
        { date: "2025-01-26", nav: 87.0654 },
        { date: "2025-01-25", nav: 86.8901 },
        { date: "2025-01-24", nav: 87.2134 },
        { date: "2025-01-23", nav: 86.9876 },
        { date: "2025-01-22", nav: 87.5432 },
        { date: "2025-01-21", nav: 87.1098 },
        { date: "2025-01-20", nav: 86.7654 },
        { date: "2025-01-19", nav: 87.0012 },
        { date: "2025-01-18", nav: 86.8765 },
        { date: "2025-01-17", nav: 87.3210 },
        { date: "2025-01-16", nav: 86.9543 },
        { date: "2025-01-15", nav: 87.1876 },
        { date: "2025-01-14", nav: 86.8098 },
        { date: "2025-01-13", nav: 87.4321 }
      ];

      const analytics = {
        currentNAV: navHistory[0].nav,
        periodStart: navHistory[navHistory.length - 1].nav,
        periodReturn: (((navHistory[0].nav - navHistory[navHistory.length - 1].nav) / navHistory[navHistory.length - 1].nav) * 100).toFixed(2),
        volatility: "2.45%",
        maxNAV: Math.max(...navHistory.map(h => h.nav)),
        minNAV: Math.min(...navHistory.map(h => h.nav)),
        avgNAV: (navHistory.reduce((sum, h) => sum + h.nav, 0) / navHistory.length).toFixed(4)
      };

      res.json({
        status: "success",
        scheme_code,
        period,
        data: navHistory,
        analytics,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NAV history:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NAV history data"
      });
    }
  });

  // AMFI fund categories endpoint
  app.get("/api/amfi/categories", async (req, res) => {
    try {
      // Get real AMFI fund categories
      const realCategories = await amfiService.getFundCategories();
      
      // Transform to expected format and add fallback mock data if needed
      const categories = realCategories.length > 0 ? realCategories.map(cat => ({
        category: cat.name,
        description: cat.description,
        riskLevel: cat.riskLevel,
        fundCount: cat.funds.length,
        subcategories: [{
          name: cat.name,
          count: cat.funds.length,
          avgReturns1Y: cat.funds.length > 0 ? 
            (cat.funds.reduce((sum, fund) => sum + (fund.returns['1Y'] || 0), 0) / cat.funds.length) : 0,
          riskLevel: cat.riskLevel,
          description: cat.description
        }]
      })) : [];

      const summary = {
        totalCategories: categories.length,
        totalSubcategories: categories.reduce((sum, cat) => sum + cat.subcategories.length, 0),
        totalFunds: categories.reduce((sum, cat) => 
          sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.count, 0), 0),
        avgReturns1Y: (categories.reduce((sum, cat) => 
          sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.avgReturns1Y * sub.count, 0), 0) / 
          categories.reduce((sum, cat) => 
            sum + cat.subcategories.reduce((subSum, sub) => subSum + sub.count, 0), 0)).toFixed(2)
      };

      res.json({
        status: "success",
        data: categories,
        summary,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching AMFI categories:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch mutual fund categories"
      });
    }
  });

  // Fund Comparison API endpoints
  app.post("/api/funds/compare", async (req, res) => {
    try {
      const { fundCodes, timePeriod = '1Y', comparisonType = 'detailed' } = req.body;
      const userId = req.user?.id || 'anonymous';

      if (!fundCodes || !Array.isArray(fundCodes) || fundCodes.length < 2) {
        return res.status(400).json({
          status: "error",
          error: "At least 2 fund codes are required for comparison"
        });
      }

      if (fundCodes.length > 5) {
        return res.status(400).json({
          status: "error", 
          error: "Maximum 5 funds can be compared at once"
        });
      }

      const fundComparisonService = new FundComparisonService(storage as any);
      const comparison = await fundComparisonService.compareFunds(fundCodes, timePeriod);

      // Store comparison in database
      const comparisonRecord = await db.insert(fundComparisons).values({
        fundCodes: JSON.stringify(fundCodes),
        comparisonType,
        timePeriod,
        results: JSON.stringify(comparison),
        insights: (comparison as any).insights,
        recommendation: (comparison as any).recommendation
      } as any).returning();

      // Log comparison action in history
      await db.insert(comparisonHistory).values({
        comparisonType: 'fund',
        comparisonId: comparisonRecord[0].id,
        action: 'created',
        metadata: { fundCodes, timePeriod, comparisonType }
      } as any);

      res.json({
        status: "success",
        data: comparison,
        comparisonId: comparisonRecord[0].id,
        createdAt: comparisonRecord[0].createdAt
      });

    } catch (error) {
      console.error("Error comparing funds:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to compare funds"
      });
    }
  });

  app.get("/api/funds/compare/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const comparison = await db.select()
        .from(fundComparisons)
        .where(eq(fundComparisons.id, id))
        .limit(1);

      if (comparison.length === 0) {
        return res.status(404).json({
          status: "error",
          error: "Comparison not found"
        });
      }

      const comparisonData = comparison[0];
      res.json({
        status: "success",
        data: {
          ...comparisonData,
          results: JSON.parse(String(comparisonData.results || '{}')) as any,
          fundCodes: JSON.parse(String(comparisonData.fundCodes)) as any
        }
      });

    } catch (error) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch comparison"
      });
    }
  });

  app.get("/api/users/:userId/fund-comparisons", async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      
      const comparisons = await db.select()
        .from(fundComparisons)
        .where(eq(fundComparisons.userId, userId))
        .orderBy(sql`${fundComparisons.createdAt} DESC`)
        .limit(Number(limit))
        .offset(Number(offset));

      const formattedComparisons = comparisons.map(comp => ({
        ...comp,
        results: JSON.parse(String(comp.results || '{}')) as any,
        fundCodes: JSON.parse(String(comp.fundCodes)) as any
      }));

      res.json({
        status: "success",
        data: formattedComparisons,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: comparisons.length
        }
      });

    } catch (error) {
      console.error("Error fetching user comparisons:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch comparison history"
      });
    }
  });

  // ===== Portfolio Comparison API =====
}
