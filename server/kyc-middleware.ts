import { Request, Response, NextFunction } from "express";
import { checkKYCCompliance, TransactionContext } from "./kyc-compliance-checker";

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
 * Log KYC validation attempts for audit trail
 */
export async function logKYCAttempt(
  userId: string,
  transactionType: string,
  amount: number,
  result: "passed" | "failed",
  reason?: string
) {
  // TODO: Implement logging to database for audit trail
  console.log(`[KYC Audit] ${new Date().toISOString()} | User: ${userId} | Type: ${transactionType} | Amount: ₹${amount} | Result: ${result}${reason ? ` | Reason: ${reason}` : ""}`);
}
