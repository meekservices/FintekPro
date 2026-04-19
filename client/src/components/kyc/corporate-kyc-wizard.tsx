import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Loader2, ArrowRight, ArrowLeft, Building2, FileText, User, Landmark, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepProps {
  data: any;
  onChange: (field: string, value: any) => void;
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const steps = [
  { id: 1, name: "Corporate PAN", icon: Building2, description: "Company verification" },
  { id: 2, name: "Company Documents", icon: FileText, description: "Legal documents" },
  { id: 3, name: "Authorized Signatory", icon: User, description: "Signatory verification" },
  { id: 4, name: "Account Discovery", icon: Landmark, description: "Bank & Demat accounts" },
  { id: 5, name: "Review & Submit", icon: Eye, description: "Final review" }
];

// Step 1: Corporate PAN Verification
function CorporatePANStep({ data, onChange, onNext, isFirst }: StepProps) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyPAN = useMutation({
    mutationFn: async (params: { pan: string; companyName: string }) => {
      const response = await apiRequest("POST", "/api/kyc/corporate/verify-pan", {
        body: { pan: params.pan, companyName: params.companyName }
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        onChange("companyName", result.companyName);
        onChange("companyType", result.companyType);
        onChange("panVerified", true);
        toast({
          title: "✅ Corporate PAN Verified",
          description: `Company: ${result.companyName}`,
        });
      } else {
        onChange("panVerified", false);
        toast({
          title: "Verification Failed",
          description: result.message || "Corporate PAN verification failed",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      onChange("panVerified", false);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid Corporate PAN",
        variant: "destructive"
      });
    }
  });

  const handleVerifyPAN = () => {
    if (data.corporatePan?.length === 10 && data.companyName) {
      verifyPAN.mutate({ pan: data.corporatePan, companyName: data.companyName });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name (as per PAN) *</Label>
          <Input
            id="companyName"
            data-testid="input-company-name"
            placeholder="Enter company name"
            value={data.companyName || ""}
            onChange={(e) => onChange("companyName", e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter the company name exactly as it appears on the PAN card
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="corporatePan">Corporate PAN Number *</Label>
          <div className="flex gap-2">
            <Input
              id="corporatePan"
              data-testid="input-corporate-pan"
              placeholder="ABCDE1234F"
              value={data.corporatePan || ""}
              onChange={(e) => onChange("corporatePan", e.target.value.toUpperCase())}
              maxLength={10}
              className="uppercase"
            />
            <Button
              type="button"
              onClick={handleVerifyPAN}
              disabled={!data.corporatePan || data.corporatePan.length !== 10 || !data.companyName || verifyPAN.isPending}
              data-testid="button-verify-pan"
            >
              {verifyPAN.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </div>

        {data.panVerified && (
          <>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={data.companyName || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Company Type</Label>
              <Input value={data.companyType || ""} disabled />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!data.panVerified} data-testid="button-next">
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 2: Company Documents Upload
function CompanyDocumentsStep({ data, onChange, onNext, onBack }: StepProps) {
  const { toast } = useToast();
  
  const uploadDocument = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/corporate/documents", {
        body: {
          coiUrl: data.coiUrl,
          moaUrl: data.moaUrl,
          aoaUrl: data.aoaUrl,
          boardResolutionUrl: data.boardResolutionUrl
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Documents Uploaded Successfully" });
      onNext();
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coi">Certificate of Incorporation *</Label>
          <Input
            id="coi"
            type="file"
            onChange={(e) => onChange("coiUrl", e.target.files?.[0])}
            data-testid="input-coi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moa">Memorandum of Association *</Label>
          <Input
            id="moa"
            type="file"
            onChange={(e) => onChange("moaUrl", e.target.files?.[0])}
            data-testid="input-moa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aoa">Articles of Association *</Label>
          <Input
            id="aoa"
            type="file"
            onChange={(e) => onChange("aoaUrl", e.target.files?.[0])}
            data-testid="input-aoa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="boardResolution">Board Resolution *</Label>
          <Input
            id="boardResolution"
            type="file"
            onChange={(e) => onChange("boardResolutionUrl", e.target.files?.[0])}
            data-testid="input-board-resolution"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={() => uploadDocument.mutate()}
          disabled={!data.coiUrl || !data.moaUrl || !data.aoaUrl || !data.boardResolutionUrl}
          data-testid="button-next"
        >
          {uploadDocument.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 3: Authorized Signatory Verification
function SignatoryVerificationStep({ data, onChange, onNext, onBack }: StepProps) {
  const { toast } = useToast();
  
  const verifySignatory = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/corporate/verify-signatory", {
        body: {
          name: data.signatoryName,
          designation: data.signatoryDesignation,
          digilockerSessionId: data.digilockerSessionId,
          aadhaarData: data.aadhaarData
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Signatory Verified Successfully" });
      onNext();
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signatoryName">Authorized Signatory Name *</Label>
          <Input
            id="signatoryName"
            value={data.signatoryName || ""}
            onChange={(e) => onChange("signatoryName", e.target.value)}
            data-testid="input-signatory-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signatoryDesignation">Designation *</Label>
          <Select value={data.signatoryDesignation || ""} onValueChange={(value) => onChange("signatoryDesignation", value)}>
            <SelectTrigger data-testid="select-designation">
              <SelectValue placeholder="Select designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Director">Director</SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
              <SelectItem value="Authorized Signatory">Authorized Signatory</SelectItem>
              <SelectItem value="CEO">CEO</SelectItem>
              <SelectItem value="CFO">CFO</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            DigiLocker verification required for Aadhaar authentication
          </p>
          <Button className="mt-3" variant="outline" size="sm">
            Launch DigiLocker
          </Button>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={() => verifySignatory.mutate()}
          disabled={!data.signatoryName || !data.signatoryDesignation}
          data-testid="button-next"
        >
          {verifySignatory.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 4: Account Discovery
function AccountDiscoveryStep({ data, onChange, onNext, onBack }: StepProps) {
  const { toast } = useToast();
  
  const discoverAccounts = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/corporate/discover-accounts", {
        body: { pan: data.corporatePan }
      });
      return response.json();
    },
    onSuccess: (result) => {
      onChange("discoveredAccounts", result.accounts);
      toast({ title: `✅ Found ${result.bankAccountsFound} bank accounts and ${result.dematAccountsFound} demat accounts` });
      onNext();
    },
    onError: (error: any) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We'll search for corporate bank and demat accounts linked to your PAN number
        </p>
        <Button onClick={() => discoverAccounts.mutate()} className="w-full" data-testid="button-discover">
          {discoverAccounts.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            "Discover Accounts"
          )}
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}

// Step 5: Review & Confirmation
function ReviewStep({ data, onBack }: StepProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const confirmKYC = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/corporate/confirm", {
        body: data
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "🎉 Corporate KYC Completed Successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Information</CardTitle>
          <CardDescription>Please verify all details before submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Corporate PAN</Label>
            <p className="font-medium">{data.corporatePan}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Company Name</Label>
            <p className="font-medium">{data.companyName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Authorized Signatory</Label>
            <p className="font-medium">{data.signatoryName} - {data.signatoryDesignation}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={() => confirmKYC.mutate()} disabled={confirmKYC.isPending} data-testid="button-submit">
          {confirmKYC.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Submit KYC
        </Button>
      </div>
    </div>
  );
}

export function CorporateKYCWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const queryClient = useQueryClient();

  // Load progress on mount
  const progressQuery = useQuery({
    queryKey: ["/api/kyc/corporate/progress"],
  });
  const progress: any = progressQuery.data;

  useEffect(() => {
    if (progress && !progress.isCompleted) {
      setCurrentStep(progress.currentStep || 1);
      setFormData(progress);
    }
  }, [progress]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const stepProps: StepProps = {
    data: formData,
    onChange: handleChange,
    onNext: handleNext,
    onBack: handleBack,
    isFirst: currentStep === 1,
    isLast: currentStep === steps.length
  };

  const currentStepComponent = () => {
    switch (currentStep) {
      case 1: return <CorporatePANStep {...stepProps} />;
      case 2: return <CompanyDocumentsStep {...stepProps} />;
      case 3: return <SignatoryVerificationStep {...stepProps} />;
      case 4: return <AccountDiscoveryStep {...stepProps} />;
      case 5: return <ReviewStep {...stepProps} />;
      default: return null;
    }
  };

  const progressPercentage = (currentStep / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Corporate KYC</h2>
        <p className="text-muted-foreground">Complete your company verification</p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep} of {steps.length}</span>
          <span>{Math.round(progressPercentage)}% Complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Steps Indicator */}
      <div className="flex justify-between">
        {steps.map((step) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                isCompleted ? "bg-primary border-primary text-primary-foreground" :
                isActive ? "border-primary text-primary" :
                "border-muted text-muted-foreground"
              )}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
              </div>
              <div className="text-xs text-center max-w-[80px]">
                <div className={cn("font-medium", isActive && "text-primary")}>{step.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Step Component */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].name}</CardTitle>
          <CardDescription>{steps[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStepComponent()}
        </CardContent>
      </Card>
    </div>
  );
}
