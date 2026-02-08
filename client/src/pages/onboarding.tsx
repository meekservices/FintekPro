import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Shield,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  Info,
  FileText,
  Pen,
  Building2,
  Users,
  Briefcase,
  Scale,
  Globe,
  UserCircle,
  Zap,
  ClipboardList,
  Upload,
  TrendingUp,
  ShieldCheck,
  Building,
  HandshakeIcon,
  User,
  PenLine,
  Type,
  Fingerprint,
  KeyRound,
  Smartphone,
  BadgeCheck,
  ScrollText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  validatePanFormat, 
  getPanTypeInfo, 
  extractPanTypeCode,
  getOnboardableEntityTypes,
  maskPanNumber,
  type PanTypeInfo,
  type PanEntityType 
} from "@shared/pan-utils";

type OnboardingMode = 'smart' | 'manual';
type EntitySelectionStep = 'pan_entry' | 'type_confirmation' | 'entity_selection';

type WizardStep = 
  | 'pan_entry'
  | 'type_detection' 
  | 'pan_verification' 
  | 'ckyc_kra_check'
  | 'aadhaar_otp' 
  | 'aadhaar_verification' 
  | 'data_collection' 
  | 'risk_profiling' 
  | 'compliance_signoff' 
  | 'huf_details'
  | 'corporate_details'
  | 'firm_llp_details'
  | 'trust_details'
  | 'document_upload'
  | 'signatory_verification'
  | 'bank_verification'
  | 'treasury_setup'
  | 'completed';

interface SessionData {
  id: string;
  currentStep: WizardStep;
  panVerified: boolean;
  aadhaarOtpSent: boolean;
  aadhaarOtpVerified: boolean;
  aadhaarNumber?: string;
  expiresAt?: string;
  panNumber?: string;
  panDob?: string;
  panVerificationData?: {
    name: string;
    fatherName: string;
  };
  aadhaarVerificationData?: {
    name: string;
    dob: string;
    gender: string;
    address: {
      house: string;
      street: string;
      locality: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  entityType?: string;
  entityLocked?: boolean;
  ckycConfidenceScore?: number;
  ckycMissingFields?: string[];
  aadhaarRequired?: boolean;
  amlRiskLevel?: string;
  videoKycRequired?: boolean;
  stepStatus?: Record<string, any>;
  initiatedBy?: string;
}

interface ReferralInfo {
  valid: boolean;
  invitation?: {
    id: string;
    referralCode: string;
    inviterType: string;
    inviterName: string | null;
    clientName: string | null;
    suggestedEntityType: string | null;
    suggestedMode: string | null;
  };
}

export default function SmartKYCOnboarding() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('pan_entry');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionError, setSessionError] = useState<string>('');
  
  // Onboarding Mode State
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('smart');
  const [detectedPanType, setDetectedPanType] = useState<PanTypeInfo | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);
  const [panValidationError, setPanValidationError] = useState<string>('');
  
  // Referral State
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  
  // Resume Session Dialog State
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);
  
  // Session Timer State
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false);
  const [showOneMinWarning, setShowOneMinWarning] = useState(false);
  const [sessionExpiredShown, setSessionExpiredShown] = useState(false);
  
  // Edit Mode State (for regulatory-compliant KYC editing)
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFieldRules, setEditFieldRules] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [editWarnings, setEditWarnings] = useState<string[]>([]);
  
  // OTP verification state for email/mobile changes
  const [editOtpType, setEditOtpType] = useState<'email' | 'mobile' | null>(null);
  const [editOtpValue, setEditOtpValue] = useState('');
  const [editOtpInput, setEditOtpInput] = useState('');
  const [editOtpSent, setEditOtpSent] = useState(false);
  const [editOtpVerified, setEditOtpVerified] = useState<{email?: boolean, mobile?: boolean}>({});
  const [editOtpSessionId, setEditOtpSessionId] = useState<{email?: string, mobile?: string}>({});
  const [editOtpSending, setEditOtpSending] = useState(false);
  const [editOtpVerifying, setEditOtpVerifying] = useState(false);
  
  // Document upload state for name/address changes
  const [editDocuments, setEditDocuments] = useState<{id: string, type: string, name: string}[]>([]);
  const [editDocumentType, setEditDocumentType] = useState('');
  const [editDocumentUploading, setEditDocumentUploading] = useState(false);
  const [nameChanged, setNameChanged] = useState(false);
  const [addressChanged, setAddressChanged] = useState(false);
  
  // Pan Verification State
  const [panNumber, setPanNumber] = useState('');
  const [panFullName, setPanFullName] = useState('');
  const [panDob, setPanDob] = useState('');
  const [panData, setPanData] = useState<any>(null);
  
  // HUF State
  const [kartaPanNumber, setKartaPanNumber] = useState('');
  const [kartaName, setKartaName] = useState('');
  const [hufMemberCount, setHufMemberCount] = useState('');
  const [hufBankAccount, setHufBankAccount] = useState('');
  
  // Corporate/Firm State
  const [entityName, setEntityName] = useState('');
  const [cin, setCin] = useState('');
  const [llpin, setLlpin] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [authorizedSignatoryPan, setAuthorizedSignatoryPan] = useState('');
  const [authorizedSignatoryName, setAuthorizedSignatoryName] = useState('');
  const [treasuryMode, setTreasuryMode] = useState(false);
  const [makerCheckerEnabled, setMakerCheckerEnabled] = useState(true);
  
  // Trust State
  const [trustName, setTrustName] = useState('');
  const [trustRegistrationNumber, setTrustRegistrationNumber] = useState('');
  const [trusteePans, setTrusteePans] = useState<string[]>(['']);
  
  // Document Upload State
  const [uploadedDocuments, setUploadedDocuments] = useState<{[key: string]: File | null}>({});
  
  // Aadhaar Verification State
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarTransactionId, setAadhaarTransactionId] = useState('');
  const [aadhaarMasked, setAadhaarMasked] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  
  // Risk Profiling State
  const [riskProfileAnswers, setRiskProfileAnswers] = useState({
    investmentObjective: '',
    investmentHorizon: '',
    riskTolerance: '',
    incomeLevel: '',
    tradingExperience: ''
  });
  
  // Compliance Sign-off State
  const [fatcaDeclaration, setFatcaDeclaration] = useState(false);
  const [riskAcknowledgment, setRiskAcknowledgment] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [taxResidencyCountry, setTaxResidencyCountry] = useState('India');
  const [tinNumber, setTinNumber] = useState('');
  const [digitalSignature, setDigitalSignature] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [signMethod, setSignMethod] = useState<'draw' | 'type' | 'aadhaar_otp' | 'aadhaar_biometric' | 'dsc_token' | 'virtual_sign' | 'upload'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [aadhaarEsignStatus, setAadhaarEsignStatus] = useState<'idle' | 'pending' | 'completed'>('idle');
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState<string>('');
  const [dscTokenStatus, setDscTokenStatus] = useState<'idle' | 'detecting' | 'detected' | 'signing' | 'completed' | 'error'>('idle');
  const [dscTokenInfo, setDscTokenInfo] = useState<{ issuer: string; subject: string; certClass: string; validTo: string } | null>(null);
  const [virtualSignOtpSent, setVirtualSignOtpSent] = useState(false);
  const [virtualSignOtp, setVirtualSignOtp] = useState('');
  const [virtualSignStatus, setVirtualSignStatus] = useState<'idle' | 'otp_sent' | 'verifying' | 'completed'>('idle');
  const [biometricEsignStatus, setBiometricEsignStatus] = useState<'idle' | 'scanning' | 'completed'>('idle');
  const [expandedSignCategory, setExpandedSignCategory] = useState<'electronic' | 'aadhaar' | 'dsc' | null>('electronic');
  const signatureFileRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);

  const [v2EntityInfo, setV2EntityInfo] = useState<{ entity_detected: string; entity_locked: boolean; override_allowed: boolean } | null>(null);
  const [v2CkycInfo, setV2CkycInfo] = useState<{ confidence_score: number; missing_fields: string[]; aadhaar_required: boolean; source: string } | null>(null);
  const [v2AmlInfo, setV2AmlInfo] = useState<{ aml_score: number; risk_level: string; pep: boolean; sanctions: boolean; video_kyc_required: boolean; screening_id: string } | null>(null);
  const [v2TierInfo, setV2TierInfo] = useState<{ kycTier: string; tierStatus: string; productsUnlocked: string[]; upgradeActions: string[] } | null>(null);
  
  // Start or resume session
  const startSessionMutation = useMutation({
    mutationFn: async (forceNew: boolean = false) => {
      return await apiRequest('/api/kyc/wizard/start', {
        method: 'POST',
        body: JSON.stringify({ forceNew })
      });
    },
    onSuccess: (data) => {
      // Handle both data.session (old) and data.data (new) response formats
      const sessionData = data.session || data.data;
      
      if (data.success && sessionData) {
        // Check if KYC is already fully completed
        if (data.alreadyCompleted || sessionData.currentStep === 'completed') {
          setCurrentStep('completed');
          toast({
            title: "KYC Already Complete",
            description: "Your KYC verification is already completed. You have full access to all services.",
          });
          return;
        }

        // Check if this is a resumable session
        if (data.resumable && !sessionData.stepStatus?.pan_verified) {
          // Show resume dialog only if user hasn't completed PAN yet
          setPendingSession(sessionData);
          setShowResumeDialog(true);
          return;
        }
        
        // Otherwise, load the session normally
        setSessionId(sessionData.sessionId || sessionData.id);
        setCurrentStep(sessionData.currentStep);
        setSessionError(''); // Clear any previous errors
        
        // Set session expiry time and reset warning flags
        if (sessionData.expiresAt) {
          setSessionExpiresAt(new Date(sessionData.expiresAt));
          setShowFiveMinWarning(false);
          setShowOneMinWarning(false);
          setSessionExpiredShown(false);
        }
        
        // Restore existing KYC data if user already has verified PAN/CKYC
        const existingData = sessionData.existingKycData;
        if (existingData?.panVerified || sessionData.stepStatus?.pan_verified) {
          setPanData(existingData || sessionData.panVerificationData);
          setPanNumber(existingData?.panNumber || sessionData.panNumber || '');
          if (existingData?.fullName) {
            setPanFullName(existingData.fullName);
          }
        }
        
        // Restore state if resuming from session
        if (sessionData.panVerified) {
          setPanData(sessionData.panVerificationData);
          setPanNumber(sessionData.panNumber || '');
          setPanDob(sessionData.panDob || '');
          if (sessionData.panVerificationData?.name) {
            setPanFullName(sessionData.panVerificationData.name);
          }
        }
        if (sessionData.aadhaarOtpSent) {
          setAadhaarMasked(sessionData.aadhaarNumber || '');
        }
        if (sessionData.aadhaarOtpVerified) {
          setAadhaarData(sessionData.aadhaarVerificationData);
        }
        
        // Show appropriate message based on detected status
        const stepDisplay = sessionData.currentStep === 'risk_profiling' 
          ? 'Skipping to Risk Profile (PAN & CKYC already verified)' 
          : sessionData.currentStep === 'aadhaar_verification'
          ? 'Skipping to Aadhaar Verification (PAN already verified)'
          : data.isResumed 
          ? "Resuming your KYC session" 
          : "New KYC session started";
        
        toast({
          title: "Session Ready",
          description: stepDisplay,
        });
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to start KYC session. Please try again.";
      setSessionError(errorMessage);
      toast({
        title: "Session Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });
  
  // Handle resuming existing session
  const handleResumeSession = () => {
    if (pendingSession) {
      setSessionId(pendingSession.id);
      setCurrentStep(pendingSession.currentStep);
      setSessionError('');
      
      if (pendingSession.expiresAt) {
        setSessionExpiresAt(new Date(pendingSession.expiresAt));
        setShowFiveMinWarning(false);
        setShowOneMinWarning(false);
        setSessionExpiredShown(false);
      }
      
      if (pendingSession.panVerified) {
        setPanData(pendingSession.panVerificationData);
        setPanNumber(pendingSession.panNumber || '');
        setPanDob(pendingSession.panDob || '');
        if (pendingSession.panVerificationData?.name) {
          setPanFullName(pendingSession.panVerificationData.name);
        }
      }
      if (pendingSession.aadhaarOtpSent) {
        setAadhaarMasked(pendingSession.aadhaarNumber || '');
      }
      if (pendingSession.aadhaarOtpVerified) {
        setAadhaarData(pendingSession.aadhaarVerificationData);
      }
      
      setShowResumeDialog(false);
      setPendingSession(null);
      
      toast({
        title: "Session Resumed",
        description: "Continuing from where you left off",
      });
    }
  };
  
  // Handle starting fresh (cancel old session and create new)
  const handleStartFresh = () => {
    setShowResumeDialog(false);
    setPendingSession(null);
    startSessionMutation.mutate(true); // Pass forceNew=true
  };
  
  // KRA Status Check
  const checkKraStatusMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/check-kra-status', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          panNumber: panNumber.toUpperCase(),
          dateOfBirth: panDob,
          fullName: panFullName
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.data?.confidence_score !== undefined) {
          setV2CkycInfo({
            confidence_score: data.data.confidence_score,
            missing_fields: data.data.missing_fields || [],
            aadhaar_required: data.data.aadhaar_required ?? !data.ckycFound,
            source: data.data.source || 'truthscreen',
          });
        }
        if (data.ckycFound) {
          const needsAadhaar = data.data?.aadhaar_required ?? false;
          toast({
            title: needsAadhaar ? "CKYC Found (Incomplete)" : "CKYC Record Found",
            description: needsAadhaar
              ? `CKYC confidence: ${Math.round((data.data?.confidence_score || 0) * 100)}%. Missing fields require Aadhaar verification.`
              : "Your identity is verified via Central KYC Registry. Skipping Aadhaar verification.",
          });
          setCurrentStep(needsAadhaar ? 'aadhaar_otp' : 'risk_profiling');
        } else {
          toast({
            title: "CKYC Not Found",
            description: "No existing CKYC record. Proceeding to Aadhaar verification for address proof.",
          });
          setCurrentStep('aadhaar_otp');
        }
      }
    },
    onError: (error) => {
      console.error('KRA check error:', error);
      toast({
        title: "Continuing with verification",
        description: "CKYC check unavailable. Proceeding to Aadhaar verification.",
      });
      setCurrentStep('aadhaar_otp');
    }
  });

  // PAN Verification
  const verifyPanMutation = useMutation({
    mutationFn: async () => {
      // Defensive check: ensure sessionId exists before making request
      if (!sessionId) {
        throw new Error("Session not initialized. Please refresh the page.");
      }
      
      return await apiRequest('/api/kyc/wizard/verify-pan', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          panNumber: panNumber.toUpperCase(),
          fullName: panFullName,
          dob: panDob
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setPanData(data.data);
        if (data.data?.entity_detected) {
          setV2EntityInfo({
            entity_detected: data.data.entity_detected,
            entity_locked: data.data.entity_locked ?? true,
            override_allowed: data.data.override_allowed ?? false,
          });
        }
        toast({
          title: "Success",
          description: `PAN verified successfully for ${data.data.name}${data.data.entity_detected ? ` (${data.data.entity_detected})` : ''}`,
        });
        
        setCurrentStep('ckyc_kra_check');
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid PAN or Date of Birth",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "PAN verification failed. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Send Aadhaar OTP
  const sendAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/send-aadhaar-otp', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          aadhaarNumber
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAadhaarTransactionId(data.transactionId || data.data?.transactionId);
        setAadhaarMasked(data.maskedAadhaar || data.data?.maskedMobile || '');
        setCurrentStep('aadhaar_verification');
        const testOtp = data.data?.testOtp;
        toast({
          title: "OTP Sent",
          description: testOtp ? `${data.message} (Test OTP: ${testOtp})` : data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Verify Aadhaar OTP
  const verifyAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/verify-aadhaar-otp', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          transactionId: aadhaarTransactionId,
          otp: aadhaarOtp
        })
      });
    },
    onSuccess: (data) => {
      if (data.success && data.verified) {
        setAadhaarData(data.data);
        setCurrentStep('data_collection');
        toast({
          title: "Success",
          description: "Aadhaar verified successfully!",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid OTP",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify OTP. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Submit Risk Profiling
  const submitRiskProfilingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/risk-profiling', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          riskProfile: riskProfileAnswers
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('compliance_signoff');
        toast({
          title: "Success",
          description: "Risk profile saved successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save risk profile. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Submit Compliance Sign-off
  const submitComplianceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/compliance-signoff', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          fatcaDeclaration,
          riskAcknowledgment,
          termsAndConditions,
          privacyPolicy,
          taxResidencyCountry,
          tinNumber: tinNumber || undefined,
          digitalSignature: digitalSignature || undefined
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.data?.kycTier) {
          setV2TierInfo({
            kycTier: data.data.kycTier,
            tierStatus: data.data.tierStatus,
            productsUnlocked: data.data.productsUnlocked || [],
            upgradeActions: data.data.upgradeActions || [],
          });
        }
        setCurrentStep('completed');
        toast({
          title: "Success",
          description: data.data?.tierStatus === 'final'
            ? "KYC completed! Full access unlocked."
            : "Compliance accepted. Provisional access granted.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit compliance. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Complete KYC
  const completeKycMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/complete', {
        method: 'POST',
        body: JSON.stringify({
          sessionId
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('completed');
        toast({
          title: "Success",
          description: "Smart KYC completed successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete KYC. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Edit KYC mutation for regulatory-compliant updates
  const editKycMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      return await apiRequest('/api/kyc/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Profile Updated",
          description: data.requiresDocumentUpload 
            ? "Changes saved. Please upload supporting documents for address/name changes."
            : "Your KYC details have been updated successfully.",
        });
        setEditErrors(data.errors || []);
        setEditWarnings(data.warnings || []);
        
        // Redirect back after successful update
        if (!data.requiresDocumentUpload) {
          setTimeout(() => {
            window.location.href = '/kyc-dashboard';
          }, 1500);
        }
      } else {
        setEditErrors(data.errors || ['Update failed']);
        setEditWarnings(data.warnings || []);
      }
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update KYC details. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Parse URL parameters for edit mode and referral code
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    const ref = searchParams.get('ref');
    
    // Handle edit mode
    if (mode === 'edit') {
      setIsEditMode(true);
      // Fetch field rules for edit mode
      fetch('/api/kyc/edit/field-rules', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setEditFieldRules(data.data);
            // Pre-fill form with current values
            const currentVals: Record<string, string> = {};
            Object.entries(data.data.currentValues || {}).forEach(([key, val]) => {
              if (val !== null && val !== undefined) {
                currentVals[key] = String(val);
              }
            });
            setEditFormData(currentVals);
          }
        })
        .catch(err => {
          console.error('Error fetching field rules:', err);
          toast({
            title: "Error",
            description: "Failed to load KYC edit form. Please try again.",
            variant: "destructive"
          });
        });
    }
    
    if (ref && !referralCode) {
      setReferralCode(ref);
      setReferralLoading(true);
      
      // Validate the referral code
      fetch(`/api/onboarding-invitations/validate/${ref}`)
        .then(res => res.json())
        .then(data => {
          setReferralLoading(false);
          if (data.valid && data.invitation) {
            setReferralInfo(data);
            
            // Apply suggested settings from the referral
            if (data.invitation.suggestedMode) {
              setOnboardingMode(data.invitation.suggestedMode as OnboardingMode);
            }
            if (data.invitation.suggestedEntityType) {
              setSelectedEntityType(data.invitation.suggestedEntityType);
            }
            
            toast({
              title: "Referral Verified",
              description: `You've been invited by ${data.invitation.inviterName || "your advisor"}. Let's get started!`,
            });
          } else {
            // Invalid or expired referral - clear it
            setReferralCode('');
            toast({
              title: "Invalid Referral",
              description: "The referral link is invalid or expired. You can still proceed with onboarding.",
              variant: "destructive"
            });
          }
        })
        .catch(err => {
          console.error("Error validating referral:", err);
          setReferralLoading(false);
          setReferralCode('');
        });
    }
  }, []);
  
  // Session countdown timer
  useEffect(() => {
    if (!sessionExpiresAt || currentStep === 'completed') return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiryTime = sessionExpiresAt.getTime();
      const remaining = Math.max(0, expiryTime - now);
      
      setTimeRemaining(remaining);
      
      // Check for warnings
      const minutesRemaining = Math.floor(remaining / 60000);
      
      if (minutesRemaining === 5 && !showFiveMinWarning) {
        setShowFiveMinWarning(true);
        toast({
          title: "Session Expiring Soon",
          description: "Your KYC session will expire in 5 minutes. Please complete the verification process.",
          variant: "destructive"
        });
      }
      
      if (minutesRemaining === 1 && !showOneMinWarning) {
        setShowOneMinWarning(true);
        toast({
          title: "Session Expiring",
          description: "Your KYC session will expire in 1 minute! Please complete verification immediately.",
          variant: "destructive"
        });
      }
      
      if (remaining === 0 && !sessionExpiredShown) {
        setSessionExpiredShown(true);
        setSessionExpiresAt(null); // Hide timer after expiry
        toast({
          title: "Session Expired",
          description: "Your KYC session has expired. Please start a new session.",
          variant: "destructive"
        });
      }
    };
    
    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [sessionExpiresAt, currentStep, showFiveMinWarning, showOneMinWarning, sessionExpiredShown]);
  
  // Set up digital signature canvas
  useEffect(() => {
    if (currentStep !== 'compliance_signoff' || !signatureCanvasRef.current) return;
    
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    
    // Configure drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    let isDrawing = false;
    
    const startDrawing = (e: MouseEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };
    
    const draw = (e: MouseEvent) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasSignature(true);
    };
    
    const stopDrawing = () => {
      if (isDrawing) {
        isDrawing = false;
        // Capture signature after drawing
        const dataUrl = canvas.toDataURL();
        setDigitalSignature(dataUrl);
      }
    };
    
    // Add event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [currentStep]);
  
  // Compute effective entity type from detectedPanType or selectedEntityType (Manual Mode)
  const getEffectiveEntityType = (): PanEntityType | null => {
    if (detectedPanType) {
      return detectedPanType.entityType;
    }
    // For Manual Mode, convert selectedEntityType (code like 'P', 'C', 'H') to entityType
    if (selectedEntityType) {
      const typeInfo = getPanTypeInfo(selectedEntityType);
      return typeInfo?.entityType || null;
    }
    return null;
  };
  
  const getStepsForEntityType = (): WizardStep[] => {
    const entityType = getEffectiveEntityType();
    
    if (!entityType) {
      return ['pan_entry', 'pan_verification', 'ckyc_kra_check', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'risk_profiling', 'compliance_signoff', 'completed'];
    }
    
    switch (entityType) {
      case 'individual':
        return ['pan_entry', 'type_detection', 'pan_verification', 'ckyc_kra_check', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'risk_profiling', 'compliance_signoff', 'completed'];
      case 'huf':
        return ['pan_entry', 'type_detection', 'huf_details', 'pan_verification', 'data_collection', 'risk_profiling', 'compliance_signoff', 'completed'];
      case 'company':
        return ['pan_entry', 'type_detection', 'corporate_details', 'document_upload', 'signatory_verification', 'bank_verification', 'treasury_setup', 'completed'];
      case 'firm_llp':
        return ['pan_entry', 'type_detection', 'firm_llp_details', 'document_upload', 'signatory_verification', 'bank_verification', 'treasury_setup', 'completed'];
      case 'trust':
      case 'aop':
      case 'boi':
        return ['pan_entry', 'type_detection', 'trust_details', 'document_upload', 'signatory_verification', 'bank_verification', 'treasury_setup', 'completed'];
      default:
        return ['pan_entry', 'type_detection', 'document_upload', 'compliance_signoff', 'completed'];
    }
  };
  
  const getStepProgress = () => {
    const steps = getStepsForEntityType();
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };
  
  const handlePanInputChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setPanNumber(upperValue);
    setPanValidationError('');
    
    if (upperValue.length === 10) {
      const validation = validatePanFormat(upperValue);
      if (validation.valid) {
        const typeInfo = getPanTypeInfo(upperValue);
        setDetectedPanType(typeInfo);
      } else {
        setPanValidationError(validation.error || 'Invalid PAN format');
        setDetectedPanType(null);
      }
    } else {
      setDetectedPanType(null);
    }
  };
  
  const handleProceedWithDetectedType = () => {
    if (!detectedPanType) return;
    
    setSelectedEntityType(detectedPanType.code);
    setCurrentStep('type_detection');
  };
  
  const handleConfirmEntityType = () => {
    const entityType = getEffectiveEntityType();
    if (!entityType) return;
    
    switch (entityType) {
      case 'individual':
        startSessionMutation.mutate(false);
        setCurrentStep('pan_verification');
        break;
      case 'huf':
        setCurrentStep('huf_details');
        break;
      case 'company':
        setCurrentStep('corporate_details');
        break;
      case 'firm_llp':
        setCurrentStep('firm_llp_details');
        break;
      case 'trust':
      case 'aop':
      case 'boi':
        setCurrentStep('trust_details');
        break;
      default:
        setCurrentStep('document_upload');
    }
  };
  
  const getEntityIcon = (entityType: PanEntityType) => {
    switch (entityType) {
      case 'individual': return <UserCircle className="h-8 w-8" />;
      case 'company': return <Building2 className="h-8 w-8" />;
      case 'huf': return <Users className="h-8 w-8" />;
      case 'firm_llp': return <Briefcase className="h-8 w-8" />;
      case 'trust': return <Scale className="h-8 w-8" />;
      case 'aop': 
      case 'boi': return <HandshakeIcon className="h-8 w-8" />;
      default: return <Building className="h-8 w-8" />;
    }
  };
  
  const formatTimeRemaining = () => {
    if (timeRemaining === 0) return "Expired";
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const getTimerColor = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    if (minutes <= 1) return "text-red-600 dark:text-red-400";
    if (minutes <= 5) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };
  
  const renderSessionTimer = () => {
    if (!sessionExpiresAt || currentStep === 'completed') return null;
    
    return (
      <Alert className="mb-4">
        <Clock className={`h-4 w-4 ${getTimerColor()}`} />
        <AlertDescription className="flex items-center justify-between">
          <span>Session Time Remaining:</span>
          <span className={`font-mono font-bold ${getTimerColor()}`} data-testid="text-session-timer">
            {formatTimeRemaining()}
          </span>
        </AlertDescription>
      </Alert>
    );
  };
  
  const renderAssistedBanner = () => {
    if (!referralInfo?.valid || !referralInfo?.invitation) return null;
    
    const inv = referralInfo.invitation;
    const inviterLabel = inv.inviterType === 'agent' ? 'Agent' : 'Partner';
    
    return (
      <Alert className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
        <HandshakeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Badge className="bg-blue-600 text-white">Assisted Onboarding</Badge>
          You're being guided by {inv.inviterName || `your ${inviterLabel}`}
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-4 mt-2">
            {inv.clientName && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {inv.clientName}
              </span>
            )}
            {inv.suggestedEntityType && (
              <Badge variant="outline" className="border-blue-300">
                {inv.suggestedEntityType.charAt(0).toUpperCase() + inv.suggestedEntityType.slice(1)} Entity
              </Badge>
            )}
            {inv.suggestedMode && (
              <Badge variant="outline" className="border-blue-300">
                {inv.suggestedMode === 'smart' ? 'Smart' : 'Manual'} Mode
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  };
  
  const renderPanEntryStep = () => {
    const entityTypes = getOnboardableEntityTypes();
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <CardTitle>PAN-Driven Smart Onboarding</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="mode-toggle" className="text-sm text-muted-foreground">
                  {onboardingMode === 'smart' ? 'Smart Mode' : 'Manual Mode'}
                </Label>
                <Switch
                  id="mode-toggle"
                  checked={onboardingMode === 'smart'}
                  onCheckedChange={(checked) => setOnboardingMode(checked ? 'smart' : 'manual')}
                  data-testid="switch-onboarding-mode"
                />
              </div>
            </div>
            <CardDescription>
              {onboardingMode === 'smart' 
                ? "Enter your PAN and we'll automatically detect your entity type and guide you through the right onboarding process"
                : "Select your entity type manually and proceed with document-based verification"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={onboardingMode} onValueChange={(v) => setOnboardingMode(v as OnboardingMode)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="smart" className="flex items-center gap-2" data-testid="tab-smart-mode">
                  <Zap className="h-4 w-4" />
                  Smart Mode
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2" data-testid="tab-manual-mode">
                  <ClipboardList className="h-4 w-4" />
                  Manual Mode
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="smart" className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    <strong>Auto-Detection:</strong> We'll read your PAN's 4th character to identify if you're an Individual, Company, HUF, LLP, or Trust - and route you to the correct onboarding flow automatically.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pan-smart">Enter PAN Number</Label>
                    <Input
                      id="pan-smart"
                      data-testid="input-pan-smart"
                      placeholder="ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => handlePanInputChange(e.target.value)}
                      maxLength={10}
                      className={`uppercase text-lg font-mono ${panValidationError ? 'border-red-500' : detectedPanType ? 'border-green-500' : ''}`}
                    />
                    {panValidationError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {panValidationError}
                      </p>
                    )}
                  </div>
                  
                  {detectedPanType && (
                    <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg text-green-700 dark:text-green-300">
                            {getEntityIcon(detectedPanType.entityType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg text-green-800 dark:text-green-200">
                                {detectedPanType.displayName} Detected
                              </h3>
                              <Badge variant="secondary" className="bg-green-200 text-green-800">
                                PAN Type: {detectedPanType.code}
                              </Badge>
                            </div>
                            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                              {detectedPanType.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {detectedPanType.canInvest && (
                                <Badge variant="outline" className="text-green-700 border-green-300">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Can Invest
                                </Badge>
                              )}
                              {detectedPanType.canTrade && (
                                <Badge variant="outline" className="text-green-700 border-green-300">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Can Trade
                                </Badge>
                              )}
                              {detectedPanType.onboardingMode === 'treasury_only' && (
                                <Badge variant="outline" className="text-orange-700 border-orange-300">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Treasury Only
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              <strong>Products:</strong> {detectedPanType.productsAllowed.join(', ')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Button
                    onClick={handleProceedWithDetectedType}
                    disabled={!detectedPanType || !!panValidationError}
                    className="w-full"
                    size="lg"
                    data-testid="button-proceed-smart"
                  >
                    {detectedPanType ? (
                      <>
                        Proceed as {detectedPanType.displayName}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      'Enter valid PAN to continue'
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-6">
                <Alert>
                  <ClipboardList className="h-4 w-4" />
                  <AlertDescription>
                    Select your entity type below. You'll need to upload supporting documents for verification.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entityTypes.map((type) => (
                    <Card 
                      key={type.code}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedEntityType === type.code 
                          ? 'border-2 border-primary ring-2 ring-primary/20' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedEntityType(type.code);
                        setDetectedPanType(type);
                      }}
                      data-testid={`card-entity-${type.code.toLowerCase()}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center text-center">
                          <div className={`p-3 rounded-lg mb-3 ${
                            selectedEntityType === type.code 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            {getEntityIcon(type.entityType)}
                          </div>
                          <h3 className="font-semibold">{type.displayName}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </p>
                          {type.onboardingMode === 'treasury_only' && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Treasury Only
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {selectedEntityType && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pan-manual">Enter {detectedPanType?.displayName} PAN Number</Label>
                      <Input
                        id="pan-manual"
                        data-testid="input-pan-manual"
                        placeholder="ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setPanNumber(val);
                          if (val.length === 10) {
                            const validation = validatePanFormat(val);
                            if (!validation.valid) {
                              setPanValidationError(validation.error || 'Invalid PAN');
                            } else {
                              const typeCode = extractPanTypeCode(val);
                              if (typeCode !== selectedEntityType) {
                                setPanValidationError(`PAN type mismatch. Expected ${selectedEntityType} but found ${typeCode}`);
                              } else {
                                setPanValidationError('');
                              }
                            }
                          } else {
                            setPanValidationError('');
                          }
                        }}
                        maxLength={10}
                        className="uppercase text-lg font-mono"
                      />
                      {panValidationError && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {panValidationError}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => setCurrentStep('type_detection')}
                      disabled={panNumber.length !== 10 || !!panValidationError}
                      className="w-full"
                      size="lg"
                      data-testid="button-proceed-manual"
                    >
                      Continue with {detectedPanType?.displayName} Onboarding
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              How PAN-Based Detection Works
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">P</Badge>
                <span>Individual</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">C</Badge>
                <span>Company</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">H</Badge>
                <span>HUF</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">F</Badge>
                <span>Firm/LLP</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">T</Badge>
                <span>Trust</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">A</Badge>
                <span>AOP</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">B</Badge>
                <span>BOI</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">G/L/J</Badge>
                <span>Govt/Institutional</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  const renderTypeDetectionStep = () => {
    if (!detectedPanType) return null;
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle>Confirm Your Entity Type</CardTitle>
          </div>
          <CardDescription>
            We've identified your entity type from your PAN. Please confirm to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              {getEntityIcon(detectedPanType.entityType)}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{detectedPanType.displayName}</h3>
              <p className="text-sm text-muted-foreground">{detectedPanType.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                PAN: <span className="font-mono">{maskPanNumber(panNumber)}</span>
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground mb-1">Investment Access</p>
              <p className="font-medium flex items-center gap-1">
                {detectedPanType.canInvest ? (
                  <><CheckCircle className="h-4 w-4 text-green-600" /> Allowed</>
                ) : (
                  <><AlertCircle className="h-4 w-4 text-orange-600" /> Restricted</>
                )}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground mb-1">Trading Access</p>
              <p className="font-medium flex items-center gap-1">
                {detectedPanType.canTrade ? (
                  <><CheckCircle className="h-4 w-4 text-green-600" /> Allowed</>
                ) : (
                  <><AlertCircle className="h-4 w-4 text-orange-600" /> Not Available</>
                )}
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Products Available for {detectedPanType.displayName}:
            </p>
            <div className="flex flex-wrap gap-2">
              {detectedPanType.productsAllowed.map((product) => (
                <Badge key={product} variant="secondary">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
          
          {detectedPanType.requiresApproval && (
            <Alert className="bg-orange-50 border-orange-200">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Note:</strong> {detectedPanType.displayName} accounts require additional verification and admin approval before activation.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep('pan_entry');
                setPanNumber('');
                setDetectedPanType(null);
                setSelectedEntityType(null);
              }}
              className="flex-1"
              data-testid="button-back-pan-entry"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Change PAN
            </Button>
            <Button
              onClick={handleConfirmEntityType}
              className="flex-1"
              data-testid="button-confirm-entity"
            >
              Confirm & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const renderPanVerificationStep = () => {
    const isPanAlreadyVerified = sessionId && panNumber && panData;
    
    // Mask PAN number for display (show first 5 and last character)
    const maskedPan = panNumber ? `${panNumber.substring(0, 5)}****${panNumber.charAt(9)}` : '';
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Step 1: PAN Verification</CardTitle>
          </div>
          <CardDescription>
            {isPanAlreadyVerified 
              ? "Your PAN has been verified successfully"
              : "Enter your PAN number and date of birth to verify your identity"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPanAlreadyVerified ? (
            <>
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-300">
                  <strong>PAN Already Verified:</strong> Your PAN ({maskedPan}) is already verified in our system
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    PAN Number
                  </Label>
                  <Input
                    value={panNumber}
                    disabled
                    className="bg-muted border-green-200 dark:border-green-800"
                    data-testid="input-pan-verified"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Full Name (as per PAN)
                  </Label>
                  <Input
                    value={panFullName}
                    disabled
                    className="bg-muted border-green-200 dark:border-green-800"
                    data-testid="input-fullname-verified"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Date of Birth
                  </Label>
                  <Input
                    value={panDob}
                    disabled
                    type="date"
                    className="bg-muted border-green-200 dark:border-green-800"
                    data-testid="input-dob-verified"
                  />
                </div>
              </div>

              {v2EntityInfo && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    <div className="flex items-center justify-between">
                      <span>
                        <strong>Entity Type:</strong> {v2EntityInfo.entity_detected}
                        {v2EntityInfo.entity_locked && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Locked
                          </span>
                        )}
                      </span>
                      {v2EntityInfo.override_allowed && (
                        <span className="text-xs text-blue-500">Admin override available</span>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                data-testid="button-continue-next"
                onClick={() => checkKraStatusMutation.mutate()}
                disabled={checkKraStatusMutation.isPending}
                className="w-full"
              >
                {checkKraStatusMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking KRA Status...
                  </>
                ) : (
                  <>
                    Continue to Next Step
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {sessionId && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    <strong>Session Active:</strong> Your KYC session is ready
                  </AlertDescription>
                </Alert>
              )}
              
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Smart KYC will automatically fetch your details from government databases after verification
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="pan">PAN Number</Label>
                <Input
                  id="pan"
                  data-testid="input-pan"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="uppercase"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name (as per PAN)</Label>
                <Input
                  id="fullName"
                  data-testid="input-fullname"
                  placeholder="John Doe"
                  value={panFullName}
                  onChange={(e) => setPanFullName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Enter your name exactly as it appears on your PAN card
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  data-testid="input-dob"
                  type="date"
                  value={panDob}
                  onChange={(e) => setPanDob(e.target.value)}
                />
              </div>
              
              <Button
                data-testid="button-verify-pan"
                onClick={() => verifyPanMutation.mutate()}
                disabled={!sessionId || !panNumber || !panFullName || !panDob || verifyPanMutation.isPending}
                className="w-full"
              >
                {verifyPanMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify PAN
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };
  
  const renderAadhaarOtpStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 2: Aadhaar Verification</CardTitle>
        </div>
        <CardDescription>
          Enter your Aadhaar number to receive OTP for verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {panData && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>PAN Verified:</strong> {panData.name}
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Important:</strong> OTP will be sent by UIDAI to the mobile number linked with your Aadhaar card, not the number you registered with on FintekPro. Please ensure you have access to your Aadhaar-registered mobile.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="aadhaar">Aadhaar Number</Label>
          <Input
            id="aadhaar"
            data-testid="input-aadhaar"
            placeholder="1234 5678 9012"
            value={aadhaarNumber}
            onChange={(e) => setAadhaarNumber(e.target.value.replace(/\s/g, ''))}
            maxLength={12}
          />
          <p className="text-sm text-muted-foreground">
            Enter your 12-digit Aadhaar number (without spaces)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="button-back-pan"
            onClick={() => setCurrentStep('pan_verification')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            data-testid="button-send-otp"
            onClick={() => sendAadhaarOtpMutation.mutate()}
            disabled={aadhaarNumber.length !== 12 || sendAadhaarOtpMutation.isPending}
            className="flex-1"
          >
            {sendAadhaarOtpMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                Send OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderAadhaarVerificationStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 3: Verify OTP</CardTitle>
        </div>
        <CardDescription>
          Enter the OTP sent to your mobile number ending with {(aadhaarMasked || '').slice(-4) || '****'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Test Mode:</strong> No real SMS is sent. Use the fixed OTP: <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 rounded font-mono font-bold">123456</code>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="otp">Enter OTP</Label>
          <Input
            id="otp"
            data-testid="input-otp"
            placeholder="Enter 6-digit OTP"
            value={aadhaarOtp}
            onChange={(e) => setAadhaarOtp(e.target.value)}
            maxLength={6}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="button-resend-otp"
            onClick={() => {
              setCurrentStep('aadhaar_otp');
              setAadhaarOtp('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            data-testid="button-verify-otp"
            onClick={() => verifyAadhaarOtpMutation.mutate()}
            disabled={aadhaarOtp.length !== 6 || verifyAadhaarOtpMutation.isPending}
            className="flex-1"
          >
            {verifyAadhaarOtpMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderCkycKraCheckStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 3: Central KYC Registry Check</CardTitle>
        </div>
        <CardDescription>
          Checking your existing KYC records in the CKYC/KRA registry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Regulatory Reference:</strong> Per RBI Master Direction on KYC (2016, amended 2024) and CERSAI CKYC Circular, we first check your existing KYC records to minimize redundant data collection.
          </AlertDescription>
        </Alert>
        
        {!checkKraStatusMutation.isPending && !checkKraStatusMutation.isSuccess && (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Ready to check CKYC/KRA Registry</p>
              <p className="text-sm text-muted-foreground mt-1">
                We will search for your existing KYC records using your verified PAN. If found, Aadhaar verification can be skipped.
              </p>
            </div>
            <Button
              onClick={() => checkKraStatusMutation.mutate()}
              className="w-full"
              data-testid="btn-check-ckyc"
            >
              <Shield className="mr-2 h-4 w-4" />
              Check CKYC/KRA Status
            </Button>
          </div>
        )}
        
        {checkKraStatusMutation.isPending && (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Searching CKYC Registry...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Querying Central KYC Registry and KRA databases
              </p>
            </div>
          </div>
        )}

        {v2CkycInfo && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">CKYC Confidence Score</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${v2CkycInfo.confidence_score >= 0.9 ? 'bg-green-500' : v2CkycInfo.confidence_score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${v2CkycInfo.confidence_score * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold">{Math.round(v2CkycInfo.confidence_score * 100)}%</span>
              </div>
            </div>
            {v2CkycInfo.missing_fields.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">Missing Fields</p>
                <div className="flex flex-wrap gap-1">
                  {v2CkycInfo.missing_fields.map((field: string) => (
                    <span key={field} className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                      {field.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Source: {v2CkycInfo.source} | Aadhaar {v2CkycInfo.aadhaar_required ? 'Required' : 'Not Required'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDataCollectionStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <CardTitle>Step 4: Auto-Populated Information</CardTitle>
        </div>
        <CardDescription>
          Review your information fetched from verified sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aadhaarData && (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Both verifications completed successfully!</strong>
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Name (from PAN)</Label>
                <p className="font-medium">{panData?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Name (from Aadhaar)</Label>
                <p className="font-medium">{aadhaarData?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date of Birth</Label>
                <p className="font-medium">{aadhaarData?.dob || panDob}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Gender</Label>
                <p className="font-medium">{aadhaarData?.gender || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <Label className="text-muted-foreground">Address (from Aadhaar)</Label>
              <p className="font-medium">
                {aadhaarData?.address?.house}, {aadhaarData?.address?.street}<br />
                {aadhaarData?.address?.locality}, {aadhaarData?.address?.city}<br />
                {aadhaarData?.address?.state} - {aadhaarData?.address?.pincode}
              </p>
            </div>
            
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                All required information has been automatically collected and verified. Proceed to complete your risk profile and compliance declarations.
              </AlertDescription>
            </Alert>
            
            <Button
              data-testid="button-proceed-risk-profile"
              onClick={() => setCurrentStep('risk_profiling')}
              className="w-full"
            >
              Proceed to Risk Profiling
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
        {!aadhaarData && (
          <div className="space-y-4">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Aadhaar verification required</strong><br />
                Please complete Aadhaar OTP verification to proceed with your KYC.
              </AlertDescription>
            </Alert>
            
            {panData && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">PAN Verified</span>
                </div>
                <p className="text-sm text-green-700">{panData?.name || panFullName}</p>
                <p className="text-xs text-muted-foreground mt-1">PAN: {maskPanNumber(panNumber || panData?.pan_number || '')}</p>
              </div>
            )}
            
            <Button
              data-testid="button-goto-aadhaar"
              onClick={() => setCurrentStep('aadhaar_otp')}
              className="w-full"
            >
              Continue with Aadhaar Verification
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  const renderRiskProfilingStep = () => {
    const isFormValid = 
      riskProfileAnswers.investmentObjective &&
      riskProfileAnswers.investmentHorizon &&
      riskProfileAnswers.riskTolerance &&
      riskProfileAnswers.incomeLevel &&
      riskProfileAnswers.tradingExperience;
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Step 5: Risk Profiling</CardTitle>
          </div>
          <CardDescription>
            Help us understand your investment profile and risk appetite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Investment Objective</Label>
            <RadioGroup
              value={riskProfileAnswers.investmentObjective}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, investmentObjective: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="capital_appreciation" id="cap-app" data-testid="radio-cap-app" />
                <Label htmlFor="cap-app" className="font-normal">Capital Appreciation</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular_income" id="reg-inc" data-testid="radio-reg-inc" />
                <Label htmlFor="reg-inc" className="font-normal">Regular Income</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="balanced" id="balanced" data-testid="radio-balanced" />
                <Label htmlFor="balanced" className="font-normal">Balanced Growth & Income</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Investment Horizon</Label>
            <RadioGroup
              value={riskProfileAnswers.investmentHorizon}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, investmentHorizon: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="short_term" id="short" data-testid="radio-short" />
                <Label htmlFor="short" className="font-normal">Short Term (Less than 3 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium_term" id="medium" data-testid="radio-medium" />
                <Label htmlFor="medium" className="font-normal">Medium Term (3-5 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="long_term" id="long" data-testid="radio-long" />
                <Label htmlFor="long" className="font-normal">Long Term (More than 5 years)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Risk Tolerance</Label>
            <RadioGroup
              value={riskProfileAnswers.riskTolerance}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, riskTolerance: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="conservative" id="conservative" data-testid="radio-conservative" />
                <Label htmlFor="conservative" className="font-normal">Conservative (Low Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="moderate" data-testid="radio-moderate" />
                <Label htmlFor="moderate" className="font-normal">Moderate (Medium Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aggressive" id="aggressive" data-testid="radio-aggressive" />
                <Label htmlFor="aggressive" className="font-normal">Aggressive (High Risk)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Annual Income</Label>
            <Select value={riskProfileAnswers.incomeLevel} onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, incomeLevel: value})}>
              <SelectTrigger data-testid="select-income">
                <SelectValue placeholder="Select your income range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="below_5l">Below ₹5 Lakhs</SelectItem>
                <SelectItem value="5l_to_10l">₹5-10 Lakhs</SelectItem>
                <SelectItem value="10l_to_25l">₹10-25 Lakhs</SelectItem>
                <SelectItem value="25l_to_1cr">₹25 Lakhs - ₹1 Crore</SelectItem>
                <SelectItem value="above_1cr">Above ₹1 Crore</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Trading Experience</Label>
            <RadioGroup
              value={riskProfileAnswers.tradingExperience}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, tradingExperience: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="beginner" id="beginner" data-testid="radio-beginner" />
                <Label htmlFor="beginner" className="font-normal">Beginner (Less than 1 year)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="intermediate" id="intermediate" data-testid="radio-intermediate" />
                <Label htmlFor="intermediate" className="font-normal">Intermediate (1-3 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="experienced" id="experienced" data-testid="radio-experienced" />
                <Label htmlFor="experienced" className="font-normal">Experienced (More than 3 years)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <Button
            data-testid="button-submit-risk-profile"
            onClick={() => submitRiskProfilingMutation.mutate()}
            disabled={!isFormValid || submitRiskProfilingMutation.isPending}
            className="w-full"
          >
            {submitRiskProfilingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue to Compliance
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  const renderComplianceSignoffStep = () => {
    const clearSignature = () => {
      if (signatureCanvasRef.current) {
        const ctx = signatureCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
        }
      }
      setDigitalSignature('');
      setHasSignature(false);
    };
    
    const isFormValid = fatcaDeclaration && riskAcknowledgment && termsAndConditions && privacyPolicy;
    const missingDeclarations = [
      !fatcaDeclaration && 'FATCA Declaration',
      !riskAcknowledgment && 'Risk Acknowledgment',
      !termsAndConditions && 'Terms & Conditions',
      !privacyPolicy && 'Privacy Policy'
    ].filter(Boolean);
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle>Step 6: Compliance & Declarations</CardTitle>
          </div>
          <CardDescription>
            Review and accept the required compliance declarations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isFormValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required:</strong> Please accept all {missingDeclarations.length} remaining declaration(s): {missingDeclarations.join(', ')}
              </AlertDescription>
            </Alert>
          )}
          
          {isFormValid && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All mandatory declarations accepted. You may now submit your compliance sign-off.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="fatca"
                data-testid="checkbox-fatca"
                checked={fatcaDeclaration}
                onCheckedChange={(checked) => setFatcaDeclaration(checked as boolean)}
              />
              <Label htmlFor="fatca" className="font-normal leading-relaxed cursor-pointer">
                <strong>FATCA Declaration:</strong> I confirm that I am not a US citizen/resident for tax purposes and I am a tax resident of India.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="risk-ack"
                data-testid="checkbox-risk"
                checked={riskAcknowledgment}
                onCheckedChange={(checked) => setRiskAcknowledgment(checked as boolean)}
              />
              <Label htmlFor="risk-ack" className="font-normal leading-relaxed cursor-pointer">
                <strong>Risk Acknowledgment:</strong> I understand that investments in securities markets are subject to market risks and I am responsible for my investment decisions.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                data-testid="checkbox-terms"
                checked={termsAndConditions}
                onCheckedChange={(checked) => setTermsAndConditions(checked as boolean)}
              />
              <Label htmlFor="terms" className="font-normal leading-relaxed cursor-pointer">
                <strong>Terms & Conditions:</strong> I have read and agree to the Terms and Conditions of FintekPro.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="privacy"
                data-testid="checkbox-privacy"
                checked={privacyPolicy}
                onCheckedChange={(checked) => setPrivacyPolicy(checked as boolean)}
              />
              <Label htmlFor="privacy" className="font-normal leading-relaxed cursor-pointer">
                <strong>Privacy Policy:</strong> I acknowledge and consent to the Privacy Policy and data usage terms.
              </Label>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-country">Tax Residency Country</Label>
              <Input
                id="tax-country"
                data-testid="input-tax-country"
                value={taxResidencyCountry}
                onChange={(e) => setTaxResidencyCountry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tin">TIN/Tax ID (Optional)</Label>
              <Input
                id="tin"
                data-testid="input-tin"
                placeholder="Enter your TIN number"
                value={tinNumber}
                onChange={(e) => setTinNumber(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Electronic Signature</Label>
                <p className="text-sm text-muted-foreground">Choose a regulator-approved signing method</p>
              </div>
              {hasSignature && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
                  <CheckCircle className="mr-1 h-3 w-3" /> Signed
                </Badge>
              )}
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
              <ScrollText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                All methods below are approved under the <strong>Information Technology Act, 2000</strong> (Sections 3 & 3A), recognized by <strong>SEBI, RBI, IRDAI, PFRDA</strong>, and the <strong>Controller of Certifying Authorities (CCA)</strong>, Government of India.
              </AlertDescription>
            </Alert>

            <input
              type="file"
              ref={signatureFileRef}
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Signature image must be under 2MB", variant: "destructive" });
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setUploadedSignatureUrl(dataUrl);
                    setDigitalSignature(dataUrl);
                    setHasSignature(true);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              data-testid="input-signature-file"
            />

            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${expandedSignCategory === 'electronic' ? 'bg-primary/5 border-b' : 'hover:bg-muted/50'}`}
                onClick={() => setExpandedSignCategory(expandedSignCategory === 'electronic' ? null : 'electronic')}
              >
                <div className="flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Electronic Signature</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">IT Act S.3A</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Draw / Type / Upload</span>
                  {expandedSignCategory === 'electronic' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expandedSignCategory === 'electronic' && (
                <div className="p-3 space-y-3 bg-muted/30">
                  <div className="flex gap-2">
                    <Button variant={signMethod === 'draw' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('draw')} data-testid="btn-sign-draw">
                      <PenLine className="mr-1.5 h-3.5 w-3.5" /> Draw
                    </Button>
                    <Button variant={signMethod === 'type' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('type')} data-testid="btn-sign-type">
                      <Type className="mr-1.5 h-3.5 w-3.5" /> Type
                    </Button>
                    <Button variant={signMethod === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('upload')} data-testid="btn-sign-upload">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
                    </Button>
                  </div>

                  {signMethod === 'draw' && (
                    <div className="border rounded-md p-4 bg-card">
                      <canvas
                        ref={signatureCanvasRef}
                        className="w-full border border-dashed border-border rounded cursor-crosshair bg-white dark:bg-gray-950"
                        style={{ height: '150px' }}
                        data-testid="canvas-signature"
                      />
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                          {hasSignature ? '✓ Signature captured' : 'Sign above using your mouse or touchpad'}
                        </p>
                        <Button variant="outline" size="sm" onClick={clearSignature} data-testid="button-clear-signature">Clear</Button>
                      </div>
                    </div>
                  )}

                  {signMethod === 'type' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      <Input
                        placeholder="Type your full legal name as signature"
                        value={typedSignature}
                        onChange={(e) => {
                          setTypedSignature(e.target.value);
                          if (e.target.value.trim().length >= 3) {
                            setDigitalSignature(`typed:${e.target.value.trim()}`);
                            setHasSignature(true);
                          } else {
                            setDigitalSignature('');
                            setHasSignature(false);
                          }
                        }}
                        data-testid="input-typed-signature"
                      />
                      {typedSignature.trim().length >= 3 && (
                        <div className="border border-dashed border-border rounded p-4 bg-muted text-center">
                          <p className="text-2xl italic font-serif text-foreground">{typedSignature}</p>
                          <p className="text-xs text-muted-foreground mt-1">Preview of your typed signature</p>
                        </div>
                      )}
                    </div>
                  )}

                  {signMethod === 'upload' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      {!uploadedSignatureUrl ? (
                        <div
                          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => signatureFileRef.current?.click()}
                        >
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="font-medium text-sm">Click to upload your saved signature</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG (max 2MB)</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="border border-border rounded p-4 bg-muted text-center">
                            <img src={uploadedSignatureUrl} alt="Uploaded signature" className="max-h-24 mx-auto" />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" /> Signature uploaded
                            </p>
                            <Button variant="outline" size="sm" onClick={() => { setUploadedSignatureUrl(''); setDigitalSignature(''); setHasSignature(false); if (signatureFileRef.current) signatureFileRef.current.value = ''; }}>Remove</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Electronic signature under IT Act, 2000 Section 3A. Accepted for account opening and general KYC consent.
                  </p>
                </div>
              )}

              <button
                type="button"
                className={`w-full flex items-center justify-between p-3 text-left border-t transition-colors ${expandedSignCategory === 'aadhaar' ? 'bg-primary/5 border-b' : 'hover:bg-muted/50'}`}
                onClick={() => setExpandedSignCategory(expandedSignCategory === 'aadhaar' ? null : 'aadhaar')}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Aadhaar eSign</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 text-[10px] px-1.5 py-0">Highest Acceptance</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">OTP / Biometric</span>
                  {expandedSignCategory === 'aadhaar' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expandedSignCategory === 'aadhaar' && (
                <div className="p-3 space-y-3 bg-muted/30">
                  <Alert className="bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
                      Aadhaar eSign is the most widely accepted digital signature in India. Valid under IT Act 2000 (S.3A), accepted by <strong>SEBI, RBI, IRDAI, PFRDA, UIDAI</strong>, and all government bodies. Issued by CCA-licensed ESPs (AuthBridge, Protean/NSDL, eMudhra, CVL/CDSL).
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button variant={signMethod === 'aadhaar_otp' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('aadhaar_otp')} data-testid="btn-sign-aadhaar-otp">
                      <Smartphone className="mr-1.5 h-3.5 w-3.5" /> OTP-based
                    </Button>
                    <Button variant={signMethod === 'aadhaar_biometric' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('aadhaar_biometric')} data-testid="btn-sign-aadhaar-bio">
                      <Fingerprint className="mr-1.5 h-3.5 w-3.5" /> Biometric
                    </Button>
                  </div>

                  {signMethod === 'aadhaar_otp' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        <span>ESP Providers: AuthBridge | Protean (NSDL) | eMudhra | CVL (CDSL)</span>
                      </div>

                      {aadhaarEsignStatus === 'idle' && (
                        <div className="text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            An OTP will be sent to your Aadhaar-linked mobile number for authentication.
                          </p>
                          <Button
                            onClick={() => {
                              setAadhaarEsignStatus('pending');
                              setTimeout(() => {
                                setAadhaarEsignStatus('completed');
                                setDigitalSignature('aadhaar-esign-otp:verified');
                                setHasSignature(true);
                                toast({ title: "Aadhaar eSign Successful", description: "Document signed via Aadhaar OTP-based eSign." });
                              }, 2000);
                            }}
                            className="w-full"
                            data-testid="btn-aadhaar-esign"
                          >
                            <Shield className="mr-2 h-4 w-4" /> Initiate Aadhaar OTP eSign
                          </Button>
                        </div>
                      )}

                      {aadhaarEsignStatus === 'pending' && (
                        <div className="text-center space-y-3 py-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="text-sm text-muted-foreground">Connecting to ESP gateway...</p>
                        </div>
                      )}

                      {aadhaarEsignStatus === 'completed' && (
                        <div className="text-center space-y-2 py-2">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">Aadhaar OTP eSign completed</p>
                          <p className="text-xs text-muted-foreground">Signed with CCA-certified Aadhaar electronic signature</p>
                          <Button variant="ghost" size="sm" onClick={() => { setAadhaarEsignStatus('idle'); setDigitalSignature(''); setHasSignature(false); }}>Re-sign</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {signMethod === 'aadhaar_biometric' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Fingerprint className="h-3.5 w-3.5" />
                        <span>Biometric authentication via registered fingerprint or iris scan</span>
                      </div>

                      {biometricEsignStatus === 'idle' && (
                        <div className="text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Requires a registered biometric device (fingerprint scanner or iris reader) connected to your system.
                          </p>
                          <Button
                            onClick={() => {
                              setBiometricEsignStatus('scanning');
                              setTimeout(() => {
                                setBiometricEsignStatus('completed');
                                setDigitalSignature('aadhaar-esign-biometric:verified');
                                setHasSignature(true);
                                toast({ title: "Biometric eSign Successful", description: "Document signed via Aadhaar biometric authentication." });
                              }, 3000);
                            }}
                            className="w-full"
                            data-testid="btn-biometric-esign"
                          >
                            <Fingerprint className="mr-2 h-4 w-4" /> Initiate Biometric eSign
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Supported devices: STQC-certified fingerprint scanners (Morpho, Mantra, Cogent) and iris scanners
                          </p>
                        </div>
                      )}

                      {biometricEsignStatus === 'scanning' && (
                        <div className="text-center space-y-3 py-4">
                          <div className="relative mx-auto w-16 h-16">
                            <Fingerprint className="h-16 w-16 text-primary animate-pulse" />
                          </div>
                          <p className="text-sm font-medium">Scanning biometric...</p>
                          <p className="text-xs text-muted-foreground">Place your finger on the scanner or look into the iris reader</p>
                        </div>
                      )}

                      {biometricEsignStatus === 'completed' && (
                        <div className="text-center space-y-2 py-2">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">Biometric eSign completed</p>
                          <p className="text-xs text-muted-foreground">Signed with Aadhaar biometric-based electronic signature</p>
                          <Button variant="ghost" size="sm" onClick={() => { setBiometricEsignStatus('idle'); setDigitalSignature(''); setHasSignature(false); }}>Re-sign</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Aadhaar eSign per UIDAI guidelines. Legal validity: IT Act 2000 S.3A, equivalent to handwritten signature (S.5). Accepted for all financial regulatory filings.
                  </p>
                </div>
              )}

              <button
                type="button"
                className={`w-full flex items-center justify-between p-3 text-left border-t transition-colors ${expandedSignCategory === 'dsc' ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setExpandedSignCategory(expandedSignCategory === 'dsc' ? null : 'dsc')}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-sm">Digital Signature Certificate (DSC)</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-400">IT Act S.3</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">USB Token / Virtual</span>
                  {expandedSignCategory === 'dsc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expandedSignCategory === 'dsc' && (
                <div className="p-3 space-y-3 bg-muted/30">
                  <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">
                    <KeyRound className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                      <strong>Digital Signature Certificate</strong> (Class 2/3) has the highest legal validity under IT Act 2000 (S.3). Mandatory for company directors, auditors, and certain SEBI/MCA filings. Issued by licensed Certifying Authorities (eMudhra, Sify, nCode, Capricorn, Pantasign).
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button variant={signMethod === 'dsc_token' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('dsc_token')} data-testid="btn-sign-dsc">
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" /> USB Token
                    </Button>
                    <Button variant={signMethod === 'virtual_sign' ? 'default' : 'outline'} size="sm" onClick={() => setSignMethod('virtual_sign')} data-testid="btn-sign-virtual">
                      <Smartphone className="mr-1.5 h-3.5 w-3.5" /> Virtual Sign
                    </Button>
                  </div>

                  {signMethod === 'dsc_token' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Class 2/3 DSC via USB hardware token or smart card</span>
                      </div>

                      {dscTokenStatus === 'idle' && (
                        <div className="text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Insert your DSC USB token and click below to detect your digital certificate.
                          </p>
                          <Button
                            onClick={() => {
                              setDscTokenStatus('detecting');
                              setTimeout(() => {
                                setDscTokenInfo({
                                  issuer: 'eMudhra Limited',
                                  subject: panData?.name || 'Certificate Holder',
                                  certClass: 'Class 3',
                                  validTo: '2027-12-31'
                                });
                                setDscTokenStatus('detected');
                                toast({ title: "DSC Token Detected", description: "Digital certificate found. Review and sign." });
                              }, 2000);
                            }}
                            className="w-full"
                            data-testid="btn-detect-dsc"
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Detect DSC Token
                          </Button>
                        </div>
                      )}

                      {dscTokenStatus === 'detecting' && (
                        <div className="text-center space-y-3 py-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
                          <p className="text-sm text-muted-foreground">Detecting USB token / smart card...</p>
                        </div>
                      )}

                      {dscTokenStatus === 'detected' && dscTokenInfo && (
                        <div className="space-y-3">
                          <div className="border border-amber-200 dark:border-amber-500/30 rounded p-3 bg-amber-50/50 dark:bg-amber-500/5">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Certificate Holder</p>
                                <p className="font-medium">{dscTokenInfo.subject}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Issuing CA</p>
                                <p className="font-medium">{dscTokenInfo.issuer}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Certificate Class</p>
                                <p className="font-medium">{dscTokenInfo.certClass}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Valid Until</p>
                                <p className="font-medium">{dscTokenInfo.validTo}</p>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setDscTokenStatus('signing');
                              setTimeout(() => {
                                setDscTokenStatus('completed');
                                setDigitalSignature('dsc-token:class3:verified');
                                setHasSignature(true);
                                toast({ title: "DSC Signing Complete", description: "Document signed with Class 3 Digital Signature Certificate." });
                              }, 2000);
                            }}
                            className="w-full"
                            data-testid="btn-sign-with-dsc"
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Sign with DSC (Enter PIN)
                          </Button>
                        </div>
                      )}

                      {dscTokenStatus === 'signing' && (
                        <div className="text-center space-y-3 py-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
                          <p className="text-sm text-muted-foreground">Signing document... Enter PIN on your token device.</p>
                        </div>
                      )}

                      {dscTokenStatus === 'completed' && (
                        <div className="text-center space-y-2 py-2">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">DSC signing completed</p>
                          <p className="text-xs text-muted-foreground">Document signed with {dscTokenInfo?.certClass} Digital Signature Certificate</p>
                          <Button variant="ghost" size="sm" onClick={() => { setDscTokenStatus('idle'); setDscTokenInfo(null); setDigitalSignature(''); setHasSignature(false); }}>Re-sign</Button>
                        </div>
                      )}

                      {dscTokenStatus === 'error' && (
                        <div className="text-center space-y-3">
                          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                          <p className="text-sm text-red-600 dark:text-red-400">Token not detected. Please check your USB connection.</p>
                          <Button variant="outline" size="sm" onClick={() => setDscTokenStatus('idle')}>Retry</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {signMethod === 'virtual_sign' && (
                    <div className="border rounded-md p-4 bg-card space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>OTP-based virtual signing via registered mobile number</span>
                      </div>

                      {virtualSignStatus === 'idle' && (
                        <div className="text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            An OTP will be sent to your registered mobile number to authenticate and sign the document.
                          </p>
                          <Button
                            onClick={() => {
                              setVirtualSignStatus('otp_sent');
                              toast({ title: "OTP Sent", description: "A 6-digit OTP has been sent to your registered mobile number." });
                            }}
                            className="w-full"
                            data-testid="btn-virtual-sign"
                          >
                            <Smartphone className="mr-2 h-4 w-4" /> Send Virtual Sign OTP
                          </Button>
                        </div>
                      )}

                      {virtualSignStatus === 'otp_sent' && (
                        <div className="space-y-3">
                          <Input
                            placeholder="Enter 6-digit OTP"
                            value={virtualSignOtp}
                            onChange={(e) => setVirtualSignOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            className="text-center text-lg tracking-widest"
                            data-testid="input-virtual-otp"
                          />
                          <Button
                            onClick={() => {
                              setVirtualSignStatus('verifying');
                              setTimeout(() => {
                                setVirtualSignStatus('completed');
                                setDigitalSignature('virtual-sign:otp-verified');
                                setHasSignature(true);
                                toast({ title: "Virtual Sign Complete", description: "Document signed via OTP-based virtual signature." });
                              }, 1500);
                            }}
                            disabled={virtualSignOtp.length !== 6}
                            className="w-full"
                            data-testid="btn-verify-virtual-otp"
                          >
                            Verify & Sign
                          </Button>
                        </div>
                      )}

                      {virtualSignStatus === 'verifying' && (
                        <div className="text-center space-y-3 py-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="text-sm text-muted-foreground">Verifying OTP and signing...</p>
                        </div>
                      )}

                      {virtualSignStatus === 'completed' && (
                        <div className="text-center space-y-2 py-2">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">Virtual sign completed</p>
                          <p className="text-xs text-muted-foreground">Document signed via OTP-based virtual signature</p>
                          <Button variant="ghost" size="sm" onClick={() => { setVirtualSignStatus('idle'); setVirtualSignOtp(''); setDigitalSignature(''); setHasSignature(false); }}>Re-sign</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    DSC under IT Act 2000 S.3. Class 2 for individual identity; Class 3 for organizational/high-value transactions. Mandatory for MCA filings, SEBI registrations, and statutory audits.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Regulatory Framework:</strong> All electronic signature methods are governed by the Information Technology Act, 2000 and the Information Technology (Certifying Authorities) Rules, 2000. Aadhaar eSign operates under UIDAI eSign API guidelines. DSC certificates are issued by CCA-licensed Certifying Authorities. Per Section 5 of the IT Act, electronic signatures have the same legal validity as handwritten signatures.
              </p>
            </div>
          </div>
          
          {!isFormValid && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Complete all required declarations above to enable submission
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            data-testid="button-submit-compliance"
            onClick={() => {
              // Final validation before submission
              if (!isFormValid) {
                toast({
                  title: "Incomplete Declarations",
                  description: `Please accept: ${missingDeclarations.join(', ')}`,
                  variant: "destructive"
                });
                return;
              }
              submitComplianceMutation.mutate();
            }}
            disabled={!isFormValid || submitComplianceMutation.isPending}
            className="w-full"
          >
            {submitComplianceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : !isFormValid ? (
              <>
                Accept All Declarations to Continue
                <AlertCircle className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Submit & Complete KYC
                <CheckCircle className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  const renderHufDetailsStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle>HUF Details</CardTitle>
        </div>
        <CardDescription>
          Enter details about your Hindu Undivided Family
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            HUF PAN detected: <span className="font-mono font-bold">{maskPanNumber(panNumber)}</span>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="karta-pan">Karta's PAN Number</Label>
            <Input
              id="karta-pan"
              data-testid="input-karta-pan"
              placeholder="ABCDE1234F"
              value={kartaPanNumber}
              onChange={(e) => setKartaPanNumber(e.target.value.toUpperCase())}
              maxLength={10}
              className="uppercase font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The Karta (head of HUF) must have an Individual PAN
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="karta-name">Karta's Full Name</Label>
            <Input
              id="karta-name"
              data-testid="input-karta-name"
              placeholder="Full name as per PAN"
              value={kartaName}
              onChange={(e) => setKartaName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="member-count">Number of Coparceners</Label>
            <Select value={hufMemberCount} onValueChange={setHufMemberCount}>
              <SelectTrigger data-testid="select-member-count">
                <SelectValue placeholder="Select member count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2-5">2-5 members</SelectItem>
                <SelectItem value="6-10">6-10 members</SelectItem>
                <SelectItem value="11-20">11-20 members</SelectItem>
                <SelectItem value="20+">More than 20 members</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('type_detection')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => {
              startSessionMutation.mutate(false);
              setCurrentStep('pan_verification');
            }}
            disabled={!kartaPanNumber || kartaPanNumber.length !== 10 || !kartaName}
            className="flex-1"
            data-testid="button-proceed-huf"
          >
            Continue with Karta Verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderCorporateDetailsStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <CardTitle>Corporate Entity Details</CardTitle>
        </div>
        <CardDescription>
          Enter your company's registration details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Company PAN detected: <span className="font-mono font-bold">{maskPanNumber(panNumber)}</span>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-name">Registered Company Name</Label>
            <Input
              id="entity-name"
              data-testid="input-entity-name"
              placeholder="As per Certificate of Incorporation"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cin">CIN (Corporate Identity Number)</Label>
              <Input
                id="cin"
                data-testid="input-cin"
                placeholder="L12345MH2020PLC123456"
                value={cin}
                onChange={(e) => setCin(e.target.value.toUpperCase())}
                maxLength={21}
                className="uppercase font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst">GST Number (Optional)</Label>
              <Input
                id="gst"
                data-testid="input-gst"
                placeholder="27AABCU9603R1ZM"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                maxLength={15}
                className="uppercase font-mono"
              />
            </div>
          </div>
          
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <Label className="font-medium">Authorized Signatory Details</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signatory-pan" className="text-sm">Signatory PAN</Label>
                <Input
                  id="signatory-pan"
                  data-testid="input-signatory-pan"
                  placeholder="Individual PAN"
                  value={authorizedSignatoryPan}
                  onChange={(e) => setAuthorizedSignatoryPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signatory-name" className="text-sm">Signatory Name</Label>
                <Input
                  id="signatory-name"
                  data-testid="input-signatory-name"
                  placeholder="As per PAN"
                  value={authorizedSignatoryName}
                  onChange={(e) => setAuthorizedSignatoryName(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Note:</strong> Corporate accounts are restricted to Treasury products only. 
              A Board Resolution authorizing investments will be required.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('type_detection')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('document_upload')}
            disabled={!entityName || !cin || cin.length !== 21}
            className="flex-1"
            data-testid="button-proceed-corporate"
          >
            Continue to Document Upload
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderFirmLlpDetailsStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          <CardTitle>Firm / LLP Details</CardTitle>
        </div>
        <CardDescription>
          Enter your partnership or LLP registration details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Firm/LLP PAN detected: <span className="font-mono font-bold">{maskPanNumber(panNumber)}</span>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm/LLP Name</Label>
            <Input
              id="firm-name"
              data-testid="input-firm-name"
              placeholder="As per registration"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="llpin">LLPIN (for LLP) or Registration Number</Label>
            <Input
              id="llpin"
              data-testid="input-llpin"
              placeholder="AAA-1234"
              value={llpin}
              onChange={(e) => setLlpin(e.target.value.toUpperCase())}
              className="uppercase font-mono"
            />
          </div>
          
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <Label className="font-medium">Designated Partner Details</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner-pan" className="text-sm">Partner PAN</Label>
                <Input
                  id="partner-pan"
                  data-testid="input-partner-pan"
                  placeholder="Individual PAN"
                  value={authorizedSignatoryPan}
                  onChange={(e) => setAuthorizedSignatoryPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-name" className="text-sm">Partner Name</Label>
                <Input
                  id="partner-name"
                  data-testid="input-partner-name"
                  placeholder="As per PAN"
                  value={authorizedSignatoryName}
                  onChange={(e) => setAuthorizedSignatoryName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('type_detection')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('document_upload')}
            disabled={!entityName || !llpin}
            className="flex-1"
            data-testid="button-proceed-firm"
          >
            Continue to Document Upload
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderTrustDetailsStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <CardTitle>Trust / AOP / BOI Details</CardTitle>
        </div>
        <CardDescription>
          Enter your trust or association registration details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            {detectedPanType?.displayName} PAN detected: <span className="font-mono font-bold">{maskPanNumber(panNumber)}</span>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trust-name">Trust/Association Name</Label>
            <Input
              id="trust-name"
              data-testid="input-trust-name"
              placeholder="As per Trust Deed"
              value={trustName}
              onChange={(e) => setTrustName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="trust-reg">Registration Number</Label>
            <Input
              id="trust-reg"
              data-testid="input-trust-reg"
              placeholder="Trust registration number"
              value={trustRegistrationNumber}
              onChange={(e) => setTrustRegistrationNumber(e.target.value)}
            />
          </div>
          
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <Label className="font-medium">Trustee/Managing Person Details</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trustee-pan" className="text-sm">Trustee PAN</Label>
                <Input
                  id="trustee-pan"
                  data-testid="input-trustee-pan"
                  placeholder="Individual PAN"
                  value={authorizedSignatoryPan}
                  onChange={(e) => setAuthorizedSignatoryPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustee-name" className="text-sm">Trustee Name</Label>
                <Input
                  id="trustee-name"
                  data-testid="input-trustee-name"
                  placeholder="As per PAN"
                  value={authorizedSignatoryName}
                  onChange={(e) => setAuthorizedSignatoryName(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <Alert className="bg-orange-50 border-orange-200">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Trust accounts are restricted to Treasury products only and require admin approval.
            </AlertDescription>
          </Alert>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('type_detection')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('document_upload')}
            disabled={!trustName || !trustRegistrationNumber}
            className="flex-1"
            data-testid="button-proceed-trust"
          >
            Continue to Document Upload
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderDocumentUploadStep = () => {
    const getRequiredDocuments = () => {
      switch (detectedPanType?.entityType) {
        case 'company':
          return [
            { key: 'coi', name: 'Certificate of Incorporation', required: true },
            { key: 'board_resolution', name: 'Board Resolution', required: true },
            { key: 'moa', name: 'Memorandum of Association', required: false },
            { key: 'aoa', name: 'Articles of Association', required: false },
          ];
        case 'firm_llp':
          return [
            { key: 'partnership_deed', name: 'Partnership Deed / LLP Agreement', required: true },
            { key: 'llp_certificate', name: 'LLP Incorporation Certificate', required: true },
          ];
        case 'trust':
        case 'aop':
        case 'boi':
          return [
            { key: 'trust_deed', name: 'Trust Deed / Registration Certificate', required: true },
            { key: 'trustee_authorization', name: 'Trustee Authorization', required: true },
          ];
        default:
          return [];
      }
    };
    
    const docs = getRequiredDocuments();
    const allRequiredUploaded = docs.filter(d => d.required).every(d => uploadedDocuments[d.key]);
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            <CardTitle>Document Upload</CardTitle>
          </div>
          <CardDescription>
            Upload the required documents for verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {docs.map((doc) => (
              <div key={doc.key} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">
                    {doc.name}
                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {uploadedDocuments[doc.key] && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </div>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadedDocuments(prev => ({ ...prev, [doc.key]: file }));
                  }}
                  data-testid={`input-upload-${doc.key}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, or PNG (max 5MB)
                </p>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                switch (detectedPanType?.entityType) {
                  case 'company': setCurrentStep('corporate_details'); break;
                  case 'firm_llp': setCurrentStep('firm_llp_details'); break;
                  default: setCurrentStep('trust_details');
                }
              }}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep('bank_verification')}
              disabled={!allRequiredUploaded}
              className="flex-1"
              data-testid="button-proceed-docs"
            >
              Continue to Bank Verification
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const renderBankVerificationStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building className="h-6 w-6 text-primary" />
          <CardTitle>Bank Account Verification</CardTitle>
        </div>
        <CardDescription>
          Verify your entity's bank account for transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Bank account must be in the name of the {detectedPanType?.displayName}. 
            We'll perform a penny drop verification.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bank-account">Bank Account Number</Label>
            <Input
              id="bank-account"
              data-testid="input-bank-account"
              placeholder="Enter account number"
              value={hufBankAccount}
              onChange={(e) => setHufBankAccount(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ifsc">IFSC Code</Label>
            <Input
              id="ifsc"
              data-testid="input-ifsc"
              placeholder="ABCD0001234"
              className="uppercase font-mono"
            />
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('document_upload')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('treasury_setup')}
            disabled={!hufBankAccount}
            className="flex-1"
            data-testid="button-proceed-bank"
          >
            Continue to Treasury Setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderTreasurySetupStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <CardTitle>Treasury Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure treasury management settings for your entity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            {detectedPanType?.displayName} accounts are configured for Treasury products including 
            Liquid Funds, Debt Funds, and Short-term Bonds.
          </AlertDescription>
        </Alert>
        
        <div className="p-4 bg-muted rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Maker-Checker Approval</Label>
              <p className="text-sm text-muted-foreground">
                Require dual approval for all treasury transactions
              </p>
            </div>
            <Switch
              checked={makerCheckerEnabled}
              onCheckedChange={setMakerCheckerEnabled}
              data-testid="switch-maker-checker"
            />
          </div>
          
          {!makerCheckerEnabled && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Single approval mode: Transactions will execute immediately upon first approval.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">Available Products</h4>
          <div className="flex flex-wrap gap-2">
            {detectedPanType?.productsAllowed.map((product) => (
              <Badge key={product} variant="secondary" className="bg-green-100 text-green-800">
                {product}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('bank_verification')}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('completed')}
            className="flex-1"
            data-testid="button-complete-treasury"
          >
            Complete Onboarding
            <CheckCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderCompletedStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <CardTitle>
            {detectedPanType?.entityType === 'individual' 
              ? 'KYC Completed Successfully!' 
              : 'Onboarding Submitted for Approval'}
          </CardTitle>
        </div>
        <CardDescription>
          {detectedPanType?.entityType === 'individual'
            ? 'Your Smart KYC verification is now complete'
            : 'Your application has been submitted and is pending admin review'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {detectedPanType?.requiresApproval ? (
              <>
                <strong>Submission Received!</strong> Your {detectedPanType?.displayName} onboarding 
                is under review. You'll be notified once approved.
              </>
            ) : (
              <>
                <strong>Congratulations!</strong> Your account is now fully verified and you can 
                access all FintekPro services.
              </>
            )}
          </AlertDescription>
        </Alert>
        
        {v2TierInfo && (
          <div className="p-4 rounded-lg border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">KYC Tier</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{v2TierInfo.kycTier}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${v2TierInfo.tierStatus === 'final' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                  {v2TierInfo.tierStatus === 'final' ? 'Final' : 'Provisional'}
                </span>
              </div>
            </div>
            {v2TierInfo.productsUnlocked.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Products Unlocked</p>
                <div className="flex flex-wrap gap-1">
                  {v2TierInfo.productsUnlocked.map((p: string) => (
                    <span key={p} className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {v2TierInfo.upgradeActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">To Unlock More</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {v2TierInfo.upgradeActions.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="font-semibold">What's Next?</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {detectedPanType?.requiresApproval ? (
              <>
                <li>Admin will review your documents</li>
                <li>You'll receive email notification on approval</li>
                <li>Once approved, you can access Treasury products</li>
              </>
            ) : (
              <>
                <li>Explore investment products and portfolios</li>
                <li>Set up your investment preferences</li>
                <li>Connect your bank accounts</li>
                <li>Start building your wealth</li>
              </>
            )}
          </ul>
        </div>
        
        <Button
          data-testid="button-dashboard"
          onClick={() => window.location.href = '/'}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
  
  // Show loading state while session initializes (only for steps that need session)
  const needsSession = ['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'risk_profiling', 'compliance_signoff'].includes(currentStep);
  
  // ============================================================================
  // EDIT MODE UI - Regulatory-Compliant KYC Editing
  // ============================================================================
  if (isEditMode) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/kyc-dashboard'}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to KYC Dashboard
          </Button>
          <h1 className="text-3xl font-bold mb-2">Edit KYC Details</h1>
          <p className="text-muted-foreground">
            Update your profile information. Some fields are locked for regulatory compliance.
          </p>
        </div>

        {!editFieldRules ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading your profile...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Regulatory Notice */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Regulatory Compliance</AlertTitle>
              <AlertDescription>
                As per SEBI/RBI KYC guidelines, certain fields cannot be modified after verification. 
                Name and address changes require supporting documents for audit compliance.
              </AlertDescription>
            </Alert>

            {editErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Update Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {editErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {editWarnings.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Please Note</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {editWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Locked Fields Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Verified Information (Cannot be Changed)
                </CardTitle>
                <CardDescription>
                  These fields are locked because they have been verified. Contact support for corrections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">PAN Number</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={editFieldRules.currentValues?.panNumber || 'Not provided'} 
                        disabled 
                        className="bg-muted"
                      />
                      {editFieldRules.lockedFields?.includes('panNumber') && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                    </div>
                    {editFieldRules.lockReasons?.panNumber && (
                      <p className="text-xs text-muted-foreground mt-1">{editFieldRules.lockReasons.panNumber}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={editFieldRules.currentValues?.dateOfBirth || 'Not provided'} 
                        disabled 
                        className="bg-muted"
                      />
                      {editFieldRules.lockedFields?.includes('dateOfBirth') && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Required Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Personal Information (Document Proof Required)
                </CardTitle>
                <CardDescription>
                  Changes to name or address require supporting documents (e.g., Gazette notification, utility bill).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName"
                      value={editFormData.firstName || ''} 
                      onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input 
                      id="middleName"
                      value={editFormData.middleName || ''} 
                      onChange={(e) => setEditFormData({...editFormData, middleName: e.target.value})}
                      placeholder="Enter middle name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName"
                      value={editFormData.lastName || ''} 
                      onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nameChangeReason">Reason for Name Change (if applicable)</Label>
                  <Input 
                    id="nameChangeReason"
                    value={editFormData.nameChangeReason || ''} 
                    onChange={(e) => setEditFormData({...editFormData, nameChangeReason: e.target.value})}
                    placeholder="e.g., Marriage, Legal name change"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address"
                    value={editFormData.address || ''} 
                    onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                    placeholder="Enter full address"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city"
                      value={editFormData.city || ''} 
                      onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input 
                      id="state"
                      value={editFormData.state || ''} 
                      onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                      placeholder="Enter state"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input 
                      id="pincode"
                      value={editFormData.pincode || ''} 
                      onChange={(e) => setEditFormData({...editFormData, pincode: e.target.value})}
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Freely Editable Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pen className="h-5 w-5 text-green-500" />
                  Additional Information (Freely Editable)
                </CardTitle>
                <CardDescription>
                  These fields can be updated anytime without additional verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Select 
                      value={editFormData.occupation || ''} 
                      onValueChange={(val) => setEditFormData({...editFormData, occupation: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select occupation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaried">Salaried</SelectItem>
                        <SelectItem value="self_employed">Self Employed</SelectItem>
                        <SelectItem value="business">Business Owner</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="homemaker">Homemaker</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="annualIncome">Annual Income</Label>
                    <Select 
                      value={editFormData.annualIncome || ''} 
                      onValueChange={(val) => setEditFormData({...editFormData, annualIncome: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select income range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below_5l">Below ₹5 Lakhs</SelectItem>
                        <SelectItem value="5l_10l">₹5 - 10 Lakhs</SelectItem>
                        <SelectItem value="10l_25l">₹10 - 25 Lakhs</SelectItem>
                        <SelectItem value="25l_50l">₹25 - 50 Lakhs</SelectItem>
                        <SelectItem value="50l_1cr">₹50 Lakhs - 1 Crore</SelectItem>
                        <SelectItem value="above_1cr">Above ₹1 Crore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <Select 
                      value={editFormData.maritalStatus || ''} 
                      onValueChange={(val) => setEditFormData({...editFormData, maritalStatus: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="investmentExperience">Investment Experience</Label>
                    <Select 
                      value={editFormData.investmentExperience || ''} 
                      onValueChange={(val) => setEditFormData({...editFormData, investmentExperience: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Experience</SelectItem>
                        <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                        <SelectItem value="experienced">Experienced (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sourceOfFunds">Source of Funds</Label>
                  <Select 
                    value={editFormData.sourceOfFunds || ''} 
                    onValueChange={(val) => setEditFormData({...editFormData, sourceOfFunds: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary/Employment Income</SelectItem>
                      <SelectItem value="business">Business Income</SelectItem>
                      <SelectItem value="investments">Investment Returns</SelectItem>
                      <SelectItem value="inheritance">Inheritance</SelectItem>
                      <SelectItem value="pension">Pension</SelectItem>
                      <SelectItem value="rental">Rental Income</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* OTP-Required Fields Section (Email/Mobile) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  Contact Information (OTP Verification Required)
                </CardTitle>
                <CardDescription>
                  Changes to email or mobile require OTP verification for security.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        id="email"
                        type="email"
                        value={editFormData.email || ''} 
                        onChange={(e) => {
                          setEditFormData({...editFormData, email: e.target.value});
                          if (e.target.value !== editFieldRules?.currentValues?.email) {
                            setEditOtpVerified({...editOtpVerified, email: false});
                          }
                        }}
                        placeholder="Enter email"
                        className={editOtpVerified.email ? 'border-green-500' : ''}
                      />
                      {editFormData.email && editFormData.email !== editFieldRules?.currentValues?.email && (
                        editOtpVerified.email ? (
                          <Badge variant="default" className="bg-green-500 whitespace-nowrap">Verified</Badge>
                        ) : (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            disabled={editOtpSending}
                            onClick={async () => {
                              setEditOtpSending(true);
                              try {
                                const res = await fetch('/api/kyc/profile-change/send-otp', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ type: 'email', newValue: editFormData.email })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setEditOtpType('email');
                                  setEditOtpValue(editFormData.email || '');
                                  setEditOtpSent(true);
                                  toast({ title: "OTP Sent", description: "Check your email for the verification code" });
                                } else {
                                  toast({ title: "Error", description: data.message, variant: "destructive" });
                                }
                              } catch (err) {
                                toast({ title: "Error", description: "Failed to send OTP", variant: "destructive" });
                              }
                              setEditOtpSending(false);
                            }}
                          >
                            {editOtpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        id="mobile"
                        type="tel"
                        value={editFormData.mobile || ''} 
                        onChange={(e) => {
                          setEditFormData({...editFormData, mobile: e.target.value});
                          if (e.target.value !== editFieldRules?.currentValues?.mobile) {
                            setEditOtpVerified({...editOtpVerified, mobile: false});
                          }
                        }}
                        placeholder="Enter 10-digit mobile"
                        className={editOtpVerified.mobile ? 'border-green-500' : ''}
                      />
                      {editFormData.mobile && editFormData.mobile !== editFieldRules?.currentValues?.mobile && (
                        editOtpVerified.mobile ? (
                          <Badge variant="default" className="bg-green-500 whitespace-nowrap">Verified</Badge>
                        ) : (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            disabled={editOtpSending}
                            onClick={async () => {
                              setEditOtpSending(true);
                              try {
                                const res = await fetch('/api/kyc/profile-change/send-otp', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ type: 'mobile', newValue: editFormData.mobile })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setEditOtpType('mobile');
                                  setEditOtpValue(editFormData.mobile || '');
                                  setEditOtpSent(true);
                                  toast({ title: "OTP Sent", description: "Check your mobile for the verification code" });
                                } else {
                                  toast({ title: "Error", description: data.message, variant: "destructive" });
                                }
                              } catch (err) {
                                toast({ title: "Error", description: "Failed to send OTP", variant: "destructive" });
                              }
                              setEditOtpSending(false);
                            }}
                          >
                            {editOtpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
                
                {/* OTP Input Dialog */}
                {editOtpSent && editOtpType && !editOtpVerified[editOtpType] && (
                  <Alert className="mt-4">
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Enter OTP sent to your {editOtpType}</AlertTitle>
                    <AlertDescription>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          value={editOtpInput}
                          onChange={(e) => setEditOtpInput(e.target.value)}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className="max-w-[150px]"
                        />
                        <Button
                          size="sm"
                          disabled={editOtpVerifying || editOtpInput.length !== 6}
                          onClick={async () => {
                            setEditOtpVerifying(true);
                            try {
                              const res = await fetch('/api/kyc/profile-change/verify-otp', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ type: editOtpType, otp: editOtpInput })
                              });
                              const data = await res.json();
                              if (data.success) {
                                setEditOtpVerified({...editOtpVerified, [editOtpType!]: true});
                                setEditOtpSessionId({...editOtpSessionId, [editOtpType!]: data.otpSessionId});
                                setEditOtpSent(false);
                                setEditOtpInput('');
                                toast({ title: "Verified", description: `${editOtpType} verified successfully` });
                              } else {
                                toast({ title: "Invalid OTP", description: data.message, variant: "destructive" });
                              }
                            } catch (err) {
                              toast({ title: "Error", description: "Failed to verify OTP", variant: "destructive" });
                            }
                            setEditOtpVerifying(false);
                          }}
                        >
                          {editOtpVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify OTP'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditOtpSent(false);
                            setEditOtpInput('');
                            setEditOtpType(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Document Upload Section (appears when name/address is changed) */}
            {((editFormData.firstName !== editFieldRules?.currentValues?.firstName) ||
              (editFormData.lastName !== editFieldRules?.currentValues?.lastName) ||
              (editFormData.address !== editFieldRules?.currentValues?.address) ||
              (editFormData.city !== editFieldRules?.currentValues?.city) ||
              (editFormData.pincode !== editFieldRules?.currentValues?.pincode)) && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-amber-600" />
                    Supporting Documents Required
                  </CardTitle>
                  <CardDescription>
                    As per SEBI/RBI regulations, name or address changes require supporting documents.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Document Type</Label>
                      <Select 
                        value={editDocumentType} 
                        onValueChange={setEditDocumentType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gazette_notification">Gazette Notification (Name Change)</SelectItem>
                          <SelectItem value="marriage_certificate">Marriage Certificate</SelectItem>
                          <SelectItem value="utility_bill">Utility Bill (Address Proof)</SelectItem>
                          <SelectItem value="bank_statement">Bank Statement (Address Proof)</SelectItem>
                          <SelectItem value="aadhaar_card">Aadhaar Card</SelectItem>
                          <SelectItem value="passport">Passport</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!editDocumentType || editDocumentUploading}
                        onClick={async () => {
                          setEditDocumentUploading(true);
                          try {
                            const changeType = editFormData.firstName !== editFieldRules?.currentValues?.firstName ||
                                              editFormData.lastName !== editFieldRules?.currentValues?.lastName
                              ? 'name' : 'address';
                            const res = await fetch('/api/kyc/profile-change/upload-document', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                documentType: editDocumentType,
                                documentName: editDocumentType.replace(/_/g, ' '),
                                changeType
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setEditDocuments([...editDocuments, {
                                id: data.documentId,
                                type: editDocumentType,
                                name: editDocumentType.replace(/_/g, ' ')
                              }]);
                              setEditDocumentType('');
                              toast({ title: "Document Uploaded", description: "Supporting document added successfully" });
                            } else {
                              toast({ title: "Error", description: data.message, variant: "destructive" });
                            }
                          } catch (err) {
                            toast({ title: "Error", description: "Failed to upload document", variant: "destructive" });
                          }
                          setEditDocumentUploading(false);
                        }}
                      >
                        {editDocumentUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Add Document
                      </Button>
                    </div>
                  </div>
                  
                  {/* Uploaded documents list */}
                  {editDocuments.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-sm text-muted-foreground">Uploaded Documents:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editDocuments.map((doc, i) => (
                          <Badge key={i} variant="secondary" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {doc.name}
                            <CheckCircle className="h-3 w-3 text-green-500 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {editDocuments.length === 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You must upload at least one supporting document before saving changes.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/kyc-dashboard'}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Validate before submit
                  const errors: string[] = [];
                  
                  // Check OTP verification for email/mobile changes
                  if (editFormData.email && editFormData.email !== editFieldRules?.currentValues?.email && !editOtpVerified.email) {
                    errors.push('Please verify your new email address with OTP');
                  }
                  if (editFormData.mobile && editFormData.mobile !== editFieldRules?.currentValues?.mobile && !editOtpVerified.mobile) {
                    errors.push('Please verify your new mobile number with OTP');
                  }
                  
                  // Check document upload for name/address changes
                  const hasNameChange = editFormData.firstName !== editFieldRules?.currentValues?.firstName ||
                                       editFormData.lastName !== editFieldRules?.currentValues?.lastName;
                  const hasAddressChange = editFormData.address !== editFieldRules?.currentValues?.address ||
                                          editFormData.city !== editFieldRules?.currentValues?.city ||
                                          editFormData.pincode !== editFieldRules?.currentValues?.pincode;
                  
                  if ((hasNameChange || hasAddressChange) && editDocuments.length === 0) {
                    errors.push('Please upload supporting documents for name/address changes');
                  }
                  
                  if (errors.length > 0) {
                    setEditErrors(errors);
                    toast({ title: "Validation Required", description: errors[0], variant: "destructive" });
                    return;
                  }
                  
                  // Include OTP session IDs in the submission
                  const submitData = {
                    ...editFormData,
                    otpVerified: editOtpVerified.email || editOtpVerified.mobile,
                    otpSessionId: editOtpSessionId.email || editOtpSessionId.mobile,
                    documentIds: editDocuments.map(d => d.id)
                  };
                  
                  editKycMutation.mutate(submitData);
                }}
                disabled={editKycMutation.isPending}
              >
                {editKycMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (needsSession && startSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing KYC session...</p>
      </div>
    );
  }
  
  // Show error state if session failed to initialize
  if (needsSession && sessionError && !startSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {sessionError}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => startSessionMutation.mutate(false)}
          data-testid="button-retry-session"
        >
          Retry
        </Button>
      </div>
    );
  }
  
  // Show loading if session hasn't been created yet (only for steps that need session)
  if (needsSession && !sessionId && !sessionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing KYC session...</p>
      </div>
    );
  }
  
  const getCurrentStepNumber = () => {
    const steps = getStepsForEntityType();
    return steps.indexOf(currentStep) + 1;
  };
  
  const getTotalSteps = () => {
    return getStepsForEntityType().length;
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Resume Session Dialog */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume KYC Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an incomplete KYC session from earlier. Would you like to continue where you left off or start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartFresh}>
              Start Fresh
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeSession}>
              Resume Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {currentStep !== 'pan_entry' && (
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {detectedPanType ? `${detectedPanType.displayName} Onboarding` : 'Smart KYC Onboarding'}
                </h1>
                <p className="text-muted-foreground">
                  {detectedPanType 
                    ? `Complete your ${detectedPanType.displayName} verification`
                    : 'Complete your KYC verification in just a few simple steps'
                  }
                </p>
              </div>
              {detectedPanType && (
                <Badge variant="outline" className="text-sm">
                  {getEntityIcon(detectedPanType.entityType)}
                  <span className="ml-2">{detectedPanType.displayName}</span>
                </Badge>
              )}
            </div>
          </div>
          
          <div className="mb-8">
            <Progress value={getStepProgress()} className="h-2" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Step {getCurrentStepNumber()} of {getTotalSteps()}</span>
              <span>{Math.round(getStepProgress())}% Complete</span>
            </div>
          </div>
        </>
      )}
      
      {renderSessionTimer()}
      {renderAssistedBanner()}
      
      {currentStep === 'pan_entry' && renderPanEntryStep()}
      {currentStep === 'type_detection' && renderTypeDetectionStep()}
      {currentStep === 'pan_verification' && renderPanVerificationStep()}
      {currentStep === 'ckyc_kra_check' && renderCkycKraCheckStep()}
      {currentStep === 'aadhaar_otp' && renderAadhaarOtpStep()}
      {currentStep === 'aadhaar_verification' && renderAadhaarVerificationStep()}
      {currentStep === 'data_collection' && renderDataCollectionStep()}
      {currentStep === 'risk_profiling' && renderRiskProfilingStep()}
      {currentStep === 'compliance_signoff' && renderComplianceSignoffStep()}
      {currentStep === 'huf_details' && renderHufDetailsStep()}
      {currentStep === 'corporate_details' && renderCorporateDetailsStep()}
      {currentStep === 'firm_llp_details' && renderFirmLlpDetailsStep()}
      {currentStep === 'trust_details' && renderTrustDetailsStep()}
      {currentStep === 'document_upload' && renderDocumentUploadStep()}
      {currentStep === 'bank_verification' && renderBankVerificationStep()}
      {currentStep === 'treasury_setup' && renderTreasurySetupStep()}
      {currentStep === 'completed' && renderCompletedStep()}
    </div>
  );
}
