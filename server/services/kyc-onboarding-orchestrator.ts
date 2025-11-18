/**
 * KYC Onboarding Orchestrator Service
 * 
 * Manages the complete 17-step client onboarding state machine following 2025 SEBI/RBI compliance.
 * Enforces step dependencies, validates prerequisites, and provides clear next-step guidance.
 * 
 * Complete Flow:
 * 1. PAN Verification (Entry point - Required for all)
 * 2. KRA Status Check (Auto-triggered after PAN)
 * 3. Aadhaar OTP Generation
 * 4. Aadhaar OTP Verification
 * 5. CKYC Registration (if KRA not found)
 * 6. CKYC Status Polling (poll for KIN number)
 * 7. UCC Creation (BSE Star AddInvestor)
 * 8. Bank Account Verification (Penny Drop)
 * 9. eMandate Registration (NACH for SIP)
 * 10. Risk Profiling Questionnaire
 * 11. Compliance Sign-off (FATCA, Risk Acknowledgment, EUIN, Terms)
 * 12. Final Verification & Approval
 * 
 * SEBI/RBI Compliance:
 * - Tiered KYC system (Basic/Standard/Full)
 * - CKYC KRA integration (NSDL/CVL)
 * - Mandatory Aadhaar seeding
 * - Risk profiling before investments
 * - FATCA/CRS compliance
 * - PEP screening
 */

import type { KycVerificationSession } from "@shared/schema";

// Step identifiers in sequential order
export const KYC_STEPS = [
  'pan_verification',
  'kra_status_check',
  'aadhaar_otp',
  'aadhaar_verification',
  'ckyc_upload',
  'ckyc_status',
  'ucc_creation',
  'bank_verification',
  'emandate_registration',
  'risk_profiling',
  'compliance_signoff',
  'final_approval'
] as const;

export type KycStep = typeof KYC_STEPS[number];

// Step status values
export type StepStatus = 
  | 'not_started'      // Step not yet started
  | 'in_progress'      // Step currently being processed
  | 'pending'          // Step initiated but waiting for external action (e.g., OTP)
  | 'completed'        // Step successfully completed
  | 'verified'         // Step completed and data verified
  | 'failed'           // Step failed
  | 'skipped';         // Step skipped (optional steps or alternative flow)

export interface StepMetadata {
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  attemptCount?: number;
  [key: string]: any; // Additional step-specific data
}

export interface WorkflowStatus {
  currentStep: KycStep;
  completedSteps: KycStep[];
  pendingSteps: KycStep[];
  failedSteps: KycStep[];
  skippedSteps: KycStep[];
  canProceed: boolean;
  nextStep: KycStep | null;
  blockingReason?: string;
  overallProgress: number; // 0-100
  kycTier: 'basic' | 'standard' | 'full';
  estimatedTimeRemaining: string;
}

export interface StepPrerequisites {
  step: KycStep;
  requiredSteps: KycStep[];
  requiredFields?: string[];
  description: string;
  estimatedDuration: string;
  isMandatory: boolean;
  sebiCompliance: boolean;
}

/**
 * Complete KYC workflow step definitions with dependencies
 */
export const STEP_PREREQUISITES: Record<KycStep, StepPrerequisites> = {
  pan_verification: {
    step: 'pan_verification',
    requiredSteps: [],
    requiredFields: ['panNumber', 'dateOfBirth', 'name'],
    description: 'Verify PAN card using Cashfree Verification Suite',
    estimatedDuration: '1-2 minutes',
    isMandatory: true,
    sebiCompliance: true
  },
  kra_status_check: {
    step: 'kra_status_check',
    requiredSteps: ['pan_verification'],
    requiredFields: ['panNumber', 'dateOfBirth'],
    description: 'Check existing CKYC records in NSDL/CVL KRA',
    estimatedDuration: '30 seconds',
    isMandatory: true,
    sebiCompliance: true
  },
  aadhaar_otp: {
    step: 'aadhaar_otp',
    requiredSteps: ['pan_verification'],
    requiredFields: ['aadhaarNumber'],
    description: 'Generate OTP for Aadhaar verification',
    estimatedDuration: '1 minute',
    isMandatory: true,
    sebiCompliance: true
  },
  aadhaar_verification: {
    step: 'aadhaar_verification',
    requiredSteps: ['pan_verification', 'aadhaar_otp'],
    requiredFields: ['otp'],
    description: 'Verify Aadhaar using OTP',
    estimatedDuration: '1 minute',
    isMandatory: true,
    sebiCompliance: true
  },
  ckyc_upload: {
    step: 'ckyc_upload',
    requiredSteps: ['pan_verification', 'aadhaar_verification'],
    requiredFields: ['documents', 'photos'],
    description: 'Upload documents to NSDL KRA for CKYC registration',
    estimatedDuration: '5-10 minutes',
    isMandatory: false, // Skip if KRA status shows existing CKYC
    sebiCompliance: true
  },
  ckyc_status: {
    step: 'ckyc_status',
    requiredSteps: ['ckyc_upload'],
    description: 'Poll CKYC application status to get KIN number',
    estimatedDuration: '24-48 hours',
    isMandatory: false, // Skip if KRA status shows existing CKYC
    sebiCompliance: true
  },
  ucc_creation: {
    step: 'ucc_creation',
    requiredSteps: ['pan_verification', 'aadhaar_verification'],
    requiredFields: ['personalDetails', 'addressDetails', 'bankDetails'],
    description: 'Create UCC (Unique Client Code) on BSE Star for mutual fund trading',
    estimatedDuration: '2-3 minutes',
    isMandatory: true, // Required for mutual fund investments
    sebiCompliance: true
  },
  bank_verification: {
    step: 'bank_verification',
    requiredSteps: ['pan_verification'],
    requiredFields: ['accountNumber', 'ifscCode', 'accountHolderName'],
    description: 'Verify bank account using Penny Drop (Cashfree)',
    estimatedDuration: '1-2 minutes',
    isMandatory: true,
    sebiCompliance: true
  },
  emandate_registration: {
    step: 'emandate_registration',
    requiredSteps: ['bank_verification'],
    requiredFields: ['bankDetails', 'mandateAmount'],
    description: 'Register eMandate/NACH for SIP auto-debit',
    estimatedDuration: '5 minutes',
    isMandatory: false, // Optional for non-SIP users
    sebiCompliance: false
  },
  risk_profiling: {
    step: 'risk_profiling',
    requiredSteps: ['pan_verification'],
    requiredFields: ['questionnaireAnswers'],
    description: 'Complete risk profiling questionnaire (SEBI mandatory)',
    estimatedDuration: '5-7 minutes',
    isMandatory: true,
    sebiCompliance: true
  },
  compliance_signoff: {
    step: 'compliance_signoff',
    requiredSteps: ['risk_profiling', 'aadhaar_verification'],
    requiredFields: ['fatcaDeclaration', 'riskAcknowledgment', 'termsConsent'],
    description: 'Sign compliance declarations (FATCA, Risk, EUIN, Terms)',
    estimatedDuration: '3-5 minutes',
    isMandatory: true,
    sebiCompliance: true
  },
  final_approval: {
    step: 'final_approval',
    requiredSteps: ['compliance_signoff', 'ucc_creation'],
    description: 'Final verification and account activation',
    estimatedDuration: '24-48 hours',
    isMandatory: true,
    sebiCompliance: true
  }
};

export class KYCOnboardingOrchestrator {
  /**
   * Get current workflow status from session
   */
  static getWorkflowStatus(session: KycVerificationSession): WorkflowStatus {
    const stepStatus = (session.stepStatus as Record<string, StepMetadata>) || {};
    
    const completedSteps: KycStep[] = [];
    const pendingSteps: KycStep[] = [];
    const failedSteps: KycStep[] = [];
    const skippedSteps: KycStep[] = [];

    // Analyze each step (auto-skip optional steps based on conditions)
    for (const step of KYC_STEPS) {
      const metadata = stepStatus[step];
      
      // Auto-skip optional steps if conditions are met
      if (!metadata || metadata.status === 'not_started' || metadata.status === 'pending') {
        if (this.shouldSkipStep(step, stepStatus)) {
          skippedSteps.push(step);
          continue;
        }
      }
      
      if (!metadata) {
        pendingSteps.push(step);
        continue;
      }

      switch (metadata.status) {
        case 'completed':
        case 'verified':
          completedSteps.push(step);
          break;
        case 'pending':
        case 'in_progress':
          pendingSteps.push(step);
          break;
        case 'failed':
          failedSteps.push(step);
          break;
        case 'skipped':
          skippedSteps.push(step);
          break;
        default:
          pendingSteps.push(step);
      }
    }

    // Determine current step
    const currentStep = (session.currentStep as KycStep) || 'pan_verification';
    
    // Determine next step
    const nextStep = this.determineNextStep(currentStep, stepStatus);
    
    // Check if can proceed
    const { canProceed, blockingReason } = this.canProceedToNextStep(currentStep, stepStatus);
    
    // Calculate overall progress
    const totalMandatorySteps = KYC_STEPS.filter(s => STEP_PREREQUISITES[s].isMandatory).length;
    const completedMandatorySteps = completedSteps.filter(s => STEP_PREREQUISITES[s].isMandatory).length;
    const overallProgress = Math.round((completedMandatorySteps / totalMandatorySteps) * 100);
    
    // Determine KYC tier based on completion
    const kycTier = this.determineKYCTier(completedSteps);
    
    // Estimate time remaining
    const estimatedTimeRemaining = this.estimateTimeRemaining(pendingSteps, failedSteps);

    return {
      currentStep,
      completedSteps,
      pendingSteps,
      failedSteps,
      skippedSteps,
      canProceed,
      nextStep,
      blockingReason,
      overallProgress,
      kycTier,
      estimatedTimeRemaining
    };
  }

  /**
   * Determine next step based on current state
   */
  static determineNextStep(
    currentStep: KycStep,
    stepStatus: Record<string, StepMetadata>
  ): KycStep | null {
    const currentIndex = KYC_STEPS.indexOf(currentStep);
    
    // If current step is not completed, stay here (unless it should be auto-skipped)
    const currentMeta = stepStatus[currentStep];
    const currentShouldSkip = this.shouldSkipStep(currentStep, stepStatus);
    
    if (!currentShouldSkip && (!currentMeta || (currentMeta.status !== 'completed' && currentMeta.status !== 'verified' && currentMeta.status !== 'skipped'))) {
      return currentStep;
    }

    // Find next incomplete step
    for (let i = currentIndex + 1; i < KYC_STEPS.length; i++) {
      const step = KYC_STEPS[i];
      const meta = stepStatus[step];
      const shouldSkip = this.shouldSkipStep(step, stepStatus);
      
      // Auto-skip if conditions are met
      if (shouldSkip) {
        continue;
      }
      
      // Skip if already completed or skipped
      if (meta?.status === 'completed' || meta?.status === 'verified' || meta?.status === 'skipped') {
        continue;
      }

      // Check prerequisites (treat skipped same as completed)
      const prereqs = STEP_PREREQUISITES[step];
      const prerequisitesMet = prereqs.requiredSteps.every(reqStep => {
        const reqMeta = stepStatus[reqStep];
        return reqMeta?.status === 'completed' || reqMeta?.status === 'verified' || reqMeta?.status === 'skipped';
      });

      if (prerequisitesMet) {
        return step;
      }
    }

    return null; // All steps completed
  }

  /**
   * Check if can proceed to next step
   */
  static canProceedToNextStep(
    currentStep: KycStep,
    stepStatus: Record<string, StepMetadata>
  ): { canProceed: boolean; blockingReason?: string } {
    const currentMeta = stepStatus[currentStep];
    const currentShouldSkip = this.shouldSkipStep(currentStep, stepStatus);
    
    // Check if current step is completed (or skipped)
    if (!currentShouldSkip && (!currentMeta || (currentMeta.status !== 'completed' && currentMeta.status !== 'verified' && currentMeta.status !== 'skipped'))) {
      return {
        canProceed: false,
        blockingReason: `Current step "${currentStep}" must be completed before proceeding`
      };
    }

    // Find next step
    const nextStep = this.determineNextStep(currentStep, stepStatus);
    if (!nextStep) {
      return { canProceed: true }; // All steps completed
    }

    // Check prerequisites for next step (treat skipped same as completed)
    const prereqs = STEP_PREREQUISITES[nextStep];
    for (const reqStep of prereqs.requiredSteps) {
      const reqMeta = stepStatus[reqStep];
      if (!reqMeta || (reqMeta.status !== 'completed' && reqMeta.status !== 'verified' && reqMeta.status !== 'skipped')) {
        return {
          canProceed: false,
          blockingReason: `Step "${nextStep}" requires "${reqStep}" to be completed first`
        };
      }
    }

    return { canProceed: true };
  }

  /**
   * Validate prerequisites for a specific step
   */
  static validateStepPrerequisites(
    step: KycStep,
    stepStatus: Record<string, StepMetadata>
  ): { valid: boolean; missingSteps: KycStep[]; errorMessage?: string } {
    const prereqs = STEP_PREREQUISITES[step];
    const missingSteps: KycStep[] = [];

    for (const reqStep of prereqs.requiredSteps) {
      const reqMeta = stepStatus[reqStep];
      if (!reqMeta || (reqMeta.status !== 'completed' && reqMeta.status !== 'verified' && reqMeta.status !== 'skipped')) {
        missingSteps.push(reqStep);
      }
    }

    if (missingSteps.length > 0) {
      return {
        valid: false,
        missingSteps,
        errorMessage: `Cannot proceed with "${step}". Complete these steps first: ${missingSteps.join(', ')}`
      };
    }

    return { valid: true, missingSteps: [] };
  }

  /**
   * Determine KYC tier based on completed steps
   */
  static determineKYCTier(completedSteps: KycStep[]): 'basic' | 'standard' | 'full' {
    const hasBasic = completedSteps.includes('pan_verification');
    const hasStandard = hasBasic && 
                       completedSteps.includes('aadhaar_verification') &&
                       completedSteps.includes('bank_verification');
    const hasFull = hasStandard &&
                   completedSteps.includes('ucc_creation') &&
                   completedSteps.includes('risk_profiling') &&
                   completedSteps.includes('compliance_signoff');

    if (hasFull) return 'full';
    if (hasStandard) return 'standard';
    return 'basic';
  }

  /**
   * Estimate time remaining for pending steps
   */
  static estimateTimeRemaining(pendingSteps: KycStep[], failedSteps: KycStep[]): string {
    // Convert Set to Array for iteration compatibility
    const stepsToComplete = Array.from(new Set([...pendingSteps, ...failedSteps]));
    
    if (stepsToComplete.length === 0) {
      return 'Completed';
    }

    let totalMinutes = 0;
    for (const step of stepsToComplete) {
      const prereq = STEP_PREREQUISITES[step as KycStep];
      const durationStr = prereq.estimatedDuration;
      
      // Parse duration (e.g., "5-10 minutes" -> average 7.5 minutes)
      const match = durationStr.match(/(\d+)(?:-(\d+))?\s*(minute|hour|day)/);
      if (match) {
        const min = parseInt(match[1]);
        const max = match[2] ? parseInt(match[2]) : min;
        const avg = (min + max) / 2;
        const unit = match[3];
        
        if (unit === 'minute') {
          totalMinutes += avg;
        } else if (unit === 'hour') {
          totalMinutes += avg * 60;
        } else if (unit === 'day') {
          totalMinutes += avg * 24 * 60;
        }
      }
    }

    if (totalMinutes < 60) {
      return `${Math.round(totalMinutes)} minutes`;
    } else if (totalMinutes < 24 * 60) {
      return `${Math.round(totalMinutes / 60)} hours`;
    } else {
      return `${Math.round(totalMinutes / (24 * 60))} days`;
    }
  }

  /**
   * Get step details
   */
  static getStepDetails(step: KycStep): StepPrerequisites {
    return STEP_PREREQUISITES[step];
  }

  /**
   * Mark step as skipped (for optional steps or alternative flows)
   */
  static shouldSkipStep(
    step: KycStep,
    stepStatus: Record<string, StepMetadata>
  ): boolean {
    // Skip CKYC upload if KRA status shows existing CKYC
    if (step === 'ckyc_upload') {
      const kraStatus = stepStatus.kra_status_check;
      if (kraStatus?.status === 'completed' && kraStatus?.kraFound === true) {
        return true;
      }
    }

    // Skip CKYC status polling if KRA found existing CKYC (check KRA directly, not ckyc_upload)
    if (step === 'ckyc_status') {
      const kraStatus = stepStatus.kra_status_check;
      if (kraStatus?.status === 'completed' && kraStatus?.kraFound === true) {
        return true; // KRA already has CKYC, no need to poll for new registration
      }
      
      // Also skip if upload was explicitly skipped
      const ckycUpload = stepStatus.ckyc_upload;
      if (ckycUpload?.status === 'skipped') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get human-readable step name
   */
  static getStepDisplayName(step: KycStep): string {
    const names: Record<KycStep, string> = {
      pan_verification: 'PAN Card Verification',
      kra_status_check: 'KRA Status Check',
      aadhaar_otp: 'Aadhaar OTP Generation',
      aadhaar_verification: 'Aadhaar Verification',
      ckyc_upload: 'CKYC Document Upload',
      ckyc_status: 'CKYC Status Verification',
      ucc_creation: 'UCC Account Creation',
      bank_verification: 'Bank Account Verification',
      emandate_registration: 'eMandate Registration',
      risk_profiling: 'Risk Profile Assessment',
      compliance_signoff: 'Compliance Sign-off',
      final_approval: 'Final Approval'
    };
    return names[step];
  }

  /**
   * Get actionable guidance for current step
   */
  static getStepGuidance(step: KycStep, stepStatus: Record<string, StepMetadata>): string {
    const meta = stepStatus[step];
    const prereq = STEP_PREREQUISITES[step];

    if (!meta || meta.status === 'not_started') {
      return `Ready to start: ${prereq.description}. Estimated time: ${prereq.estimatedDuration}`;
    }

    if (meta.status === 'in_progress') {
      return `Currently processing: ${prereq.description}`;
    }

    if (meta.status === 'pending') {
      if (step === 'aadhaar_otp') {
        return 'OTP has been sent to your Aadhaar-linked mobile. Please verify within 10 minutes.';
      }
      if (step === 'ckyc_status') {
        return 'CKYC application submitted. Verification usually takes 24-48 hours.';
      }
      if (step === 'emandate_registration') {
        return 'eMandate created. Please complete authorization with your bank.';
      }
      return `Waiting for action: ${prereq.description}`;
    }

    if (meta.status === 'failed') {
      return meta.errorMessage || `Failed: ${prereq.description}. Please retry.`;
    }

    if (meta.status === 'completed' || meta.status === 'verified') {
      return `Completed: ${this.getStepDisplayName(step)}`;
    }

    if (meta.status === 'skipped') {
      return `Skipped: ${this.getStepDisplayName(step)} (not required for your case)`;
    }

    return prereq.description;
  }
}
