// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, gte, sql, count, inArray } from 'drizzle-orm';
import { requireAdmin } from '../middleware/roleMiddleware';
import * as schema from "@shared/schema";

function hasRole(user: any, roles: string[]): boolean {
  const userRole = user?.role || user?.userRole || '';
  return roles.includes(userRole);
}


const requireClientOrHigher = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['user', 'client', 'business_client', 'agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Client access required" });
  }
  
  next();
};

export function registerUserProfileKYCPart1Part2Routes(app: Express): void {
app.post("/api/profile/trigger-rekyc", requireClientOrHigher, async (req, res) => {
  try {
    const { resetReKYCProcess } = await import("../rekyc-service");
    const userId = req.user!.id;
    
    const result = await resetReKYCProcess(userId);
    
    res.json({
      success: true,
      message: "Re-KYC process initiated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error triggering Re-KYC:", error);
    res.status(500).json({
      success: false,
      error: "Failed to trigger Re-KYC process",
    });
  }
});

// KYC Upgrade Notification Status - for persistent banner and progress widget
app.get("/api/kyc/notification-status", async (req, res) => {
  try {
    // Allow unauthenticated access - return empty state
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.json({
        hasIncompleteKyc: false,
        currentTier: 'none',
        percentComplete: 0,
        missingSteps: [],
        blockedProducts: [],
        urgencyLevel: 'low',
        notifications: [],
      });
    }

    const userId = req.user!.id;
    const { kycUpgradeNotificationService } = await import("../services/kyc-upgrade-notification-service");
    const status = await kycUpgradeNotificationService.getPendingNotifications(userId);
    
    res.json(status);
  } catch (error) {
    console.error("Error getting KYC notification status:", error);
    res.json({
      hasIncompleteKyc: false,
      currentTier: 'none',
      percentComplete: 0,
      missingSteps: [],
      blockedProducts: [],
      urgencyLevel: 'low',
      notifications: [],
    });
  }
});


// Verify PAN — provider priority comes from admin/kyc-flow page (kyc_flow_config_overrides in DB).
// Iterates providers in priority order, skips unconfigured ones, falls through on failure.
app.post("/api/kyc/verify-pan", async (req, res) => {
  try {
    const { panNumber, name } = req.body;

    if (!panNumber) {
      return res.status(400).json({ success: false, error: "PAN number is required", verified: false });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const normalizedPan = panNumber.toUpperCase().trim();

    if (!panRegex.test(normalizedPan)) {
      return res.status(400).json({ success: false, error: "Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F)", verified: false });
    }

    const { getOrderedPanProviders } = await import('./kyc-flow-routes');
    const providers = await getOrderedPanProviders();
    const safeName = name || "Name Not Provided";

    console.log(`[KYC] PAN verify — provider order from admin/kyc-flow: ${providers.map((p: any) => `${p.providerId}(p${p.priority},${p.isConfigured ? 'ready' : 'not-configured'})`).join(' → ')}`);

    for (const provider of providers) {
      if (!provider.isConfigured) {
        console.log(`[KYC] Skipping ${provider.providerId} — not configured`);
        continue;
      }

      try {
        if (provider.providerId === 'cashfree') {
          const { CashfreePANService } = await import('../services/cashfree-pan-service');
          const result = await CashfreePANService.verifyPAN(normalizedPan, safeName);
          if (result.verified || result.success) {
            return res.json({
              success: result.success,
              verified: result.verified,
              name: result.data?.registeredName || null,
              panType: result.data?.type || null,
              panStatus: result.data?.panStatus || null,
              aadhaarLinked: result.data?.aadhaarSeedingStatus === 'Y',
              provider: 'cashfree',
              message: result.message,
            });
          }
          console.warn(`[KYC] cashfree returned unverified — ${result.message}`);

        } else if (provider.providerId === 'sandbox') {
          const { sandboxPANService } = await import('../sandbox-pan-api');
          const result = await sandboxPANService.verifyPAN(normalizedPan, safeName);
          if (result && result.status === 'success' && result.data) {
            const d: any = result.data;
            const resolvedName = d.full_name || d.name || d.name_on_card || d.name_pan_card
              || (d.first_name && d.last_name ? `${d.first_name} ${d.last_name}`.trim() : null)
              || d.first_name || d.holder_name || null;
            return res.json({
              success: true,
              verified: d.status === 'VALID',
              name: resolvedName,
              panType: d.category || null,
              panStatus: d.status || null,
              aadhaarLinked: d.aadhaar_linked || false,
              provider: 'sandbox',
              message: result.message || 'PAN verified via Sandbox.co.in',
            });
          }
          console.warn(`[KYC] sandbox returned no usable data`);

        } else if (provider.providerId === 'truthscreen') {
          const { TruthScreenCkycAdapter } = await import('../services/adapters/truthscreen-ckyc-adapter');
          const adapter = new TruthScreenCkycAdapter();
          const result = await adapter.verify({ panNumber: normalizedPan, fullName: safeName, dateOfBirth: '' });
          if (result.success) {
            return res.json({
              success: true,
              verified: true,
              name: result.data?.fullName || null,
              panType: 'Individual',
              panStatus: 'VALID',
              provider: 'truthscreen',
              message: 'PAN verified via TruthScreen CKYC',
            });
          }
          console.warn(`[KYC] truthscreen returned: ${result.message}`);
        }
      } catch (providerErr) {
        console.warn(`[KYC] ${provider.providerId} threw error, trying next provider:`, providerErr instanceof Error ? providerErr.message : providerErr);
      }
    }

    return res.status(503).json({
      success: false,
      verified: false,
      error: "PAN not verified",
      message: "All configured providers failed or are unavailable",
    });
  } catch (error) {
    console.error("KYC PAN verification error:", error);
    res.status(500).json({ success: false, verified: false, error: "PAN verification failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});


// Get verified KYC profile data for current user
app.get("/api/profile/kyc-verified-data", async (req, res) => {
  try {
    // Allow unauthenticated access - return empty state
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.json({
        success: false,
        data: null,
        message: "Authentication required"
      });
    }

    const userId = req.user!.id;
    const { getVerifiedKYCProfile } = await import('../services/verified-kyc-profile-service');
    const verifiedData = await getVerifiedKYCProfile(userId);
    
    res.json({
      success: true,
      data: verifiedData
    });
  } catch (error) {
    console.error("Error fetching verified KYC data:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch verified KYC data"
    });
  }
});

// Schedule KYC reminders for a user (called after incomplete registration)
app.post("/api/kyc/schedule-reminders", requireClientOrHigher, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { kycUpgradeNotificationService } = await import("../services/kyc-upgrade-notification-service");
    await kycUpgradeNotificationService.scheduleReminders(userId);
    
    res.json({ success: true, message: "KYC reminders scheduled" });
  } catch (error) {
    console.error("Error scheduling KYC reminders:", error);
    res.status(500).json({ success: false, error: "Failed to schedule reminders" });
  }
});

// Acknowledge KYC reminder (when user clicks Complete KYC)
app.post("/api/kyc/acknowledge-reminder", requireClientOrHigher, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { reminderId } = req.body;
    const { kycUpgradeNotificationService } = await import("../services/kyc-upgrade-notification-service");
    await kycUpgradeNotificationService.acknowledgeReminder(userId, reminderId);
    
    res.json({ success: true, message: "Reminder acknowledged" });
  } catch (error) {
    console.error("Error acknowledging KYC reminder:", error);
    res.status(500).json({ success: false, error: "Failed to acknowledge reminder" });
  }
});

// Net Worth Aggregation API - Intelligent multi-source wealth tracking
app.get("/api/net-worth", requireClientOrHigher, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { includeFamily } = req.query;
    
    // Import required schemas
    const { 
      portfolios, portfolioHoldings, marketData, unifiedOrders, 
      loanApplications, loanRepayments, userBankAccounts, users,
      familyMembers, familyGroups
    } = await import("@shared/schema");
    
    // Get user and user profile for KYC information
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get user profile for KYC tier and net worth information
    const { userProfiles } = await import("@shared/schema");
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });
    
    let targetUserIds = [userId];
    
    // If family view is requested, get all family member IDs with permission checks
    if (includeFamily === 'true') {
      const familyMemberships = await db.query.familyMembers.findMany({
        where: sql`${familyMembers.userId} = ${userId} AND ${familyMembers.invitationStatus} = 'accepted' AND ${familyMembers.leftAt} IS NULL`,
      });
      
      if (familyMemberships.length > 0) {
        // Verify user is part of an active family
        const familyId = familyMemberships[0].familyId;
        
        // Get only accepted, active family members with proper permissions
        const allMembers = await db.query.familyMembers.findMany({
          where: sql`${familyMembers.familyId} = ${familyId} AND ${familyMembers.invitationStatus} = 'accepted' AND ${familyMembers.leftAt} IS NULL`,
        });
        
        // Only include members who have view permissions (not view_only role can see all)
        targetUserIds = allMembers
          .filter((m: any) => m.role !== 'view_only' || m.userId === userId)
          .map((m: any) => m.userId);
      } else {
        // User is not part of any accepted family membership, return only their data
        // Don't show error, just proceed with individual view
      }
    }
    
    // 1. AGGREGATE ASSETS - Portfolio Holdings with real-time market values
    const userPortfolios = await db.query.portfolios.findMany({
      where: inArray(portfolios.userId, targetUserIds),
    });
    
    // Fetch holdings separately (no Drizzle relations defined)
    const portfolioIds = userPortfolios.map((p: any) => p.id);
    const allHoldings = portfolioIds.length > 0 
      ? await db.query.portfolioHoldings.findMany({
          where: inArray(portfolioHoldings.portfolioId, portfolioIds),
        })
      : [];
    
    // Group holdings by portfolio ID
    const holdingsByPortfolio = new Map<string, typeof allHoldings>();
    for (const holding of allHoldings) {
      const existing = holdingsByPortfolio.get(holding.portfolioId) || [];
      existing.push(holding);
      holdingsByPortfolio.set(holding.portfolioId, existing);
    }
    // OPTIMIZATION: Batch fetch all unique symbols for market data (avoid N+1 queries)
    const allSymbols = new Set<string>();
    for (const portfolio of userPortfolios) {
      for (const holding of (holdingsByPortfolio.get(portfolio.id) || [])) {
        allSymbols.add(holding.symbol);
      }
    }
    
    // Fetch all market data in one query
    const symbolArray = Array.from(allSymbols);
    const marketDataMap = new Map<string, any>();
    
    if (symbolArray.length > 0) {
      const marketDataRecords = await db.query.marketData.findMany({
        where: inArray(marketData.symbol, symbolArray),
      });
      
      for (const record of marketDataRecords) {
        marketDataMap.set(record.symbol, record);
      }
    }
    
    let liquidAssets = [];
    let semiLiquidAssets = [];
    let illiquidAssets = [];
    let totalPortfolioValue = 0;
    
    for (const portfolio of userPortfolios) {
      for (const holding of (holdingsByPortfolio.get(portfolio.id) || [])) {
        // Get current market price from pre-fetched data
        const marketInfo = marketDataMap.get(holding.symbol);
        
        const currentPrice = marketInfo?.price ? parseFloat(marketInfo.price.toString()) : parseFloat((holding as any).avgPrice.toString());
        const quantity = parseFloat(holding.quantity.toString());
        const currentValue = currentPrice * quantity;
        totalPortfolioValue += currentValue;
        
        const asset = {
          name: holding.symbol,
          type: holding.assetType,
          value: currentValue,
          quantity: quantity,
          currentPrice: currentPrice,
          avgPrice: parseFloat((holding as any).avgPrice.toString()),
          gainLoss: currentValue - (parseFloat((holding as any).avgPrice.toString()) * quantity),
          currency: (holding as any).currency || 'INR',
          portfolioId: portfolio.id,
          portfolioName: portfolio.name
        };
        
        // Smart categorization based on asset type and liquidity
        if (holding.assetType === 'equity' || holding.assetType === 'commodity') {
          liquidAssets.push(asset); // Can sell within 24h
        } else if (holding.assetType === 'mf' || holding.assetType === 'bond' || holding.assetType === 'gold') {
          semiLiquidAssets.push(asset); // 1-7 days
        } else {
          illiquidAssets.push(asset); // Alternative investments, etc.
        }
      }
    }
    
    // 2. BANK ACCOUNTS - Verified cash balances
    const bankAccounts = await db.query.userBankAccounts.findMany({
      where: and(inArray(userBankAccounts.userId, targetUserIds), eq(userBankAccounts.isActive, true)),
    });
    
    // Note: We don't have real-time balance API, so we use cash from portfolios
    const totalCash = userPortfolios.reduce((sum: any, p: any) => sum + parseFloat(p.cash?.toString() || '0'), 0);
    
    if (totalCash > 0) {
      liquidAssets.push({
        name: 'Cash & Bank Balance',
        type: 'cash',
        value: totalCash,
        quantity: 1,
        currentPrice: totalCash,
        avgPrice: totalCash,
        gainLoss: 0,
        currency: 'INR',
        bankAccounts: bankAccounts.length
      });
    }
    
    // 3. PENDING INVESTMENTS - Orders in process
    const pendingOrders = await db.query.unifiedOrders.findMany({
      where: and(inArray(unifiedOrders.userId, targetUserIds), inArray(unifiedOrders.status, ['initiated', 'payment_pending', 'payment_completed', 'processing'])),
    });
    
    const pendingInvestments = pendingOrders.map((order: any) => ({
      orderNumber: order.orderNumber,
      productName: order.productName,
      productType: order.productType,
      amount: parseFloat(order.amount.toString()),
      status: order.status,
      createdAt: order.createdAt
    }));
    
    const totalPendingValue = pendingInvestments.reduce((sum: any, inv: any) => sum + inv.amount, 0);
    
    // 4. DECLARED ASSETS from KYC (for accredited investors)
    let declaredAssets = 0;
    if (userProfile?.kycTier === 'accredited_investor' && userProfile.netWorthAmount) {
      declaredAssets = parseFloat(userProfile.netWorthAmount.toString());
    }
    
    // 5. AGGREGATE LIABILITIES - Loans and Credit
    const loans = await db.query.loanApplications.findMany({
      where: and(inArray(loanApplications.userId, targetUserIds), inArray(loanApplications.status, ['approved', 'disbursed'])),
    });
    
    let shortTermLiabilities = [];
    let longTermLiabilities = [];
    let totalLiabilities = 0;
    
    for (const loan of loans) {
      const approvedAmount = parseFloat(loan.approvedAmount?.toString() || '0');
      
      // Get repayments to calculate outstanding amount
      const repayments = await db.query.loanRepayments.findMany({
        where: eq(loanRepayments.loanId, loan.id),
      });
      
      const totalRepaid = repayments.reduce((sum: any, r: any) => sum + parseFloat(r.paymentAmount?.toString() || '0'), 0);
      const outstandingAmount = approvedAmount - totalRepaid;
      
      if (outstandingAmount > 0) {
        totalLiabilities += outstandingAmount;
        
        const liability = {
          applicationNumber: loan.applicationNumber || loan.id,
          type: loan.isOverdraftFacility ? 'Overdraft Facility' : 'Loan Against Securities',
          originalAmount: approvedAmount,
          outstandingAmount: outstandingAmount,
          interestRate: parseFloat(loan.interestRate?.toString() || '0'),
          tenure: loan.tenure || 0,
          status: loan.status
        };
        
        // Categorize by tenure
        if (loan.tenure && loan.tenure <= 12) {
          shortTermLiabilities.push(liability);
        } else {
          longTermLiabilities.push(liability);
        }
      }
    }
    
    // 6. CALCULATE NET WORTH AND METRICS
    const totalAssets = totalPortfolioValue + totalCash + totalPendingValue;
    const netWorth = totalAssets - totalLiabilities;
    const liquidAssetsValue = liquidAssets.reduce((sum: any, a: any) => sum + a.value, 0);
    const semiLiquidAssetsValue = semiLiquidAssets.reduce((sum: any, a: any) => sum + a.value, 0);
    const illiquidAssetsValue = illiquidAssets.reduce((sum: any, a: any) => sum + a.value, 0);
    
    const liquidityRatio = totalAssets > 0 ? (liquidAssetsValue / totalAssets) * 100 : 0;
    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    
    // Emergency fund recommendation: 6 months of average expenses
    // Calculate from expense tracking system
    let recommendedEmergencyFund = 300000; // Default: ₹3L
    
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const expenseData = await db
        .select({
          totalExpenses: sql<string>`COALESCE(SUM(${schema.userExpenses.amount}), 0)`,
          expenseCount: sql<number>`COUNT(*)`,
        })
        .from(schema.userExpenses)
        .where(
          and(
            eq(schema.userExpenses.userId, userId),
            gte(schema.userExpenses.transactionDate, sixMonthsAgo)
          )
        );
      
      if (expenseData.length > 0 && expenseData[0].expenseCount > 0) {
        const totalExpenses = parseFloat(expenseData[0].totalExpenses) || 0;
        const monthsOfData = Math.min(6, Math.max(1, Math.ceil((Date.now() - sixMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000))));
        const avgMonthlyExpense = totalExpenses / monthsOfData;
        recommendedEmergencyFund = avgMonthlyExpense * 6;
        console.info(`[Net Worth] User ${userId}: Calculated emergency fund based on ${expenseData[0].expenseCount} expenses - ₹${recommendedEmergencyFund.toFixed(0)}`);
      }
    } catch (error: any) {
      console.warn('[Net Worth] Failed to calculate expenses from tracking system:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        summary: {
          netWorth: parseFloat(netWorth.toFixed(2)),
          totalAssets: parseFloat(totalAssets.toFixed(2)),
          totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
          currency: 'INR',
          isFamily: includeFamily === 'true',
          memberCount: targetUserIds.length,
          lastUpdated: new Date().toISOString()
        },
        assets: {
          breakdown: {
            liquid: {
              value: parseFloat(liquidAssetsValue.toFixed(2)),
              percentage: totalAssets > 0 ? parseFloat(((liquidAssetsValue / totalAssets) * 100).toFixed(2)) : 0,
              items: liquidAssets
            },
            semiLiquid: {
              value: parseFloat(semiLiquidAssetsValue.toFixed(2)),
              percentage: totalAssets > 0 ? parseFloat(((semiLiquidAssetsValue / totalAssets) * 100).toFixed(2)) : 0,
              items: semiLiquidAssets
            },
            illiquid: {
              value: parseFloat(illiquidAssetsValue.toFixed(2)),
              percentage: totalAssets > 0 ? parseFloat(((illiquidAssetsValue / totalAssets) * 100).toFixed(2)) : 0,
              items: illiquidAssets
            },
            pending: {
              value: parseFloat(totalPendingValue.toFixed(2)),
              items: pendingInvestments
            }
          },
          portfolioCount: userPortfolios.length,
          bankAccountsCount: bankAccounts.length,
          declaredAssets: declaredAssets
        },
        liabilities: {
          breakdown: {
            shortTerm: {
              value: shortTermLiabilities.reduce((sum: any, l: any) => sum + l.outstandingAmount, 0),
              items: shortTermLiabilities
            },
            longTerm: {
              value: longTermLiabilities.reduce((sum: any, l: any) => sum + l.outstandingAmount, 0),
              items: longTermLiabilities
            }
          },
          count: loans.length
        },
        metrics: {
          liquidityRatio: parseFloat(liquidityRatio.toFixed(2)),
          debtToAssetRatio: parseFloat(debtToAssetRatio.toFixed(2)),
          emergencyFundGap: Math.max(0, recommendedEmergencyFund - liquidAssetsValue),
          recommendedEmergencyFund: recommendedEmergencyFund
        }
      }
    });
  } catch (error) {
    console.error("Error aggregating net worth:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate net worth"
    });
  }
});

// Product-specific verification status endpoint
app.get("/api/profile/product-verification-status", requireClientOrHigher, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get user profile to determine client type and entity type
    const profile = await storage.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "User profile not found",
      });
    }

    // Get KYC status to determine verification level
    const { getKYCStatus } = await import("../rekyc-service");
    const kycStatus = await getKYCStatus(userId);

    // Define product verification rules
    const products = {
      mutualFunds: {
        name: "Mutual Funds",
        verified: kycStatus.currentLevel === "full" || kycStatus.currentLevel === "enhanced",
        requiredLevel: "full",
        canTrade: kycStatus.canTradeMutualFunds,
      },
      stockBroking: {
        name: "Stock Broking",
        verified: kycStatus.currentLevel === "full" || kycStatus.currentLevel === "enhanced",
        requiredLevel: "full",
        canTrade: kycStatus.canTradeBroking,
      },
      bonds: {
        name: "Bonds & G-Sec",
        verified: kycStatus.currentLevel === "full" || kycStatus.currentLevel === "enhanced",
        requiredLevel: "full",
        canTrade: kycStatus.currentLevel === "full" || kycStatus.currentLevel === "enhanced",
      },
      aif: {
        name: "Alternative Investment Funds (AIF)",
        verified: kycStatus.currentLevel === "enhanced",
        requiredLevel: "enhanced",
        canTrade: kycStatus.currentLevel === "enhanced",
      },
      pms: {
        name: "Portfolio Management Services (PMS)",
        verified: kycStatus.currentLevel === "enhanced",
        requiredLevel: "enhanced",
        canTrade: kycStatus.currentLevel === "enhanced",
      },
      global: {
        name: "Global Investments",
        verified: kycStatus.currentLevel === "enhanced",
        requiredLevel: "enhanced",
        canTrade: kycStatus.canTradeInternational,
      },
    };

    res.json({
      success: true,
      data: {
        userId,
        clientType: profile.clientType || "individual",
        entityType: (profile as any).entityType,
        currentKYCLevel: kycStatus.currentLevel,
        isProfileCompleted: (profile as any).isProfileCompleted,
        products,
        verificationMethods: {
          // digilockerVerified: profile.digilockerVerified || false, // Property doesn't exist in schema
          videoKycCompleted: profile.videoKycCompleted || false,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching product verification status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product verification status",
    });
  }
});

// Manual Re-KYC reminder trigger (admin only)
}
