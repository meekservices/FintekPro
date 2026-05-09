import { Request, Response, NextFunction } from "express";
import { checkKYCCompliance, TransactionContext } from "./kyc-compliance-checker";
import { storage } from "./storage";
import { db } from "./db";
import { customerCareAgents, platformAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * KYC Validation Middleware
 * Blocks non-compliant users from performing financial transactions
 */

export interface KYCRequest extends Request {
  user?: any; // Compatible with Express Request user type
  kycResult?: {
    compliant: boolean;
    level: string;
    requiredActions: string[];
  };
}

/**
 * Middleware factory for KYC validation
 * Usage: app.post('/api/mutual-funds/order', validateKYC('mutual_fund'), handler)
 */
export function validateKYC(
  transactionType: TransactionContext["type"],
  options: {
    amountField?: string; // Request body field containing transaction amount
    defaultAmount?: number; // Default amount if not specified
    skipForDemo?: boolean; // Allow demo mode without KYC
  } = {}
) {
  return async (req: KYCRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "Please log in to continue",
        });
      }

      const userId = req.user.id;

      // Get transaction amount from request body
      const amountField = options.amountField || "amount";
      const amount = req.body[amountField] || options.defaultAmount || 0;

      // SECURITY: Reject transactions with missing or zero amounts (unless explicitly allowed)
      if (!amount || amount <= 0) {
        if (!options.defaultAmount) {
          await logKYCAttempt(userId, transactionType, amount, "failed", "Missing or invalid transaction amount");
          return res.status(400).json({
            success: false,
            error: "INVALID_AMOUNT",
            message: "Transaction amount is required and must be greater than zero",
          });
        }
      }

      // Demo mode bypass (for testing only)
      if (options.skipForDemo && process.env.NODE_ENV === "development") {
        console.log(`[KYC] Demo mode: Skipping KYC check for ${transactionType} (₹${amount})`);
        await logKYCAttempt(userId, transactionType, amount, "passed", "Demo mode - KYC check skipped");
        req.kycResult = {
          compliant: true,
          level: "demo",
          requiredActions: [],
        };
        return next();
      }

      // Check KYC compliance
      const kycResult = await checkKYCCompliance(userId, {
        type: transactionType,
        amount,
      });

      // Attach result to request for later use
      req.kycResult = kycResult;

      // If not compliant, block the transaction
      if (!kycResult.compliant) {
        // Log KYC failure for audit trail
        await logKYCAttempt(
          userId,
          transactionType,
          amount,
          "failed",
          kycResult.reason || "KYC verification incomplete"
        );

        return res.status(403).json({
          success: false,
          error: "KYC_INCOMPLETE",
          message: kycResult.reason || "KYC verification required",
          data: {
            currentLevel: kycResult.level,
            requiredActions: kycResult.requiredActions,
            blockers: kycResult.blockers,
            warnings: kycResult.warnings,
            profileCompleteness: kycResult.profileCompleteness,
          },
          action: "COMPLETE_KYC",
          redirectTo: "/profile?tab=kyc",
        });
      }

      // KYC passed - log for audit trail
      await logKYCAttempt(userId, transactionType, amount, "passed", `${kycResult.level.toUpperCase()} KYC verified`);
      console.log(`[KYC] ✓ User ${userId} passed ${kycResult.level} KYC for ${transactionType} (₹${amount})`);

      // Add warnings to response headers if any
      if (kycResult.warnings.length > 0) {
        res.setHeader("X-KYC-Warnings", JSON.stringify(kycResult.warnings));
      }

      next();
    } catch (error) {
      console.error("[KYC Middleware Error]:", error);
      return res.status(500).json({
        success: false,
        error: "KYC_CHECK_FAILED",
        message: "Unable to verify KYC status. Please try again.",
      });
    }
  };
}

/**
 * Middleware to check minimum KYC level
 * Usage: app.get('/api/portfolio', requireKYCLevel('basic'))
 */
export function requireKYCLevel(minimumLevel: "basic" | "full" | "enhanced") {
  return async (req: KYCRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Import getKYCStatus here to avoid circular dependency
      const { getKYCStatus } = await import("./kyc-compliance-checker");
      const kycStatus = await getKYCStatus(req.user.id);

      const levelHierarchy: Record<string, number> = { none: 0, basic: 1, full: 2, enhanced: 3 };
      const userLevel = levelHierarchy[kycStatus.currentLevel] || 0;
      const requiredLevel = levelHierarchy[minimumLevel] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          error: "INSUFFICIENT_KYC",
          message: `${minimumLevel.toUpperCase()} KYC required for this operation`,
          data: {
            currentLevel: kycStatus.currentLevel,
            requiredLevel: minimumLevel,
            pendingActions: kycStatus.pendingActions,
          },
          action: "UPGRADE_KYC",
          redirectTo: "/profile?tab=kyc",
        });
      }

      next();
    } catch (error) {
      console.error("[KYC Level Check Error]:", error);
      return res.status(500).json({
        success: false,
        error: "KYC_CHECK_FAILED",
        message: "Unable to verify KYC level",
      });
    }
  };
}

/**
 * Product Access Control Middleware using Product Eligibility Matrix
 * Validates KYC tier requirements for specific product categories
 * Usage: app.post('/api/products/buy', validateProductAccess('aif', 'amount'), handler)
 */
export function validateProductAccess(
  productCategory: string,
  options: {
    amountField?: string; // Request body field containing transaction amount
  } = {}
) {
  return async (req: KYCRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
          message: "Please log in to continue",
        });
      }

      // Import product eligibility matrix
      const { 
        PRODUCT_ELIGIBILITY_MATRIX, 
        getMinKycTierForProduct,
        isKycTierSufficient,
        getNextKycTier
      } = await import('../shared/kyc-product-eligibility');

      const userId = req.user.id;
      const userKycTier = req.user.kycTier || 'basic';

      // Get transaction amount from request body
      const amountField = options.amountField || "amount";
      const transactionAmount = req.body[amountField] || 0;

      // Find product in eligibility matrix
      const product = PRODUCT_ELIGIBILITY_MATRIX.find(p => p.productCode === productCategory);
      
      if (!product) {
        console.warn(`[Product Access] Unknown product category: ${productCategory}`);
        return next(); // Allow if product not in matrix (backward compatibility)
      }

      // SEBI Compliance: Check amount-based escalation for basic KYC
      // Example: Mutual funds require enhanced KYC for investments > ₹50,000/year
      if (userKycTier === 'basic' && product.maxInvestmentWithoutEnhanced && transactionAmount > product.maxInvestmentWithoutEnhanced) {
        const requiredTier = 'enhanced';
        const nextTier = getNextKycTier(userKycTier);

        await logKYCAttempt(
          userId,
          `product_access_${productCategory}`,
          transactionAmount,
          "failed",
          `Basic KYC limit exceeded: ₹${transactionAmount} > ₹${product.maxInvestmentWithoutEnhanced}`
        );

        return res.status(403).json({
          success: false,
          error: "KYC_TIER_UPGRADE_REQUIRED",
          message: `Investment amount exceeds Basic KYC limit. Please upgrade to ${requiredTier.replace(/_/g, ' ')} KYC.`,
          data: {
            productName: product.productName,
            currentTier: userKycTier,
            requiredTier: requiredTier,
            transactionAmount: transactionAmount,
            maxAllowedAmount: product.maxInvestmentWithoutEnhanced,
            nextAvailableTier: nextTier,
            upgradeInstructions: `Transactions above ₹${product.maxInvestmentWithoutEnhanced.toLocaleString('en-IN')} require ${requiredTier.replace(/_/g, ' ')} KYC. Upgrade to continue.`,
            sebiGuideline: product.sebiGuideline,
            regulatoryNotes: product.regulatoryNotes
          },
          action: "UPGRADE_KYC_TIER",
          redirectTo: "/kyc-dashboard",
        });
      }

      // Check if user's KYC tier is sufficient for product
      if (!isKycTierSufficient(userKycTier, product.minKycTier)) {
        const nextTier = getNextKycTier(userKycTier);
        const requiredTier = product.minKycTier;

        await logKYCAttempt(
          userId,
          `product_access_${productCategory}`,
          0,
          "failed",
          `Insufficient KYC tier: ${userKycTier} < ${requiredTier}`
        );

        return res.status(403).json({
          success: false,
          error: "INSUFFICIENT_KYC_TIER",
          message: `${product.productName} requires ${requiredTier.replace(/_/g, ' ')} KYC tier`,
          data: {
            productName: product.productName,
            currentTier: userKycTier,
            requiredTier: requiredTier,
            nextAvailableTier: nextTier,
            upgradeInstructions: `Upgrade to ${requiredTier.replace(/_/g, ' ')} to access ${product.productName}`,
            sebiGuideline: product.sebiGuideline,
            regulatoryNotes: product.regulatoryNotes
          },
          action: "UPGRADE_KYC_TIER",
          redirectTo: "/kyc-dashboard",
        });
      }

      // Check additional verification requirements
      const missingVerifications: string[] = [];
      
      if (product.requiresPanVerified && !req.user.panVerified) {
        missingVerifications.push('PAN Verification');
      }
      if (product.requiresAadhaarVerified && !req.user.aadhaarVerified) {
        missingVerifications.push('Aadhaar Verification');
      }
      if (product.requiresBankVerified && !req.user.bankVerified) {
        missingVerifications.push('Bank Account Verification');
      }
      if (product.requiresVideoKyc && !req.user.videoKycCompleted) {
        missingVerifications.push('Video KYC (IPV)');
      }
      if (product.requiresIncomeProof && !req.user.annualIncomeAmount) {
        missingVerifications.push('Income Proof');
      }

      // Check financial requirements
      if (product.minAnnualIncome && (!req.user.annualIncomeAmount || req.user.annualIncomeAmount < product.minAnnualIncome)) {
        missingVerifications.push(`Minimum Annual Income ₹${(product.minAnnualIncome / 100000).toFixed(0)} Lakh`);
      }

      if (product.minNetWorth && (!req.user.netWorthAmount || req.user.netWorthAmount < product.minNetWorth)) {
        missingVerifications.push(`Minimum Net Worth ₹${(product.minNetWorth / 10000000).toFixed(1)} Crore`);
      }

      // If there are missing verifications, block access
      if (missingVerifications.length > 0) {
        await logKYCAttempt(
          userId,
          `product_access_${productCategory}`,
          0,
          "failed",
          `Missing verifications: ${missingVerifications.join(', ')}`
        );

        return res.status(403).json({
          success: false,
          error: "INCOMPLETE_VERIFICATION",
          message: `Complete the following requirements to access ${product.productName}`,
          data: {
            productName: product.productName,
            currentTier: userKycTier,
            missingRequirements: missingVerifications,
            sebiGuideline: product.sebiGuideline
          },
          action: "COMPLETE_VERIFICATION",
          redirectTo: "/kyc-dashboard",
        });
      }

      // All checks passed - log success
      await logKYCAttempt(
        userId,
        `product_access_${productCategory}`,
        0,
        "passed",
        `${userKycTier.toUpperCase()} tier verified for ${product.productName}`
      );

      console.log(`[Product Access] ✓ User ${userId} authorized for ${product.productName} (${userKycTier} tier)`);
      next();

    } catch (error) {
      console.error("[Product Access Check Error]:", error);
      return res.status(500).json({
        success: false,
        error: "ACCESS_CHECK_FAILED",
        message: "Unable to verify product access. Please try again.",
      });
    }
  };
}

/**
 * Sub-Agent Transaction Control Middleware
 * Blocks sub-agents from executing transactions while allowing product viewing and marketing
 * 
 * Sub-agents can:
 * - View all products (no KYC restrictions)
 * - Access product details and marketing materials
 * - Add products to wishlists
 * - Share referral links
 * 
 * Sub-agents cannot:
 * - Execute buy/sell orders
 * - Make payments
 * - Place transactions on behalf of clients
 */
export function blockSubAgentTransactions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required"
        });
      }

      // Check if user is a sub-agent by looking up their user record and checking email
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return next(); // No email means can't be an agent
      }

      const [agent] = await db.select()
        .from(customerCareAgents)
        .where(eq(customerCareAgents.email, user.email))
        .limit(1);

      // If not an agent or is a master/associate agent, allow transaction
      if (!agent || agent.agentLevel !== 'sub_agent') {
        return next();
      }

      // Sub-agent detected - block transaction execution
      console.log(`[Sub-Agent Control] Blocked transaction attempt by sub-agent ${agent.id} (${userId})`);
      
      return res.status(403).json({
        success: false,
        error: "TRANSACTION_RESTRICTED",
        message: "Sub-agents cannot execute transactions. You can refer clients to master agents for transaction execution.",
        data: {
          agentLevel: agent.agentLevel,
          agentId: agent.id,
          restriction: "transaction_execution",
          allowedActions: [
            "View all products",
            "Access product details",
            "Add to wishlist",
            "Generate referral links",
            "Refer clients to master agents"
          ],
          contactSupport: "Contact your master agent to execute transactions on behalf of referred clients"
        }
      });

    } catch (error) {
      console.error("[Sub-Agent Control Error]:", error);
      // On error, fail safely by allowing the request to proceed
      // This prevents blocking legitimate transactions due to system errors
      return next();
    }
  };
}

/**
 * Allow sub-agents to bypass KYC checks for product viewing (read-only access)
 * Sub-agents can view all products to facilitate marketing without KYC restrictions
 */
export function allowSubAgentProductViewing() {
  return async (req: KYCRequest, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return next(); // Let auth middleware handle this
      }

      // Check if user is a sub-agent by looking up their user record and checking email
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return next(); // No email means can't be an agent
      }

      const [agent] = await db.select()
        .from(customerCareAgents)
        .where(eq(customerCareAgents.email, user.email))
        .limit(1);

      if (agent && agent.agentLevel === 'sub_agent') {
        console.log(`[Sub-Agent Access] Allowing product view for sub-agent ${agent.id}`);
        
        // Set a flag to indicate sub-agent view mode
        (req as any).isSubAgentView = true;
        (req as any).agentInfo = {
          agentId: agent.id,
          agentLevel: agent.agentLevel,
          canExecuteTransactions: false
        };
        
        // Bypass KYC requirement for viewing
        req.kycResult = {
          compliant: true,
          level: "sub_agent_view",
          requiredActions: []
        };
      }

      next();
    } catch (error) {
      console.error("[Sub-Agent Product Viewing Error]:", error);
      next(); // Continue on error
    }
  };
}

/**
 * Log KYC validation attempts for audit trail — persisted to platform_audit_logs
 */
export async function logKYCAttempt(
  userId: string,
  transactionType: string,
  amount: number,
  result: "passed" | "failed",
  reason?: string
) {
  console.log(
    `[KYC Audit] ${new Date().toISOString()} | User: ${userId} | Type: ${transactionType} | Amount: ₹${amount} | Result: ${result}${reason ? ` | Reason: ${reason}` : ""}`
  );

  try {
    await db.insert(platformAuditLogs).values({
      entityType: "kyc_check",
      entityId: userId,
      eventType: result === "passed" ? "kyc_check_passed" : "kyc_check_failed",
      action: `kyc_${result}_${transactionType}`,
      actorId: userId,
      actorRole: "user",
      changeDetails: {
        transactionType,
        amount,
        result,
        reason: reason ?? null,
      },
      regulatoryTag: "KYC_PMLA",
      severity: result === "failed" ? "WARN" : "INFO",
    });
  } catch (dbErr: any) {
    // Non-blocking — audit logging must never fail a transaction
    console.error("[KYC Audit] Failed to persist audit log to DB:", dbErr?.message);
  }
}
