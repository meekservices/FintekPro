import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Download, 
  FileText, 
  Shield as LucideShield, 
  Brain, 
  ChevronRight, 
  ChevronDown,
  Sparkles,
  TrendingUp,
  Database,
  Receipt,
  Lightbulb,
  Eye,
  EyeOff,
} from "lucide-react";

// Form validation schemas
const sessionSchema = z.object({
  panNumber: z.string()
    .min(10, "PAN must be 10 characters")
    .max(10, "PAN must be 10 characters")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  assessmentYear: z.string().min(1, "Assessment year is required"),
  consent: z.boolean().refine(val => val === true, "Consent is required to proceed")
});

const optimizationResponseSchema = z.object({
  suggestionIds: z.array(z.string()),
  responses: z.record(z.enum(["accepted", "rejected"]))
});

type SessionForm = z.infer<typeof sessionSchema>;
type OptimizationResponse = z.infer<typeof optimizationResponseSchema>;

interface TaxSession {
  id: string;
  status: string;
  currentStep: number;
  completionPercentage: number;
  suggestedItrForm?: string;
  suggestedTaxRegime?: string;
}

interface FilingRecord {
  id?: string;
  status?: string;
  acknowledgementNumber?: string;
  filedAt?: string;
  itrForm?: string;
  assessmentYear?: string;
  [key: string]: any;
}

interface SessionData {
  session?: TaxSession;
  dataSources?: DataSource[];
  validation?: {
    issues: ValidationIssue[];
    summary: { totalIssues: number; errors: number; warnings: number; suggestions: number; };
  };
  suggestions?: OptimizationSuggestion[];
  filingRecord?: FilingRecord;
  taxCalculation?: any;
}

interface DataSource {
  id: string;
  name: string;
  status: string;
  recordsCount: number;
  lastSync?: string;
}

interface ValidationIssue {
  id: string;
  section: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
  fixHint?: string;
  autoFixable: boolean;
}

interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  potentialSaving: string;
  confidence: string;
  automatable: boolean;
  category: string;
}

export default function TaxSmartFiling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, string>>({});
  const [panMasked, setPanMasked] = useState(true);

  // Form setup
  const sessionForm = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      panNumber: "",
      assessmentYear: "2025-26",
      consent: false
    }
  });

  // Step configuration
  const steps = [
    { id: 1, title: "Consent & Setup", description: "PAN verification and consent" },
    { id: 2, title: "Auto-Aggregate", description: "Connect and sync data sources" },
    { id: 3, title: "Review & Validate", description: "Review data and fix issues" },
    { id: 4, title: "AI Optimization", description: "Smart tax-saving suggestions" },
    { id: 5, title: "Generate & File", description: "Create and submit ITR" },
    { id: 6, title: "Receipt & Track", description: "Track filing status" }
  ];

  // Queries
  const { data: smartDefaults } = useQuery({
    queryKey: ["/api/tax/smart-defaults"],
    enabled: !!sessionId
  });

  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ["/api/tax/session", sessionId],
    enabled: !!sessionId
  });

  const { data: sessionStatus } = useQuery({
    queryKey: ["/api/tax/session", sessionId, "status"],
    enabled: !!sessionId,
    refetchInterval: 5000 // Poll every 5 seconds
  });

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionForm) => {
      const response = await fetch("/api/tax/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panNumber: data.panNumber,
          assessmentYear: data.assessmentYear
        })
      });
      if (!response.ok) throw new Error("Failed to create session");
      return response.json();
    },
    onSuccess: (session: TaxSession) => {
      setSessionId(session.id);
      setCurrentStep(2);
      toast({
        title: "Session Created",
        description: "Tax filing session started successfully"
      });
    }
  });

  const initializeDataSourcesMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/initialize`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to initialize data sources");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Data Sources Ready",
        description: "All tax data sources have been initialized"
      });
    }
  });

  const syncAllMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/sync-all`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to sync data");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(3);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Data Synced",
        description: `Processed ${result.totalRecords} records from ${result.sourcesProcessed} sources`
      });
    }
  });

  const validateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/validate`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to validate data");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(4);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Validation Complete",
        description: `Found ${result.summary.totalIssues} items to review`
      });
    }
  });

  const optimizeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/optimize`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to generate suggestions");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(5);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Optimization Complete",
        description: `Generated ${result.suggestions.length} smart suggestions`
      });
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/generate`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to generate ITR");
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "ITR Generated",
        description: `Estimated refund: ₹${result.estimatedRefund.toLocaleString()}`
      });
    }
  });

  const fileMutation = useMutation({
    mutationFn: async ({ sessionId, itrJson }: { sessionId: string; itrJson: string }) => {
      const response = await fetch(`/api/tax/session/${sessionId}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itrJson, verificationMethod: "aadhaar" })
      });
      if (!response.ok) throw new Error("Failed to file ITR");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(6);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "ITR Filed Successfully",
        description: `Acknowledgment: ${result.acknowledgmentNumber}`
      });
    }
  });

  // Helper functions
  const formatPAN = (pan: string) => {
    if (panMasked && pan.length === 10) {
      return `${pan.slice(0, 3)}XXXXXX${pan.slice(-1)}`;
    }
    return pan;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warning": return "secondary";
      case "suggestion": return "default";
      default: return "default";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertTriangle className="h-4 w-4" />;
      case "warning": return <Clock className="h-4 w-4" />;
      case "suggestion": return <Lightbulb className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Step 1: Consent & Setup
  const renderConsentStep = () => (
    <Card data-testid="card-consent-step">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LucideShield className="h-5 w-5" />
          Tax Filing Consent & Setup
        </CardTitle>
        <CardDescription>
          Provide your PAN and consent to start the intelligent tax filing process
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...sessionForm}>
          <form onSubmit={sessionForm.handleSubmit((data) => createSessionMutation.mutate(data))} className="space-y-6">
            <FormField
              control={sessionForm.control}
              name="panNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN Number</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ABCDE1234F"
                        className="font-mono"
                        value={field.value}
                        data-testid="input-pan-number"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPanMasked(!panMasked)}
                      data-testid="button-toggle-pan-visibility"
                    >
                      {panMasked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={sessionForm.control}
              name="assessmentYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Year</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-assessment-year">
                        <SelectValue placeholder="Select assessment year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2026-27">2026-27 (FY 2025-26)</SelectItem>
                      <SelectItem value="2025-26">2025-26 (FY 2024-25)</SelectItem>
                      <SelectItem value="2024-25">2024-25 (FY 2023-24)</SelectItem>
                      <SelectItem value="2023-24">2023-24 (FY 2022-23)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert>
              <LucideShield className="h-4 w-4" />
              <AlertDescription>
                Your data is encrypted and secure. We only access tax-related information with your explicit consent.
              </AlertDescription>
            </Alert>

            <FormField
              control={sessionForm.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-consent"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      I consent to data aggregation and AI-powered tax optimization
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createSessionMutation.isPending}
              data-testid="button-start-filing"
            >
              {createSessionMutation.isPending ? "Starting..." : "Start Smart Filing"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // Step 2: Auto-Aggregate
  const renderAggregateStep = () => {
    const dataSources = (sessionData as SessionData)?.dataSources || [];
    
    return (
      <Card data-testid="card-aggregate-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Auto-Aggregate Tax Data
          </CardTitle>
          <CardDescription>
            Connecting to tax data sources and syncing your information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initializeDataSourcesMutation.isSuccess && (
            <Button
              onClick={() => sessionId && initializeDataSourcesMutation.mutate(sessionId)}
              disabled={initializeDataSourcesMutation.isPending}
              className="w-full"
              data-testid="button-initialize-sources"
            >
              {initializeDataSourcesMutation.isPending ? "Initializing..." : "Initialize Data Sources"}
            </Button>
          )}

          {initializeDataSourcesMutation.isSuccess && (
            <>
              <div className="grid gap-3">
                {dataSources.map((source: DataSource) => (
                  <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`source-${source.id}`}>
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{source.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {source.recordsCount} records
                        </div>
                      </div>
                    </div>
                    <Badge variant={source.status === 'connected' ? 'default' : 'secondary'}>
                      {source.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-advanced">
                    Advanced Options
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  <Alert>
                    <AlertDescription>
                      Advanced users can manually select specific data sources or configure sync parameters.
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={() => sessionId && syncAllMutation.mutate(sessionId)}
                disabled={syncAllMutation.isPending}
                className="w-full"
                data-testid="button-sync-all"
              >
                {syncAllMutation.isPending ? "Syncing..." : "Sync All Sources"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Step 3: Review & Validate
  const renderReviewStep = () => {
    const validationData = (sessionData as SessionData)?.validation || { 
      issues: [], 
      summary: { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 } 
    };
    
    return (
      <Card data-testid="card-review-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Review & Fix Issues
          </CardTitle>
          <CardDescription>
            AI-powered validation found {validationData.summary.totalIssues} items to review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!validateMutation.isSuccess && (
            <Button
              onClick={() => sessionId && validateMutation.mutate(sessionId)}
              disabled={validateMutation.isPending}
              className="w-full"
              data-testid="button-validate-data"
            >
              {validateMutation.isPending ? "Validating..." : "Validate Tax Data"}
            </Button>
          )}

          {validateMutation.isSuccess && (
            <Tabs defaultValue="errors" className="w-full">
              <ScrollableTabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
                <TabsTrigger value="warnings" data-testid="tab-warnings">Warnings</TabsTrigger>
                <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggestions</TabsTrigger>
              </ScrollableTabsList>
              
              {["errors", "warnings", "suggestions"].map((severity) => (
                <TabsContent key={severity} value={severity} className="space-y-3">
                  {validationData.issues
                    ?.filter((issue: ValidationIssue) => issue.severity === severity.slice(0, -1))
                    .map((issue: ValidationIssue) => (
                      <Alert key={issue.id} data-testid={`issue-${issue.id}`}>
                        {getSeverityIcon(issue.severity)}
                        <AlertDescription>
                          <div className="space-y-2">
                            <div className="font-medium">{issue.message}</div>
                            {issue.fixHint && (
                              <div className="text-sm text-muted-foreground">
                                💡 {issue.fixHint}
                              </div>
                            )}
                            {issue.autoFixable && (
                              <Button size="sm" variant="outline" data-testid={`button-autofix-${issue.id}`}>
                                Auto Fix
                              </Button>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {validateMutation.isSuccess && (
            <Button
              onClick={() => setCurrentStep(4)}
              className="w-full"
              data-testid="button-continue-to-optimize"
            >
              Continue to Optimization
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // Step 4: AI Optimization
  const renderOptimizeStep = () => {
    const suggestions = (sessionData as SessionData)?.suggestions || [];
    
    return (
      <Card data-testid="card-optimize-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Tax Optimization
          </CardTitle>
          <CardDescription>
            Smart suggestions to maximize your tax savings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!optimizeMutation.isSuccess && (
            <Button
              onClick={() => sessionId && optimizeMutation.mutate(sessionId)}
              disabled={optimizeMutation.isPending}
              className="w-full"
              data-testid="button-generate-suggestions"
            >
              {optimizeMutation.isPending ? "Analyzing..." : "Generate AI Suggestions"}
            </Button>
          )}

          {optimizeMutation.isSuccess && (
            <>
              <div className="space-y-3">
                {suggestions.map((suggestion: OptimizationSuggestion) => (
                  <Card key={suggestion.id} className="p-4" data-testid={`suggestion-${suggestion.id}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            {suggestion.title}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {suggestion.description}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          ₹{parseInt(suggestion.potentialSaving).toLocaleString()} savings
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`suggestion-${suggestion.id}`}>Apply this suggestion</Label>
                          <Switch
                            id={`suggestion-${suggestion.id}`}
                            checked={selectedSuggestions[suggestion.id] === 'accepted'}
                            onCheckedChange={(checked) => 
                              setSelectedSuggestions(prev => ({
                                ...prev,
                                [suggestion.id]: checked ? 'accepted' : 'rejected'
                              }))
                            }
                            data-testid={`switch-suggestion-${suggestion.id}`}
                          />
                        </div>
                        <Badge variant="secondary">
                          {Math.round(parseFloat(suggestion.confidence) * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                onClick={() => setCurrentStep(5)}
                className="w-full"
                data-testid="button-continue-to-generate"
              >
                Apply Selected & Continue
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Step 5: Generate & File
  const renderGenerateStep = () => {
    return (
      <Card data-testid="card-generate-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate & File ITR
          </CardTitle>
          <CardDescription>
            Create your ITR and submit to Income Tax Department
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generateMutation.isSuccess && (
            <Button
              onClick={() => sessionId && generateMutation.mutate(sessionId)}
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-itr"
            >
              {generateMutation.isPending ? "Generating ITR..." : "Generate ITR JSON"}
            </Button>
          )}

          {generateMutation.isSuccess && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ITR generated successfully! Review before filing.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <Button variant="outline" className="justify-start" data-testid="button-download-json">
                  <Download className="h-4 w-4 mr-2" />
                  Download ITR JSON
                </Button>
                <Button variant="outline" className="justify-start" data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download ITR PDF
                </Button>
              </div>

              <Button
                onClick={() => sessionId && fileMutation.mutate({ 
                  sessionId, 
                  itrJson: JSON.stringify({ /* mock ITR data */ }) 
                })}
                disabled={fileMutation.isPending}
                className="w-full"
                data-testid="button-file-itr"
              >
                {fileMutation.isPending ? "Filing..." : "File ITR with Income Tax Department"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Step 6: Receipt & Track
  const renderReceiptStep = () => {
    const filingRecord = (sessionData as SessionData)?.filingRecord;
    
    return (
      <Card data-testid="card-receipt-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Filing Receipt & Tracking
          </CardTitle>
          <CardDescription>
            Your ITR has been successfully filed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filingRecord && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ITR filed successfully! Your acknowledgment number is {filingRecord.acknowledgmentNumber}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span>Acknowledgment Number:</span>
                  <span className="font-mono">{filingRecord.acknowledgmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Filing Date:</span>
                  <span>{new Date(filingRecord.filingDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>ITR Form:</span>
                  <span>{filingRecord.itrForm}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="default">{filingRecord.status}</Badge>
                </div>
              </div>

              <Button className="w-full" data-testid="button-download-acknowledgment">
                <Download className="h-4 w-4 mr-2" />
                Download Acknowledgment Receipt
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-main-title">
            Tax Smart Filing
          </h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">
            AI-powered intelligent tax return filing with step-by-step guidance
          </p>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {steps.length}
                </span>
              </div>
              <Progress 
                value={(currentStep / steps.length) * 100} 
                className="w-full"
                data-testid="progress-main"
              />
              <div className="grid grid-cols-6 gap-2 text-xs">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`text-center p-2 rounded ${
                      currentStep >= step.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                  >
                    <div className="font-medium">{step.title}</div>
                    <div className="text-xs opacity-75">{step.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <div data-testid={`step-content-${currentStep}`}>
          {currentStep === 1 && renderConsentStep()}
          {currentStep === 2 && renderAggregateStep()}
          {currentStep === 3 && renderReviewStep()}
          {currentStep === 4 && renderOptimizeStep()}
          {currentStep === 5 && renderGenerateStep()}
          {currentStep === 6 && renderReceiptStep()}
        </div>
      </div>
    </div>
  );
}