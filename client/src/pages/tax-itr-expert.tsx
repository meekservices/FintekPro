import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  CheckCircle,
  Clock,
  Users,
  LucideShield as LucideShield,
  Star,
  IndianRupee,
  AlertTriangle,
  Briefcase,
  Home,
  TrendingUp,
  Building2,
  Receipt,
  Wallet,
  UserCheck,
  FileCheck,
  MessageSquare,
  Calendar,
  Phone,
  Mail,
  HelpCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri";

interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
}

interface IncomeSource {
  hasSalary: boolean;
  hasHouseProperty: boolean;
  hasCapitalGains: boolean;
  hasBusinessIncome: boolean;
  hasForeignIncome: boolean;
  hasOtherIncome: boolean;
}

interface ExpertCase {
  id?: string;
  assessmentYear: string;
  incomeSources: IncomeSource;
  estimatedIncome: string;
  specialCircumstances: string;
  preferredExpertType: "ca" | "tax_expert" | "any";
  urgency: "normal" | "priority" | "urgent";
  documents: string[];
  status: "draft" | "submitted" | "assigned" | "in_progress" | "review" | "completed";
}

const ASSESSMENT_YEARS = ["2025-26", "2024-25", "2023-24"];

const REQUIRED_DOCUMENTS = [
  { id: "form16", name: "Form 16", desc: "TDS certificate from employer", forSources: ["hasSalary"] },
  { id: "form16a", name: "Form 16A", desc: "TDS on other income", forSources: ["hasOtherIncome"] },
  { id: "form26as", name: "Form 26AS", desc: "Annual tax statement", forSources: ["all"] },
  { id: "ais", name: "AIS", desc: "Annual Information Statement", forSources: ["all"] },
  { id: "bankStatements", name: "Bank Statements", desc: "Last 12 months", forSources: ["all"] },
  { id: "capitalGains", name: "Capital Gains Statement", desc: "From broker/demat", forSources: ["hasCapitalGains"] },
  { id: "rentalAgreement", name: "Rental Agreement", desc: "Property rental docs", forSources: ["hasHouseProperty"] },
  { id: "businessBooks", name: "Books of Accounts", desc: "P&L, Balance Sheet", forSources: ["hasBusinessIncome"] },
  { id: "foreignIncome", name: "Foreign Income Proof", desc: "DTAA certificates", forSources: ["hasForeignIncome"] },
  { id: "investments", name: "Investment Proofs", desc: "80C, 80D, etc.", forSources: ["all"] }
];

const EXPERT_PRICING: Record<string, { base: number; priority: number; urgent: number }> = {
  "ITR-1": { base: 999, priority: 1499, urgent: 1999 },
  "ITR-2": { base: 2499, priority: 3499, urgent: 4499 },
  "ITR-3": { base: 4999, priority: 6999, urgent: 8999 },
  "ITR-4": { base: 1999, priority: 2999, urgent: 3999 },
  "ITR-5": { base: 7999, priority: 9999, urgent: 12999 },
  "ITR-6": { base: 14999, priority: 19999, urgent: 24999 },
  "ITR-7": { base: 9999, priority: 14999, urgent: 19999 }
};

const STEPS = [
  { id: "income", label: "Income Sources", icon: Briefcase },
  { id: "details", label: "Case Details", icon: FileText },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "expert", label: "Expert Selection", icon: Users },
  { id: "review", label: "Review & Submit", icon: CheckCircle }
];

export default function TaxITRExpertPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [assessmentYear, setAssessmentYear] = useState("2025-26");
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  
  const [incomeSources, setIncomeSources] = useState<IncomeSource>({
    hasSalary: false,
    hasHouseProperty: false,
    hasCapitalGains: false,
    hasBusinessIncome: false,
    hasForeignIncome: false,
    hasOtherIncome: false
  });
  
  const [caseDetails, setCaseDetails] = useState({
    estimatedIncome: "",
    specialCircumstances: "",
    contactPhone: "",
    preferredTime: "anytime"
  });
  
  const [expertPrefs, setExpertPrefs] = useState({
    preferredExpertType: "any" as "ca" | "tax_expert" | "any",
    urgency: "normal" as "normal" | "priority" | "urgent"
  });

  const { data: panContext, isLoading: panLoading } = useQuery<PANContext>({
    queryKey: ["/api/tax/pan-context"],
    enabled: isAuthenticated
  });

  const submitCaseMutation = useMutation({
    mutationFn: async (caseData: ExpertCase) => {
      return await apiRequest("/api/tax/expert-cases", {
        method: "POST",
        body: JSON.stringify(caseData)
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Case Submitted Successfully",
        description: `Your case #${data.id || "EXP-" + Date.now()} has been created. Our team will contact you shortly.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/expert-cases"] });
      navigate("/tax/itr");
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Unable to submit your case. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getRecommendedForm = (): string => {
    const panType = panContext?.panType || "individual";
    
    if (panType === "company") return "ITR-6";
    if (panType === "firm") return "ITR-5";
    if (panType === "trust") return "ITR-7";
    
    if (incomeSources.hasBusinessIncome) return "ITR-3";
    if (incomeSources.hasCapitalGains || incomeSources.hasForeignIncome) return "ITR-2";
    if (incomeSources.hasHouseProperty) return "ITR-2";
    return "ITR-1";
  };

  const getRequiredDocs = () => {
    return REQUIRED_DOCUMENTS.filter(doc => {
      if (doc.forSources.includes("all")) return true;
      return doc.forSources.some(source => incomeSources[source as keyof IncomeSource]);
    });
  };

  const calculatePrice = () => {
    const form = getRecommendedForm();
    const pricing = EXPERT_PRICING[form] || EXPERT_PRICING["ITR-1"];
    
    switch (expertPrefs.urgency) {
      case "priority": return pricing.priority;
      case "urgent": return pricing.urgent;
      default: return pricing.base;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const caseData = {
      assessmentYear,
      incomeSources,
      estimatedIncome: caseDetails.estimatedIncome,
      specialCircumstances: caseDetails.specialCircumstances,
      contactPhone: caseDetails.contactPhone,
      preferredTime: caseDetails.preferredTime,
      preferredExpertType: expertPrefs.preferredExpertType,
      urgency: expertPrefs.urgency,
      documents: uploadedDocs,
      status: "submitted" as const
    };
    
    submitCaseMutation.mutate(caseData as ExpertCase);
  };

  const toggleDocument = (docId: string) => {
    setUploadedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(d => d !== docId)
        : [...prev, docId]
    );
  };

  const renderIncomeSourcesStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Your Income Sources</h3>
        <p className="text-muted-foreground text-sm">
          This helps us determine the right ITR form and assign the appropriate expert.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "hasSalary", label: "Salary Income", icon: Briefcase, desc: "Income from employment" },
          { key: "hasHouseProperty", label: "House Property", icon: Home, desc: "Rental income or home loan interest" },
          { key: "hasCapitalGains", label: "Capital Gains", icon: TrendingUp, desc: "Stocks, mutual funds, property sale" },
          { key: "hasBusinessIncome", label: "Business/Profession", icon: Building2, desc: "Self-employed or business income" },
          { key: "hasForeignIncome", label: "Foreign Income", icon: Receipt, desc: "Income from outside India" },
          { key: "hasOtherIncome", label: "Other Sources", icon: Wallet, desc: "Interest, dividends, etc." }
        ].map(source => {
          const Icon = source.icon;
          const isChecked = incomeSources[source.key as keyof IncomeSource];
          return (
            <Card 
              key={source.key}
              className={`cursor-pointer transition-all ${isChecked ? "border-primary ring-2 ring-primary/20" : "hover:border-border dark:hover:border-border"}`}
              onClick={() => setIncomeSources(prev => ({ ...prev, [source.key]: !prev[source.key as keyof IncomeSource] }))}
              data-testid={`card-${source.key}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isChecked ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{source.label}</p>
                  <p className="text-sm text-muted-foreground">{source.desc}</p>
                </div>
                <Checkbox checked={isChecked} className="mt-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-medium">Recommended Form: {getRecommendedForm()}</p>
            <p className="text-sm text-muted-foreground">Based on your income sources</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCaseDetailsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Case Details</h3>
        <p className="text-muted-foreground text-sm">
          Provide additional details to help our experts prepare your return accurately.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Assessment Year</Label>
          <RadioGroup 
            value={assessmentYear} 
            onValueChange={setAssessmentYear}
            className="flex gap-4 mt-2"
          >
            {ASSESSMENT_YEARS.map(ay => (
              <div key={ay} className="flex items-center space-x-2">
                <RadioGroupItem value={ay} id={`ay-${ay}`} />
                <Label htmlFor={`ay-${ay}`} className="cursor-pointer">{ay}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="estimatedIncome">Estimated Annual Income (Optional)</Label>
          <div className="relative mt-1">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="estimatedIncome"
              className="pl-9"
              placeholder="e.g., 15,00,000"
              value={caseDetails.estimatedIncome}
              onChange={(e) => setCaseDetails(prev => ({ ...prev, estimatedIncome: e.target.value }))}
              data-testid="input-estimated-income"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="specialCircumstances">Special Circumstances or Notes</Label>
          <Textarea 
            id="specialCircumstances"
            className="mt-1"
            placeholder="Any special situations our expert should know about (e.g., changed jobs, sold property, received inheritance, etc.)"
            rows={4}
            value={caseDetails.specialCircumstances}
            onChange={(e) => setCaseDetails(prev => ({ ...prev, specialCircumstances: e.target.value }))}
            data-testid="textarea-special-circumstances"
          />
        </div>

        <div>
          <Label htmlFor="contactPhone">Contact Phone</Label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="contactPhone"
              className="pl-9"
              placeholder="+91 98765 43210"
              value={caseDetails.contactPhone}
              onChange={(e) => setCaseDetails(prev => ({ ...prev, contactPhone: e.target.value }))}
              data-testid="input-contact-phone"
            />
          </div>
        </div>

        <div>
          <Label>Preferred Contact Time</Label>
          <RadioGroup 
            value={caseDetails.preferredTime} 
            onValueChange={(v) => setCaseDetails(prev => ({ ...prev, preferredTime: v }))}
            className="flex flex-wrap gap-4 mt-2"
          >
            {[
              { value: "morning", label: "Morning (9-12)" },
              { value: "afternoon", label: "Afternoon (12-5)" },
              { value: "evening", label: "Evening (5-8)" },
              { value: "anytime", label: "Anytime" }
            ].map(time => (
              <div key={time.value} className="flex items-center space-x-2">
                <RadioGroupItem value={time.value} id={`time-${time.value}`} />
                <Label htmlFor={`time-${time.value}`} className="cursor-pointer">{time.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderDocumentsStep = () => {
    const requiredDocs = getRequiredDocs();
    const uploadProgress = (uploadedDocs.length / requiredDocs.length) * 100;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
          <p className="text-muted-foreground text-sm">
            Upload the required documents for your return. You can also upload later.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Progress value={uploadProgress} className="flex-1" />
          <span className="text-sm font-medium">{uploadedDocs.length}/{requiredDocs.length}</span>
        </div>

        <div className="space-y-3">
          {requiredDocs.map(doc => {
            const isUploaded = uploadedDocs.includes(doc.id);
            return (
              <Card 
                key={doc.id}
                className={`cursor-pointer transition-all ${isUploaded ? "border-green-500 bg-green-50 dark:bg-green-950" : "hover:border-border dark:hover:border-border"}`}
                onClick={() => toggleDocument(doc.id)}
                data-testid={`doc-${doc.id}`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isUploaded ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                    {isUploaded ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-muted-foreground">{doc.desc}</p>
                  </div>
                  <Button 
                    variant={isUploaded ? "outline" : "default"} 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); toggleDocument(doc.id); }}
                  >
                    {isUploaded ? "Remove" : "Upload"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You can upload documents now or later. Our expert will request any missing documents.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderExpertSelectionStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Your Expert</h3>
        <p className="text-muted-foreground text-sm">
          Select the type of expert and service level that suits your needs.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Expert Type</Label>
          <RadioGroup 
            value={expertPrefs.preferredExpertType} 
            onValueChange={(v) => setExpertPrefs(prev => ({ ...prev, preferredExpertType: v as any }))}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3"
          >
            {[
              { value: "ca", label: "Chartered Accountant", desc: "ICAI registered CA", icon: UserCheck, badge: "Premium" },
              { value: "tax_expert", label: "Tax Expert", desc: "Certified tax professional", icon: FileCheck, badge: "Standard" },
              { value: "any", label: "Auto-Assign", desc: "Best available expert", icon: Users, badge: "Recommended" }
            ].map(opt => (
              <Card 
                key={opt.value}
                className={`cursor-pointer transition-all ${expertPrefs.preferredExpertType === opt.value ? "border-primary ring-2 ring-primary/20" : "hover:border-border dark:hover:border-border"}`}
                onClick={() => setExpertPrefs(prev => ({ ...prev, preferredExpertType: opt.value as any }))}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <opt.icon className={`h-8 w-8 ${expertPrefs.preferredExpertType === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  <Badge variant="secondary" className="mt-2">{opt.badge}</Badge>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div>
          <Label className="text-base font-medium">Service Level</Label>
          <RadioGroup 
            value={expertPrefs.urgency} 
            onValueChange={(v) => setExpertPrefs(prev => ({ ...prev, urgency: v as any }))}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3"
          >
            {[
              { value: "normal", label: "Standard", desc: "5-7 working days", price: EXPERT_PRICING[getRecommendedForm()]?.base || 999 },
              { value: "priority", label: "Priority", desc: "2-3 working days", price: EXPERT_PRICING[getRecommendedForm()]?.priority || 1499 },
              { value: "urgent", label: "Urgent", desc: "24-48 hours", price: EXPERT_PRICING[getRecommendedForm()]?.urgent || 1999 }
            ].map(opt => (
              <Card 
                key={opt.value}
                className={`cursor-pointer transition-all ${expertPrefs.urgency === opt.value ? "border-primary ring-2 ring-primary/20" : "hover:border-border dark:hover:border-border"}`}
                onClick={() => setExpertPrefs(prev => ({ ...prev, urgency: opt.value as any }))}
              >
                <CardContent className="p-4 text-center">
                  <Clock className={`h-6 w-6 mx-auto mb-2 ${expertPrefs.urgency === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  <p className="text-lg font-bold text-primary mt-2">₹{opt.price.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const requiredDocs = getRequiredDocs();
    const price = calculatePrice();
    
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Review & Submit</h3>
          <p className="text-muted-foreground text-sm">
            Please review your case details before submitting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Case Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assessment Year</span>
                <span className="font-medium">{assessmentYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ITR Form</span>
                <span className="font-medium">{getRecommendedForm()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PAN</span>
                <span className="font-medium">{panContext?.pan || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documents Uploaded</span>
                <span className="font-medium">{uploadedDocs.length}/{requiredDocs.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expert Type</span>
                <span className="font-medium capitalize">{expertPrefs.preferredExpertType.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Level</span>
                <span className="font-medium capitalize">{expertPrefs.urgency}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base">
                <span className="font-medium">Total Amount</span>
                <span className="font-bold text-primary">₹{price.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income Sources Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(incomeSources)
                .filter(([, value]) => value)
                .map(([key]) => (
                  <Badge key={key} variant="secondary">
                    {key.replace("has", "").replace(/([A-Z])/g, " $1").trim()}
                  </Badge>
                ))}
              {Object.values(incomeSources).every(v => !v) && (
                <span className="text-muted-foreground text-sm">No income sources selected</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <LucideShield className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Your data is secure and will only be shared with your assigned expert. Payment will be collected after draft review.
          </AlertDescription>
        </Alert>

        <div className="flex items-start gap-2">
          <Checkbox id="terms" className="mt-1" data-testid="checkbox-terms" />
          <Label htmlFor="terms" className="text-sm text-muted-foreground">
            I agree to the Terms of Service and authorize FintekPro to share my documents with the assigned expert for ITR preparation.
          </Label>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderIncomeSourcesStep();
      case 1: return renderCaseDetailsStep();
      case 2: return renderDocumentsStep();
      case 3: return renderExpertSelectionStep();
      case 4: return renderReviewStep();
      default: return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return Object.values(incomeSources).some(v => v);
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  if (panLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading your details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-itr-expert">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tax/itr")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Hire Tax Expert</h1>
          <p className="text-muted-foreground">Let our experts prepare and file your ITR</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <div key={step.id} className="flex items-center">
              <Button
                variant={isActive ? "default" : isCompleted ? "secondary" : "ghost"}
                size="sm"
                className={`gap-2 ${isCompleted ? "text-green-600 dark:text-green-400" : ""}`}
                onClick={() => idx < currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                data-testid={`step-${step.id}`}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{step.label}</span>
              </Button>
              {idx < STEPS.length - 1 && (
                <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {renderCurrentStep()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleBack} 
          disabled={currentStep === 0}
          data-testid="button-prev"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Previous
        </Button>
        
        {currentStep < STEPS.length - 1 ? (
          <Button 
            onClick={handleNext} 
            disabled={!canProceed()}
            data-testid="button-next"
          >
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            disabled={submitCaseMutation.isPending}
            data-testid="button-submit"
          >
            {submitCaseMutation.isPending ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                Submit Case <CheckCircle className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>

      <Card className="bg-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm">Live Chat Support</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-sm">1800-XXX-XXXX</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-sm">tax@fintekpro.com</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm">4.8/5 Expert Rating</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
