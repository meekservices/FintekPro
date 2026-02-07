import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Briefcase,
  Settings,
  Eye,
  Download,
  Loader2,
  AlertTriangle,
  X,
  PieChart,
  TrendingUp,
  BarChart3,
  Grid3X3,
  FileCheck,
  ArrowUpRight,
  CheckCircle,
  Shield,
  Calendar,
  User,
  Clock,
  RefreshCw,
  Save,
  History,
  Target
} from "lucide-react";

interface Client {
  id: number;
  fullName: string;
  email: string;
  portfolios: Portfolio[];
}

interface Portfolio {
  id: string;
  name: string;
  totalValue: string;
  baseCurrency: string;
}

interface ReportConfig {
  portfolioId: string;
  sections: {
    portfolioSnapshot: boolean;
    portfolioXray: boolean;
    riskReward?: { enabled: boolean; years: number };
    rollingReturns?: { enabled: boolean; months: number };
    correlationMatrix: boolean;
    underlyingHoldings: boolean;
    disclosureMaterials: boolean;
  };
  coverPage?: {
    enabled: boolean;
    title: string;
    clientName: string;
    preparedBy: string;
    date: string;
  };
  settings?: {
    orientation: 'portrait' | 'landscape';
    fontSize: 'standard' | 'large';
    branding: boolean;
    watermark: boolean;
  };
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  dataAvailability: Record<string, { available: boolean; message: string }>;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  config: ReportConfig;
  isDefault: boolean;
  category: string;
  createdAt: string;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Select Client', icon: Users, description: 'Choose client and portfolio' },
  { id: 2, title: 'Report Sections', icon: PieChart, description: 'Select analytics modules' },
  { id: 3, title: 'Configuration', icon: Settings, description: 'Customize settings' },
  { id: 4, title: 'Cover Page', icon: FileText, description: 'Branding and cover' },
  { id: 5, title: 'Preview & Validate', icon: Eye, description: 'Check data availability' },
  { id: 6, title: 'Generate', icon: Download, description: 'Create PDF report' },
];

const REPORT_SECTIONS = [
  { 
    id: 'portfolioSnapshot', 
    name: 'Portfolio Snapshot', 
    description: 'Quick overview of portfolio values and allocation',
    icon: Briefcase,
    category: 'summary'
  },
  { 
    id: 'portfolioXray', 
    name: 'Portfolio X-Ray', 
    description: 'Detailed asset allocation and top holdings analysis',
    icon: Target,
    category: 'analytics'
  },
  { 
    id: 'riskReward', 
    name: 'Risk/Reward Analysis', 
    description: 'Returns, volatility, Sharpe ratio, and drawdown metrics',
    icon: TrendingUp,
    category: 'analytics',
    hasConfig: true
  },
  { 
    id: 'rollingReturns', 
    name: 'Rolling Returns', 
    description: 'Time-period return consistency and distribution',
    icon: BarChart3,
    category: 'analytics',
    hasConfig: true
  },
  { 
    id: 'correlationMatrix', 
    name: 'Correlation Matrix', 
    description: 'Asset correlation and diversification scoring',
    icon: Grid3X3,
    category: 'analytics'
  },
  { 
    id: 'underlyingHoldings', 
    name: 'Underlying Holdings', 
    description: 'Complete list of all securities with values',
    icon: FileCheck,
    category: 'details'
  },
  { 
    id: 'disclosureMaterials', 
    name: 'Disclosures', 
    description: 'SEBI-compliant disclaimers and risk warnings',
    icon: Shield,
    category: 'compliance'
  },
];

const defaultConfig: ReportConfig = {
  portfolioId: '',
  sections: {
    portfolioSnapshot: true,
    portfolioXray: true,
    riskReward: { enabled: true, years: 3 },
    rollingReturns: { enabled: false, months: 12 },
    correlationMatrix: false,
    underlyingHoldings: true,
    disclosureMaterials: true,
  },
  coverPage: {
    enabled: true,
    title: 'Portfolio Analysis Report',
    clientName: '',
    preparedBy: 'FintekPro Advisor',
    date: new Date().toLocaleDateString('en-IN'),
  },
  settings: {
    orientation: 'portrait',
    fontSize: 'standard',
    branding: true,
    watermark: false,
  },
};

export default function AgentPortfolioReportBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [config, setConfig] = useState<ReportConfig>(defaultConfig);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [reportName, setReportName] = useState('');
  const [generatedReportUrl, setGeneratedReportUrl] = useState<string | null>(null);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/portfolio-reports/clients-portfolios'],
  });

  const { data: templatesData } = useQuery({
    queryKey: ['/api/portfolio-reports/templates'],
  });

  const validateMutation = useMutation({
    mutationFn: async (configData: ReportConfig) => {
      return apiRequest('/api/portfolio-reports/validate', {
        method: 'POST',
        body: JSON.stringify(configData),
      });
    },
    onSuccess: (data: any) => {
      setValidation(data.validation);
    },
    onError: () => {
      toast({
        title: "Validation Failed",
        description: "Could not validate report configuration",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/portfolio-reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          config,
          clientId: selectedClient?.id,
          reportName: reportName || `${selectedClient?.fullName} - Portfolio Report`,
        }),
      });
    },
    onSuccess: (data: any) => {
      if (data.report?.fileUrl) {
        setGeneratedReportUrl(data.report.fileUrl);
        toast({
          title: "Report Generated",
          description: "Your portfolio report is ready for download",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio-reports/generated'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (selectedClient && config.coverPage) {
      setConfig(prev => ({
        ...prev,
        coverPage: {
          ...prev.coverPage!,
          clientName: selectedClient.fullName,
        },
      }));
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedPortfolio) {
      setConfig(prev => ({
        ...prev,
        portfolioId: selectedPortfolio.id,
      }));
    }
  }, [selectedPortfolio]);

  const handleNext = () => {
    if (currentStep === 5) {
      validateMutation.mutate(config);
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSectionToggle = (sectionId: string, enabled: boolean) => {
    setConfig(prev => {
      const newSections = { ...prev.sections };
      if (sectionId === 'riskReward' || sectionId === 'rollingReturns') {
        (newSections as any)[sectionId] = {
          ...(newSections as any)[sectionId],
          enabled,
        };
      } else {
        (newSections as any)[sectionId] = enabled;
      }
      return { ...prev, sections: newSections };
    });
  };

  const handleSectionConfig = (sectionId: string, key: string, value: any) => {
    setConfig(prev => {
      const newSections = { ...prev.sections };
      (newSections as any)[sectionId] = {
        ...(newSections as any)[sectionId],
        [key]: value,
      };
      return { ...prev, sections: newSections };
    });
  };

  const handleDownload = () => {
    if (generatedReportUrl) {
      const link = document.createElement('a');
      link.href = generatedReportUrl;
      link.download = `${reportName || 'portfolio-report'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleLoadTemplate = (template: ReportTemplate) => {
    setConfig({
      ...template.config,
      portfolioId: selectedPortfolio?.id || '',
      coverPage: {
        ...template.config.coverPage,
        clientName: selectedClient?.fullName || '',
        date: new Date().toLocaleDateString('en-IN'),
      } as any,
    });
    toast({
      title: "Template Loaded",
      description: `Applied "${template.name}" template settings`,
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!selectedClient && !!selectedPortfolio;
      case 2:
        return Object.values(config.sections).some(v => 
          typeof v === 'boolean' ? v : (v as any)?.enabled
        );
      case 3:
      case 4:
        return true;
      case 5:
        return validation?.success !== false;
      default:
        return true;
    }
  };

  const clients = (clientsData as any)?.clients || [];
  const templates = (templatesData as any)?.templates || [];

  return (
    <div className="min-h-screen bg-muted" data-testid="portfolio-report-builder">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              Portfolio Report Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Create professional, SEBI-compliant portfolio analysis reports
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/agent/reports')}>
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>

        <div className="flex gap-8 mb-8">
          {WIZARD_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                data-testid={`wizard-step-${step.id}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isActive ? 'bg-blue-600 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <div className="hidden lg:block">
                  <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <Progress value={(currentStep / 6) * 100} className="mb-8" />

        <Card className="mb-6">
          <CardContent className="p-6">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Select Client & Portfolio</h2>
                  {clientsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Client</Label>
                        <Select 
                          value={selectedClient?.id?.toString() || ''} 
                          onValueChange={(val) => {
                            const client = clients.find((c: Client) => c.id.toString() === val);
                            setSelectedClient(client || null);
                            setSelectedPortfolio(null);
                          }}
                        >
                          <SelectTrigger data-testid="select-client">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client: Client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>{client.fullName}</span>
                                  <span className="text-muted-foreground text-sm">({client.email})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {selectedClient && (
                        <div>
                          <Label className="mb-2 block">Portfolio</Label>
                          <Select 
                            value={selectedPortfolio?.id || ''} 
                            onValueChange={(val) => {
                              const portfolio = selectedClient.portfolios.find(p => p.id === val);
                              setSelectedPortfolio(portfolio || null);
                            }}
                          >
                            <SelectTrigger data-testid="select-portfolio">
                              <SelectValue placeholder="Select a portfolio" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedClient.portfolios.length > 0 ? (
                                selectedClient.portfolios.map((portfolio) => (
                                  <SelectItem key={portfolio.id} value={portfolio.id}>
                                    <div className="flex items-center gap-2">
                                      <Briefcase className="h-4 w-4" />
                                      <span>{portfolio.name}</span>
                                      <Badge variant="secondary">
                                        ₹{parseFloat(portfolio.totalValue || '0').toLocaleString('en-IN')}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  No portfolios available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {templates.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Quick Start from Template</Label>
                    <div className="grid md:grid-cols-3 gap-4">
                      {templates.slice(0, 3).map((template: ReportTemplate) => (
                        <Card 
                          key={template.id} 
                          className="cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() => handleLoadTemplate(template)}
                        >
                          <CardContent className="p-4">
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                            {template.isDefault && (
                              <Badge variant="outline" className="mt-2">Default</Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Select Report Sections</h2>
                <p className="text-muted-foreground">Choose which analytics modules to include in the report</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {REPORT_SECTIONS.map((section) => {
                    const SectionIcon = section.icon;
                    const sectionValue = (config.sections as any)[section.id];
                    const isEnabled = typeof sectionValue === 'boolean' 
                      ? sectionValue 
                      : sectionValue?.enabled;

                    return (
                      <Card 
                        key={section.id}
                        className={`cursor-pointer transition-all ${
                          isEnabled ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        data-testid={`section-${section.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                isEnabled ? 'bg-blue-600 text-white' : 'bg-muted'
                              }`}>
                                <SectionIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{section.name}</h4>
                                <p className="text-sm text-muted-foreground">{section.description}</p>
                                <Badge variant="outline" className="mt-2 text-xs">
                                  {section.category}
                                </Badge>
                              </div>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleSectionToggle(section.id, checked)}
                            />
                          </div>
                          
                          {section.hasConfig && isEnabled && (
                            <div className="mt-4 pt-4 border-t">
                              {section.id === 'riskReward' && (
                                <div className="flex items-center gap-3">
                                  <Label>Analysis Period:</Label>
                                  <Select
                                    value={config.sections.riskReward?.years?.toString() || '3'}
                                    onValueChange={(val) => handleSectionConfig('riskReward', 'years', parseInt(val))}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1">1 Year</SelectItem>
                                      <SelectItem value="3">3 Years</SelectItem>
                                      <SelectItem value="5">5 Years</SelectItem>
                                      <SelectItem value="10">10 Years</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {section.id === 'rollingReturns' && (
                                <div className="flex items-center gap-3">
                                  <Label>Rolling Period:</Label>
                                  <Select
                                    value={config.sections.rollingReturns?.months?.toString() || '12'}
                                    onValueChange={(val) => handleSectionConfig('rollingReturns', 'months', parseInt(val))}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="6">6 Months</SelectItem>
                                      <SelectItem value="12">12 Months</SelectItem>
                                      <SelectItem value="24">24 Months</SelectItem>
                                      <SelectItem value="36">36 Months</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Report Settings</h2>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Page Orientation</Label>
                      <RadioGroup
                        value={config.settings?.orientation || 'portrait'}
                        onValueChange={(val) => setConfig(prev => ({
                          ...prev,
                          settings: { ...prev.settings!, orientation: val as 'portrait' | 'landscape' }
                        }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="portrait" id="portrait" />
                          <Label htmlFor="portrait">Portrait</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="landscape" id="landscape" />
                          <Label htmlFor="landscape">Landscape</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label className="mb-2 block">Font Size</Label>
                      <RadioGroup
                        value={config.settings?.fontSize || 'standard'}
                        onValueChange={(val) => setConfig(prev => ({
                          ...prev,
                          settings: { ...prev.settings!, fontSize: val as 'standard' | 'large' }
                        }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="standard" id="standard" />
                          <Label htmlFor="standard">Standard (10pt)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="large" id="large" />
                          <Label htmlFor="large">Large (12pt)</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Include Branding</Label>
                        <p className="text-sm text-muted-foreground">Add FintekPro logo and styling</p>
                      </div>
                      <Switch
                        checked={config.settings?.branding}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          settings: { ...prev.settings!, branding: checked }
                        }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Add Watermark</Label>
                        <p className="text-sm text-muted-foreground">Light "CONFIDENTIAL" watermark</p>
                      </div>
                      <Switch
                        checked={config.settings?.watermark}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          settings: { ...prev.settings!, watermark: checked }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Cover Page</h2>
                  <div className="flex items-center gap-2">
                    <Label>Enable Cover Page</Label>
                    <Switch
                      checked={config.coverPage?.enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        coverPage: { ...prev.coverPage!, enabled: checked }
                      }))}
                    />
                  </div>
                </div>
                
                {config.coverPage?.enabled && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Report Title</Label>
                        <Input
                          value={config.coverPage.title}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage!, title: e.target.value }
                          }))}
                          placeholder="Portfolio Analysis Report"
                          data-testid="input-report-title"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Client Name</Label>
                        <Input
                          value={config.coverPage.clientName}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage!, clientName: e.target.value }
                          }))}
                          data-testid="input-client-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Prepared By</Label>
                        <Input
                          value={config.coverPage.preparedBy}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage!, preparedBy: e.target.value }
                          }))}
                          placeholder="Advisor Name"
                          data-testid="input-prepared-by"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Report Date</Label>
                        <Input
                          value={config.coverPage.date}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage!, date: e.target.value }
                          }))}
                          data-testid="input-report-date"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Preview & Validation</h2>
                
                {validateMutation.isPending && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-3">Validating data availability...</span>
                  </div>
                )}

                {validation && (
                  <div className="space-y-4">
                    <Alert className={validation.success ? 'border-green-500' : 'border-yellow-500'}>
                      <AlertDescription>
                        {validation.success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            All data available for selected sections
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <AlertTriangle className="h-5 w-5" />
                            Some sections may have limited data
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>

                    {validation.warnings.length > 0 && (
                      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-yellow-800 dark:text-yellow-200">
                            Warnings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                            {validation.warnings.map((warning, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Data Availability by Section</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(validation.dataAvailability || {}).map(([section, status]) => (
                            <div key={section} className="flex items-center justify-between py-2 border-b last:border-0">
                              <span className="capitalize">{section.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <Badge variant={status.available ? 'default' : 'secondary'}>
                                {status.available ? 'Available' : 'Limited'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Report Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Client:</span>
                          <span className="font-medium">{selectedClient?.fullName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Portfolio:</span>
                          <span className="font-medium">{selectedPortfolio?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sections:</span>
                          <span className="font-medium">
                            {Object.values(config.sections).filter(v => 
                              typeof v === 'boolean' ? v : (v as any)?.enabled
                            ).length} selected
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cover Page:</span>
                          <span className="font-medium">{config.coverPage?.enabled ? 'Yes' : 'No'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Generate Report</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Report Name</Label>
                    <Input
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder={`${selectedClient?.fullName} - Portfolio Report ${new Date().toLocaleDateString('en-IN')}`}
                      data-testid="input-final-report-name"
                    />
                  </div>

                  {generateMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                      <p className="text-lg">Generating your report...</p>
                      <p className="text-sm text-muted-foreground">This may take a moment</p>
                    </div>
                  ) : generatedReportUrl ? (
                    <Card className="border-green-500 bg-green-50 dark:bg-green-900/10">
                      <CardContent className="py-8 text-center">
                        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                          Report Generated Successfully!
                        </h3>
                        <p className="text-green-600 dark:text-green-300 mb-6">
                          Your portfolio analysis report is ready for download
                        </p>
                        <div className="flex justify-center gap-4">
                          <Button onClick={handleDownload} data-testid="button-download-report">
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setGeneratedReportUrl(null);
                            setCurrentStep(1);
                            setConfig(defaultConfig);
                            setSelectedClient(null);
                            setSelectedPortfolio(null);
                          }}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Create Another
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                        <p className="text-muted-foreground mb-6">
                          Click the button below to create your PDF report
                        </p>
                        <Button 
                          size="lg"
                          onClick={() => generateMutation.mutate()}
                          disabled={!canProceed()}
                          data-testid="button-generate-report"
                        >
                          <FileText className="h-5 w-5 mr-2" />
                          Generate Report
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            {currentStep < 6 && (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
