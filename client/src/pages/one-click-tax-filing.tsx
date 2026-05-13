import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  Zap,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Send,
  TrendingUp,
  IndianRupee,
  Database,
  Calendar,
  LucideShield as LucideShield,
  Sparkles,
  ArrowRight,
  Clock,
  RefreshCw,
  Eye,
  Check,
  X
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'syncing';
  recordsCount: number;
  icon: any;
}

interface ITRFilingData {
  id: string;
  userId: string;
  assessmentYear: string;
  financialYear: string;
  itrForm: string;
  taxRegime: string;
  completionPercentage: number;
  totalIncome: number;
  taxLiability: number;
  tdsDeducted: number;
  refundDue: number;
  status: 'draft' | 'ready' | 'validated' | 'filed';
  validationErrors: { field: string; message: string; severity: 'error' | 'warning' }[];
  readyForFiling: boolean;
}

type FilingStep = 'connect' | 'populate' | 'validate' | 'review' | 'file' | 'complete';

export default function OneClickTaxFiling() {
  const [currentStep, setCurrentStep] = useState<FilingStep>('connect');
  const [selectedYear, setSelectedYear] = useState('2025-26');
  const [taxRegime, setTaxRegime] = useState<'old' | 'new'>('new');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id || '';

  // Fetch available data sources
  const { data: dataSources, isLoading: sourcesLoading } = useQuery<DataSource[]>({
    queryKey: ['/api/itr/data-sources', userId],
    enabled: !!userId,
  });
  
  const dataSourcesList = Array.isArray(dataSources) ? dataSources : [];

  // Fetch ITR filing data
  const { data: itrData, isLoading: itrLoading, refetch: refetchITR } = useQuery<ITRFilingData>({
    queryKey: ['/api/itr/one-click', userId, selectedYear],
    enabled: !!userId && currentStep !== 'connect',
  });

  // Auto-detect and connect all available data sources
  const connectAllSourcesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/itr/connect-all-sources', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Data Sources Connected",
        description: `Successfully connected ${data.connectedCount} data sources.`,
      });
      setCurrentStep('populate');
      queryClient.invalidateQueries({ queryKey: ['/api/itr/data-sources'] });
    },
  });

  // One-click auto-populate
  const oneClickPopulateMutation = useMutation({
    mutationFn: async () => {
      const connectedSources = dataSourcesList
        .filter(s => s.status === 'connected')
        .map(s => s.id);

      const response = await apiRequest('/api/itr/one-click-populate', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          assessmentYear: `20${selectedYear.split('-')[0].slice(-2)}-${selectedYear.split('-')[1]}`,
          financialYear: selectedYear,
          taxRegime,
          dataSources: connectedSources
        })
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "ITR Auto-Populated Successfully",
        description: "Your tax return has been automatically filled with data from all sources.",
      });
      setCurrentStep('validate');
      refetchITR();
    },
  });

  // Auto-validate ITR
  const autoValidateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/itr/auto-validate/${itrData?.id}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      return response;
    },
    onSuccess: (data) => {
      const errorCount = data.validationErrors?.filter((e: any) => e.severity === 'error').length || 0;
      
      if (errorCount === 0) {
        toast({
          title: "Validation Successful",
          description: "Your ITR is ready for filing!",
        });
        setCurrentStep('review');
      } else {
        toast({
          title: "Validation Issues Found",
          description: `Found ${errorCount} issues that need attention.`,
          variant: "destructive",
        });
        setCurrentStep('review');
      }
      refetchITR();
    },
  });

  // File ITR
  const fileITRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/itr/file-return', {
        method: 'POST',
        body: JSON.stringify({ itrId: itrData?.id })
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "ITR Filed Successfully!",
        description: `Your ITR has been filed. Acknowledgment number: ${data.acknowledgmentNumber}`,
      });
      setCurrentStep('complete');
      refetchITR();
    },
  });

  // Auto-progress through steps
  useEffect(() => {
    if (currentStep === 'populate' && !oneClickPopulateMutation.isPending && !itrData) {
      // Auto-trigger population after connection
      const timer = setTimeout(() => {
        oneClickPopulateMutation.mutate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'validate' && itrData && !autoValidateMutation.isPending) {
      // Auto-trigger validation after population
      const timer = setTimeout(() => {
        autoValidateMutation.mutate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, itrData?.id]);

  const getStepStatus = (step: FilingStep): 'current' | 'completed' | 'upcoming' => {
    const steps: FilingStep[] = ['connect', 'populate', 'validate', 'review', 'file', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const connectedSourcesCount = dataSourcesList.filter(s => s.status === 'connected').length;
  const totalSourcesCount = dataSourcesList.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <Zap className="h-10 w-10 text-yellow-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            One-Click Tax Filing
          </h1>
          <Sparkles className="h-10 w-10 text-purple-500" />
        </div>
        <p className="text-lg text-muted-foreground">
          File your Income Tax Return in minutes with intelligent auto-population
        </p>
      </div>

      {/* Progress Steps */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            {[
              { id: 'connect', label: 'Connect', icon: Database },
              { id: 'populate', label: 'Auto-Fill', icon: Sparkles },
              { id: 'validate', label: 'Validate', icon: CheckCircle },
              { id: 'review', label: 'Review', icon: Eye },
              { id: 'file', label: 'File', icon: Send },
              { id: 'complete', label: 'Complete', icon: Check }
            ].map((step, index) => {
              const status = getStepStatus(step.id as FilingStep);
              const Icon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all
                      ${status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : ''}
                      ${status === 'current' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 ring-4 ring-blue-200' : ''}
                      ${status === 'upcoming' ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`text-sm font-medium ${
                      status === 'current' ? 'text-blue-600' : 
                      status === 'completed' ? 'text-green-600' : 
                      'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < 5 && (
                    <ArrowRight className={`h-5 w-5 mx-2 ${
                      status === 'completed' ? 'text-green-400' : 'text-muted-foreground'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress 
            value={(Object.keys(['connect', 'populate', 'validate', 'review', 'file', 'complete']).indexOf(currentStep) + 1) * (100 / 6)} 
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Step: Connect Data Sources */}
      {currentStep === 'connect' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Step 1: Connect Your Data Sources
            </CardTitle>
            <CardDescription>
              We'll automatically detect and connect all available tax data sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sourcesLoading ? (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                dataSourcesList.map((source) => (
                  <div key={source.id} className="flex items-center gap-3 p-4 border rounded-lg">
                    <source.icon className="h-8 w-8 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">{source.name}</p>
                      <p className="text-sm text-muted-foreground">{source.recordsCount} records</p>
                    </div>
                    <Badge className={
                      source.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-muted text-white'
                    }>
                      {source.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to connect {totalSourcesCount} data sources</p>
                <p className="text-sm text-muted-foreground">This will take about 30 seconds</p>
              </div>
              <Button
                size="lg"
                onClick={() => connectAllSourcesMutation.mutate()}
                disabled={connectAllSourcesMutation.isPending || !userId}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-connect-sources"
              >
                {connectAllSourcesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Connect All Sources
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Auto-Populate */}
      {currentStep === 'populate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" />
              Step 2: Auto-Populating Your ITR
            </CardTitle>
            <CardDescription>
              Intelligently gathering data from {connectedSourcesCount} connected sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-purple-600" />
              <p className="text-lg font-medium">Auto-filling your tax return...</p>
              <p className="text-sm text-muted-foreground">This may take a minute</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Validate */}
      {currentStep === 'validate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Step 3: Validating Your ITR
            </CardTitle>
            <CardDescription>
              Running comprehensive validation checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-green-600" />
              <p className="text-lg font-medium">Validating your data...</p>
              <p className="text-sm text-muted-foreground">Checking for errors and inconsistencies</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Review & File */}
      {(currentStep === 'review' || currentStep === 'file') && itrData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Income</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(itrData.totalIncome)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tax Liability</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(itrData.taxLiability)}
                    </p>
                  </div>
                  <IndianRupee className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">TDS Deducted</p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatCurrency(itrData.tdsDeducted)}
                    </p>
                  </div>
                  <LucideShield className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Refund Due</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatCurrency(itrData.refundDue)}
                    </p>
                  </div>
                  <IndianRupee className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-6 w-6" />
                ITR Summary - {itrData.itrForm} for AY {itrData.assessmentYear}
              </CardTitle>
              <CardDescription>
                Tax Regime: {itrData.taxRegime === 'new' ? 'New Tax Regime' : 'Old Tax Regime'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Completion Status</span>
                <div className="flex items-center gap-3">
                  <Progress value={itrData.completionPercentage} className="w-32" />
                  <span className="font-semibold">{itrData.completionPercentage}%</span>
                </div>
              </div>

              {itrData.validationErrors && itrData.validationErrors.length > 0 && (
                <Alert variant={itrData.validationErrors.some(e => e.severity === 'error') ? 'destructive' : 'default'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Validation Issues:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {itrData.validationErrors.slice(0, 3).map((error, idx) => (
                        <li key={idx} className="text-sm">
                          {error.field}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  {itrData.readyForFiling ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ready for Filing
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Review Required
                    </Badge>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/itr/download/${itrData.id}/pdf`, '_blank')}
                    data-testid="button-download-preview"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Preview
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      setCurrentStep('file');
                      fileITRMutation.mutate();
                    }}
                    disabled={fileITRMutation.isPending || !itrData.readyForFiling}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                    data-testid="button-file-itr"
                  >
                    {fileITRMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Filing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        File ITR Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step: Complete */}
      {currentStep === 'complete' && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-green-800 dark:text-green-200">ITR Filed Successfully!</h2>
              <p className="text-lg text-green-700 dark:text-green-300">
                Your Income Tax Return for AY {selectedYear} has been successfully filed.
              </p>
              <div className="flex gap-4 mt-6">
                <Button variant="outline" data-testid="button-download-acknowledgment">
                  <Download className="mr-2 h-4 w-4" />
                  Download Acknowledgment
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  data-testid="button-file-another"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  File Another Year
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Year & Regime Selection (shown at connect step) */}
      {currentStep === 'connect' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assessment Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  data-testid="select-year"
                >
                  <option value="2026-27">2026-27 (FY 2025-26)</option>
                  <option value="2025-26">2025-26 (FY 2024-25)</option>
                  <option value="2024-25">2024-25 (FY 2023-24)</option>
                  <option value="2023-24">2023-24 (FY 2022-23)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax Regime</label>
                <select
                  value={taxRegime}
                  onChange={(e) => setTaxRegime(e.target.value as 'old' | 'new')}
                  className="w-full px-3 py-2 border rounded-md"
                  data-testid="select-regime"
                >
                  <option value="new">New Tax Regime</option>
                  <option value="old">Old Tax Regime</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
