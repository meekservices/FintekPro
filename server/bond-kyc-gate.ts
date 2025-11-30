import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

/**
 * Bond Trading KYC Sequential Gate
 * Enforces: PAN → CKYC → KRA → Demat → Risk Profile before allowing bond orders
 * SEBI/RBI Compliant - All steps must be completed in sequence
 */

export interface KYCStepStatus {
  step: string;
  required: boolean;
  completed: boolean;
  verifiedAt?: Date;
  details?: any;
}

export interface BondKYCGateResult {
  eligible: boolean;
  currentStep: number;
  totalSteps: number;
  steps: KYCStepStatus[];
  nextAction?: string;
  redirectTo?: string;
  blockedReason?: string;
}

const KYC_STEPS = [
  { step: 'pan_verification', name: 'PAN Verification', required: true },
  { step: 'ckyc_registration', name: 'CKYC Registration', required: true },
  { step: 'kra_verification', name: 'KRA Verification', required: true },
  { step: 'demat_account', name: 'Demat Account', required: true },
  { step: 'risk_profile', name: 'Risk Profile Assessment', required: true },
];

/**
 * Check user's KYC status against bond trading requirements
 */
export async function checkBondKYCEligibility(userId: string): Promise<BondKYCGateResult> {
  try {
    const user = await storage.getUser(userId) as any;
    if (!user) {
      return {
        eligible: false,
        currentStep: 0,
        totalSteps: KYC_STEPS.length,
        steps: KYC_STEPS.map(s => ({ ...s, completed: false })),
        blockedReason: "User not found",
        redirectTo: "/login"
      };
    }

    const steps: KYCStepStatus[] = [];
    let lastCompletedStep = 0;

    // Step 1: PAN Verification
    const panVerified = user.panVerified === true || (user.panNumber && user.panNumber.length === 10);
    steps.push({
      step: 'pan_verification',
      required: true,
      completed: panVerified,
      verifiedAt: user.panVerifiedAt || undefined,
      details: { panNumber: user.panNumber ? `${user.panNumber.substring(0, 5)}****${user.panNumber.slice(-1)}` : null }
    });
    if (panVerified) lastCompletedStep = 1;

    // Step 2: CKYC Registration (Central KYC)
    const ckycCompleted = (user.ckycNumber && user.ckycNumber.length > 0) || user.ckycCompliant === true;
    steps.push({
      step: 'ckyc_registration',
      required: true,
      completed: ckycCompleted,
      verifiedAt: ckycCompleted ? new Date() : undefined,
      details: { ckycNumber: user.ckycNumber || null }
    });
    if (panVerified && ckycCompleted) lastCompletedStep = 2;

    // Step 3: KRA Verification (KYC Registration Agency)
    const kraVerified = user.kraVerified === true || user.kraStatus === 'verified';
    steps.push({
      step: 'kra_verification',
      required: true,
      completed: kraVerified,
      verifiedAt: kraVerified ? new Date() : undefined,
      details: { kraStatus: user.kraStatus || 'pending' }
    });
    if (panVerified && ckycCompleted && kraVerified) lastCompletedStep = 3;

    // Step 4: Demat Account
    const dematLinked = (user.dematAccountNumber && user.dematAccountNumber.length > 0) || 
                        (user.nsdlDpId && user.nsdlDpId.length > 0) || 
                        (user.cdslDpId && user.cdslDpId.length > 0);
    steps.push({
      step: 'demat_account',
      required: true,
      completed: dematLinked,
      verifiedAt: dematLinked ? new Date() : undefined,
      details: { 
        depository: user.nsdlDpId ? 'NSDL' : (user.cdslDpId ? 'CDSL' : null),
        dpId: user.nsdlDpId || user.cdslDpId || null
      }
    });
    if (panVerified && ckycCompleted && kraVerified && dematLinked) lastCompletedStep = 4;

    // Step 5: Risk Profile Assessment
    const riskProfileComplete = (user.riskProfile && user.riskProfile.length > 0) || user.isProfileCompleted === true;
    steps.push({
      step: 'risk_profile',
      required: true,
      completed: riskProfileComplete,
      verifiedAt: riskProfileComplete ? new Date() : undefined,
      details: { 
        profile: user.riskProfile || null,
        score: user.riskScore || null
      }
    });
    if (panVerified && ckycCompleted && kraVerified && dematLinked && riskProfileComplete) lastCompletedStep = 5;

    const eligible = lastCompletedStep === 5;

    // Determine next action
    let nextAction = '';
    let redirectTo = '/kyc-dashboard';

    if (!panVerified) {
      nextAction = 'Complete PAN verification to proceed with bond trading';
      redirectTo = '/kyc-dashboard?step=pan';
    } else if (!ckycCompleted) {
      nextAction = 'Complete CKYC registration to continue';
      redirectTo = '/kyc-dashboard?step=ckyc';
    } else if (!kraVerified) {
      nextAction = 'Complete KRA verification to continue';
      redirectTo = '/kyc-dashboard?step=kra';
    } else if (!dematLinked) {
      nextAction = 'Link your Demat account to continue';
      redirectTo = '/kyc-dashboard?step=demat';
    } else if (!riskProfileComplete) {
      nextAction = 'Complete Risk Profile assessment to start trading';
      redirectTo = '/kyc-dashboard?step=risk';
    }

    return {
      eligible,
      currentStep: lastCompletedStep,
      totalSteps: KYC_STEPS.length,
      steps,
      nextAction: eligible ? undefined : nextAction,
      redirectTo: eligible ? undefined : redirectTo,
      blockedReason: eligible ? undefined : `Complete step ${lastCompletedStep + 1} of ${KYC_STEPS.length}: ${KYC_STEPS[lastCompletedStep]?.name}`
    };

  } catch (error) {
    console.error('[Bond KYC Gate] Error checking eligibility:', error);
    return {
      eligible: false,
      currentStep: 0,
      totalSteps: KYC_STEPS.length,
      steps: KYC_STEPS.map(s => ({ ...s, completed: false })),
      blockedReason: "Error checking KYC status",
      redirectTo: "/kyc-dashboard"
    };
  }
}

/**
 * Express middleware to enforce bond trading KYC requirements
 * Usage: app.post('/api/bonds/trading/:type/orders', bondKYCGate(), handler)
 */
export function bondKYCGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "AUTHENTICATION_REQUIRED",
          message: "Please log in to trade bonds"
        });
      }

      const result = await checkBondKYCEligibility(userId);

      if (!result.eligible) {
        console.log(`[Bond KYC Gate] User ${userId} blocked - Step ${result.currentStep}/${result.totalSteps}`);
        
        return res.status(403).json({
          success: false,
          error: "KYC_INCOMPLETE",
          message: result.blockedReason,
          data: {
            currentStep: result.currentStep,
            totalSteps: result.totalSteps,
            steps: result.steps,
            nextAction: result.nextAction,
            kycSequence: [
              { step: 1, name: 'PAN Verification', icon: 'FileText' },
              { step: 2, name: 'CKYC Registration', icon: 'Shield' },
              { step: 3, name: 'KRA Verification', icon: 'CheckCircle' },
              { step: 4, name: 'Demat Account', icon: 'Wallet' },
              { step: 5, name: 'Risk Profile', icon: 'Target' },
            ]
          },
          action: "COMPLETE_KYC_SEQUENCE",
          redirectTo: result.redirectTo
        });
      }

      // Attach KYC result to request for downstream use
      (req as any).bondKycResult = result;
      console.log(`[Bond KYC Gate] User ${userId} passed all ${result.totalSteps} KYC steps`);
      
      next();
    } catch (error) {
      console.error('[Bond KYC Gate] Middleware error:', error);
      return res.status(500).json({
        success: false,
        error: "KYC_CHECK_FAILED",
        message: "Unable to verify trading eligibility. Please try again."
      });
    }
  };
}

/**
 * API endpoint to check bond trading eligibility status
 */
export async function getBondTradingEligibility(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    const result = await checkBondKYCEligibility(userId);

    return res.json({
      success: true,
      data: {
        eligible: result.eligible,
        currentStep: result.currentStep,
        totalSteps: result.totalSteps,
        steps: result.steps,
        nextAction: result.nextAction,
        redirectTo: result.redirectTo,
        progressPercent: Math.round((result.currentStep / result.totalSteps) * 100)
      }
    });

  } catch (error) {
    console.error('[Bond Eligibility Check] Error:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to check eligibility"
    });
  }
}

/**
 * Get detailed KYC progress for bond trading
 */
export async function getBondKYCProgress(userId: string): Promise<{
  steps: { name: string; completed: boolean; description: string; redirectPath: string }[];
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  canTrade: boolean;
}> {
  const result = await checkBondKYCEligibility(userId);
  
  const enhancedSteps = result.steps.map(step => ({
    name: step.name,
    completed: step.completed,
    description: getStepDescription(step.name),
    redirectPath: getStepRedirectPath(step.name)
  }));

  return {
    steps: enhancedSteps,
    currentStep: result.currentStep,
    totalSteps: result.totalSteps,
    percentComplete: Math.round((result.currentStep / result.totalSteps) * 100),
    canTrade: result.eligible
  };
}

function getStepDescription(stepName: string): string {
  const descriptions: Record<string, string> = {
    'PAN Verification': 'Verify your PAN card for tax compliance and identity verification',
    'CKYC Registration': 'Complete CKYC for unified KYC across financial institutions',
    'KRA Verification': 'KRA verification for SEBI-regulated trading accounts',
    'Demat Account': 'Link your demat account to hold securities electronically',
    'Risk Profile': 'Complete suitability assessment for appropriate investments'
  };
  return descriptions[stepName] || 'Complete this verification step';
}

function getStepRedirectPath(stepName: string): string {
  const paths: Record<string, string> = {
    'PAN Verification': '/kyc/pan-verification',
    'CKYC Registration': '/kyc/ckyc',
    'KRA Verification': '/kyc/kra-verification',
    'Demat Account': '/kyc/demat-account',
    'Risk Profile': '/kyc/risk-profile'
  };
  return paths[stepName] || '/kyc-dashboard';
}
