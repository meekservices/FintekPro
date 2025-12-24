import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Target,
  Settings,
  Eye,
  Download,
  Loader2,
  AlertTriangle,
  PieChart,
  TrendingUp,
  BarChart3,
  Shield,
  IndianRupee,
  CheckCircle,
  RefreshCw,
  Save,
  History,
  Briefcase,
  Scale,
  Percent,
  Calendar,
  User,
  Mail,
  Phone,
  Sparkles
} from "lucide-react";

interface Client {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  riskProfile?: string;
}

interface ProposalConfig {
  clientId: string;
  investmentGoals: {
    primaryGoal: string;
    investmentHorizon: string;
    targetAmount: number;
    monthlyContribution: number;
  };
  assetAllocation: {
    equity: number;
    debt: number;
    gold: number;
    realestate: number;
    cash: number;
  };
  riskProfile: {
    score: number;
    category: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
    tolerance: string;
  };
  sections: {
    executiveSummary: boolean;
    investmentRecommendations: boolean;
    assetAllocationChart: boolean;
    riskAssessment: boolean;
    projectedReturns: boolean;
    feeDisclosure: boolean;
    termsConditions: boolean;
  };
  coverPage: {
    enabled: boolean;
    title: string;
    clientName: string;
    preparedBy: string;
    date: string;
  };
  settings: {
    orientation: 'portrait' | 'landscape';
    includeDisclaimer: boolean;
    includeSEBIDisclosure: boolean;
  };
}

const WIZARD_STEPS = [
  { id: 1, title: 'Select Client', icon: Users, description: 'Choose prospect or client' },
  { id: 2, title: 'Investment Goals', icon: Target, description: 'Define financial objectives' },
  { id: 3, title: 'Asset Allocation', icon: PieChart, description: 'Configure portfolio mix' },
  { id: 4, title: 'Risk Profile', icon: Scale, description: 'Assess risk tolerance' },
  { id: 5, title: 'Proposal Sections', icon: FileText, description: 'Select content modules' },
  { id: 6, title: 'Generate', icon: Download, description: 'Create proposal PDF' },
];

const INVESTMENT_GOALS = [
  { id: 'wealth_creation', name: 'Wealth Creation', description: 'Long-term capital appreciation' },
  { id: 'retirement', name: 'Retirement Planning', description: 'Build retirement corpus' },
  { id: 'child_education', name: 'Child Education', description: 'Fund children\'s higher education' },
  { id: 'home_purchase', name: 'Home Purchase', description: 'Save for property down payment' },
  { id: 'tax_saving', name: 'Tax Saving', description: 'Optimize tax liability' },
  { id: 'regular_income', name: 'Regular Income', description: 'Generate periodic income' },
];

const PROPOSAL_SECTIONS = [
  { id: 'executiveSummary', name: 'Executive Summary', description: 'High-level overview of the proposal', icon: FileText },
  { id: 'investmentRecommendations', name: 'Investment Recommendations', description: 'Specific fund/stock suggestions with rationale', icon: TrendingUp },
  { id: 'assetAllocationChart', name: 'Asset Allocation', description: 'Visual breakdown of portfolio allocation', icon: PieChart },
  { id: 'riskAssessment', name: 'Risk Assessment', description: 'Risk profile analysis and suitability', icon: Scale },
  { id: 'projectedReturns', name: 'Projected Returns', description: 'Expected returns based on historical data', icon: BarChart3 },
  { id: 'feeDisclosure', name: 'Fee Disclosure', description: 'Transparent fee and commission breakdown', icon: Percent },
  { id: 'termsConditions', name: 'Terms & Conditions', description: 'Legal terms and regulatory disclosures', icon: Shield },
];

const TEMPLATE_PRESETS = [
  {
    id: 'conservative_retirement',
    name: 'Conservative Retirement',
    description: 'Low-risk portfolio for retirement planning',
    config: {
      investmentGoals: { primaryGoal: 'retirement', investmentHorizon: '10+ years', targetAmount: 10000000, monthlyContribution: 50000 },
      assetAllocation: { equity: 30, debt: 50, gold: 10, realestate: 5, cash: 5 },
      riskProfile: { score: 25, category: 'conservative' as const, tolerance: 'Low risk tolerance - prefers capital preservation' },
    }
  },
  {
    id: 'aggressive_wealth',
    name: 'Aggressive Wealth Creation',
    description: 'High-growth portfolio for young investors',
    config: {
      investmentGoals: { primaryGoal: 'wealth_creation', investmentHorizon: '10+ years', targetAmount: 50000000, monthlyContribution: 100000 },
      assetAllocation: { equity: 80, debt: 10, gold: 5, realestate: 0, cash: 5 },
      riskProfile: { score: 80, category: 'aggressive' as const, tolerance: 'High risk tolerance - growth focused' },
    }
  },
  {
    id: 'balanced_education',
    name: 'Balanced Child Education',
    description: 'Moderate-risk portfolio for education planning',
    config: {
      investmentGoals: { primaryGoal: 'child_education', investmentHorizon: '5-10 years', targetAmount: 3000000, monthlyContribution: 25000 },
      assetAllocation: { equity: 50, debt: 35, gold: 10, realestate: 0, cash: 5 },
      riskProfile: { score: 50, category: 'moderate' as const, tolerance: 'Moderate risk tolerance - balanced approach' },
    }
  },
  {
    id: 'income_focused',
    name: 'Income Focused',
    description: 'Regular income generation portfolio',
    config: {
      investmentGoals: { primaryGoal: 'regular_income', investmentHorizon: '3-5 years', targetAmount: 5000000, monthlyContribution: 0 },
      assetAllocation: { equity: 20, debt: 60, gold: 5, realestate: 10, cash: 5 },
      riskProfile: { score: 30, category: 'conservative' as const, tolerance: 'Low risk tolerance - income stability preferred' },
    }
  },
];

const defaultConfig: ProposalConfig = {
  clientId: '',
  investmentGoals: {
    primaryGoal: 'wealth_creation',
    investmentHorizon: '5-10 years',
    targetAmount: 5000000,
    monthlyContribution: 25000,
  },
  assetAllocation: {
    equity: 60,
    debt: 25,
    gold: 10,
    realestate: 0,
    cash: 5,
  },
  riskProfile: {
    score: 50,
    category: 'moderate',
    tolerance: 'Can tolerate moderate market fluctuations',
  },
  sections: {
    executiveSummary: true,
    investmentRecommendations: true,
    assetAllocationChart: true,
    riskAssessment: true,
    projectedReturns: true,
    feeDisclosure: true,
    termsConditions: true,
  },
  coverPage: {
    enabled: true,
    title: 'Investment Proposal',
    clientName: '',
    preparedBy: 'FintekPro Financial Advisor',
    date: new Date().toLocaleDateString('en-IN'),
  },
  settings: {
    orientation: 'portrait',
    includeDisclaimer: true,
    includeSEBIDisclosure: true,
  },
};

export default function AgentDemoProposalBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [config, setConfig] = useState<ProposalConfig>(defaultConfig);
  const [proposalName, setProposalName] = useState('');
  const [generatedProposalUrl, setGeneratedProposalUrl] = useState<string | null>(null);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/users'],
  });

  const validateBeforeGenerate = (): boolean => {
    const allocationTotal = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
    if (allocationTotal !== 100) {
      toast({
        title: "Invalid Allocation",
        description: `Asset allocation must total 100% (currently ${allocationTotal}%)`,
        variant: "destructive",
      });
      return false;
    }
    if (!selectedClient) {
      toast({
        title: "No Client Selected",
        description: "Please select a client before generating the proposal",
        variant: "destructive",
      });
      return false;
    }
    if (!Object.values(config.sections).some(v => v)) {
      toast({
        title: "No Sections Selected",
        description: "Please select at least one proposal section",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!validateBeforeGenerate()) {
        throw new Error("Validation failed");
      }
      return apiRequest('/api/agent/demo-proposals/generate-pdf', {
        method: 'POST',
        body: JSON.stringify({
          config,
          clientId: selectedClient?.id,
          proposalName: proposalName || `Investment Proposal - ${selectedClient?.fullName}`,
        }),
      });
    },
    onSuccess: (data: any) => {
      if (data.pdfUrl) {
        setGeneratedProposalUrl(data.pdfUrl);
        toast({
          title: "Proposal Generated",
          description: "Your investment proposal PDF is ready for download",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/agent/demo-proposals'] });
      }
    },
    onError: (error: any) => {
      if (error.message !== "Validation failed") {
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate proposal",
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    if (selectedClient && config.coverPage) {
      setConfig(prev => ({
        ...prev,
        clientId: selectedClient.id.toString(),
        coverPage: {
          ...prev.coverPage,
          clientName: selectedClient.fullName,
        },
      }));
    }
  }, [selectedClient]);

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleAllocationChange = (key: keyof typeof config.assetAllocation, value: number) => {
    const oldValue = config.assetAllocation[key];
    const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
    const diff = clampedValue - oldValue;
    
    if (diff === 0) return;
    
    const otherKeys = Object.keys(config.assetAllocation).filter(k => k !== key) as Array<keyof typeof config.assetAllocation>;
    const otherTotal = otherKeys.reduce((sum, k) => sum + config.assetAllocation[k], 0);
    
    const newAllocation = { ...config.assetAllocation };
    newAllocation[key] = clampedValue;
    
    if (diff > 0) {
      if (otherTotal <= 0) return;
      
      const actualDiff = Math.min(diff, otherTotal);
      newAllocation[key] = oldValue + actualDiff;
      
      let accumulated = 0;
      const nonZeroKeys = otherKeys.filter(k => config.assetAllocation[k] > 0);
      
      nonZeroKeys.forEach((k, i) => {
        const proportion = config.assetAllocation[k] / otherTotal;
        if (i === nonZeroKeys.length - 1) {
          newAllocation[k] = config.assetAllocation[k] - (actualDiff - accumulated);
        } else {
          const reduction = Math.floor(actualDiff * proportion);
          newAllocation[k] = config.assetAllocation[k] - reduction;
          accumulated += reduction;
        }
        newAllocation[k] = Math.max(0, newAllocation[k]);
      });
    } else {
      const increase = Math.abs(diff);
      
      if (otherTotal > 0) {
        let accumulated = 0;
        const nonZeroKeys = otherKeys.filter(k => config.assetAllocation[k] > 0);
        
        nonZeroKeys.forEach((k, i) => {
          const proportion = config.assetAllocation[k] / otherTotal;
          if (i === nonZeroKeys.length - 1) {
            newAllocation[k] = config.assetAllocation[k] + (increase - accumulated);
          } else {
            const addition = Math.floor(increase * proportion);
            newAllocation[k] = config.assetAllocation[k] + addition;
            accumulated += addition;
          }
        });
      } else if (otherKeys.length > 0) {
        newAllocation[otherKeys[0]] = config.assetAllocation[otherKeys[0]] + increase;
      }
    }
    
    setConfig(prev => ({ ...prev, assetAllocation: newAllocation }));
  };

  const getAllocationTotal = () => {
    return Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
  };

  const normalizeAllocation = () => {
    const total = getAllocationTotal();
    if (total === 0) {
      setConfig(prev => ({
        ...prev,
        assetAllocation: { equity: 60, debt: 25, gold: 10, realestate: 5, cash: 0 },
      }));
      return;
    }
    
    const scale = 100 / total;
    const newAllocation = { ...config.assetAllocation };
    Object.keys(newAllocation).forEach(key => {
      newAllocation[key as keyof typeof newAllocation] = Math.round(newAllocation[key as keyof typeof newAllocation] * scale);
    });
    
    // Adjust rounding errors
    const newTotal = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (newTotal !== 100) {
      const diff = 100 - newTotal;
      const maxKey = Object.entries(newAllocation).reduce((a, b) => b[1] > a[1] ? b : a)[0];
      newAllocation[maxKey as keyof typeof newAllocation] += diff;
    }
    
    setConfig(prev => ({ ...prev, assetAllocation: newAllocation }));
    toast({
      title: "Allocation Normalized",
      description: "Your allocation has been adjusted to total 100%",
    });
  };

  const handleRiskScoreChange = (value: number[]) => {
    const score = value[0];
    let category: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
    let tolerance: string;
    
    if (score <= 25) {
      category = 'conservative';
      tolerance = 'Low risk tolerance - prefers capital preservation';
    } else if (score <= 50) {
      category = 'moderate';
      tolerance = 'Moderate risk tolerance - balanced approach';
    } else if (score <= 75) {
      category = 'aggressive';
      tolerance = 'High risk tolerance - growth focused';
    } else {
      category = 'very_aggressive';
      tolerance = 'Very high risk tolerance - maximum growth potential';
    }
    
    setConfig(prev => ({
      ...prev,
      riskProfile: { score, category, tolerance },
    }));
  };

  const handleDownload = () => {
    if (generatedProposalUrl) {
      const link = document.createElement('a');
      link.href = generatedProposalUrl;
      link.download = `${proposalName || 'investment-proposal'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!selectedClient;
      case 2:
        return config.investmentGoals.primaryGoal && config.investmentGoals.targetAmount > 0;
      case 3:
        const total = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
        return total === 100;
      case 4:
        return config.riskProfile.score >= 0;
      case 5:
        return Object.values(config.sections).some(v => v);
      default:
        return true;
    }
  };

  const allocationTotal = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
  const clients = (clientsData as any)?.users || (clientsData as any) || [];

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="demo-proposal-builder">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              Demo Proposal Builder
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Create professional investment proposals for prospects
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/agent/demo-proposals')}>
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>

        <div className="flex gap-8 mb-8 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                data-testid={`wizard-step-${step.id}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isActive ? 'bg-purple-600 text-white' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <div className="hidden lg:block">
                  <p className={`text-sm font-medium ${isActive ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
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
                  <h2 className="text-xl font-semibold mb-4">Select Prospect or Client</h2>
                  {clientsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Client</Label>
                        <Select 
                          value={selectedClient?.id?.toString() || ''} 
                          onValueChange={(val) => {
                            const client = clients.find((c: Client) => c.id.toString() === val);
                            setSelectedClient(client || null);
                          }}
                        >
                          <SelectTrigger data-testid="select-client">
                            <SelectValue placeholder="Select a client or prospect" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(clients) && clients.map((client: Client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>{client.fullName}</span>
                                  {client.email && <span className="text-gray-400 text-sm">({client.email})</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedClient && (
                        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                {selectedClient.fullName.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{selectedClient.fullName}</h4>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {selectedClient.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-4 w-4" />
                                      {selectedClient.email}
                                    </span>
                                  )}
                                  {selectedClient.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-4 w-4" />
                                      {selectedClient.phone}
                                    </span>
                                  )}
                                </div>
                                {selectedClient.riskProfile && (
                                  <Badge variant="outline" className="mt-2">
                                    Risk Profile: {selectedClient.riskProfile}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Investment Goals</h2>
                  <Select
                    value=""
                    onValueChange={(templateId) => {
                      const template = TEMPLATE_PRESETS.find(t => t.id === templateId);
                      if (template) {
                        setConfig(prev => ({
                          ...prev,
                          investmentGoals: { ...prev.investmentGoals, ...template.config.investmentGoals },
                          assetAllocation: template.config.assetAllocation,
                          riskProfile: template.config.riskProfile,
                        }));
                        toast({
                          title: "Template Applied",
                          description: `${template.name} template has been applied`,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-template">
                      <SelectValue placeholder="Load Template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_PRESETS.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-gray-500">{template.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="mb-3 block">Primary Investment Goal</Label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {INVESTMENT_GOALS.map((goal) => (
                      <Card 
                        key={goal.id}
                        className={`cursor-pointer transition-all ${
                          config.investmentGoals.primaryGoal === goal.id 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                            : 'hover:border-gray-400'
                        }`}
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          investmentGoals: { ...prev.investmentGoals, primaryGoal: goal.id }
                        }))}
                        data-testid={`goal-${goal.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className={`h-5 w-5 ${
                              config.investmentGoals.primaryGoal === goal.id ? 'text-purple-600' : 'text-gray-400'
                            }`} />
                            <h4 className="font-medium">{goal.name}</h4>
                          </div>
                          <p className="text-sm text-gray-500">{goal.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Investment Horizon</Label>
                    <Select 
                      value={config.investmentGoals.investmentHorizon}
                      onValueChange={(val) => setConfig(prev => ({
                        ...prev,
                        investmentGoals: { ...prev.investmentGoals, investmentHorizon: val }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-3 years">1-3 Years (Short Term)</SelectItem>
                        <SelectItem value="3-5 years">3-5 Years (Medium Term)</SelectItem>
                        <SelectItem value="5-10 years">5-10 Years (Long Term)</SelectItem>
                        <SelectItem value="10+ years">10+ Years (Very Long Term)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block">Target Corpus</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        value={config.investmentGoals.targetAmount}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          investmentGoals: { ...prev.investmentGoals, targetAmount: Number(e.target.value) }
                        }))}
                        className="pl-10"
                        data-testid="input-target-amount"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(config.investmentGoals.targetAmount)}</p>
                  </div>

                  <div>
                    <Label className="mb-2 block">Monthly Contribution</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        value={config.investmentGoals.monthlyContribution}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          investmentGoals: { ...prev.investmentGoals, monthlyContribution: Number(e.target.value) }
                        }))}
                        className="pl-10"
                        data-testid="input-monthly-contribution"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(config.investmentGoals.monthlyContribution)}/month</p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Asset Allocation</h2>
                  <Badge variant={allocationTotal === 100 ? 'default' : 'destructive'}>
                    Total: {allocationTotal}%
                  </Badge>
                </div>

                {allocationTotal !== 100 && (
                  <Alert className="border-yellow-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Allocation must total 100%. Currently at {allocationTotal}%.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-6">
                  {[
                    { key: 'equity', label: 'Equity', color: 'bg-blue-500', description: 'Stocks and equity mutual funds' },
                    { key: 'debt', label: 'Debt', color: 'bg-green-500', description: 'Bonds, FDs, debt mutual funds' },
                    { key: 'gold', label: 'Gold', color: 'bg-yellow-500', description: 'Gold ETFs, Sovereign Gold Bonds' },
                    { key: 'realestate', label: 'Real Estate', color: 'bg-purple-500', description: 'REITs, property investments' },
                    { key: 'cash', label: 'Cash & Equivalents', color: 'bg-gray-500', description: 'Liquid funds, savings' },
                  ].map(({ key, label, color, description }) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${color}`} />
                          <Label>{label}</Label>
                          <span className="text-sm text-gray-500">({description})</span>
                        </div>
                        <span className="font-medium">{config.assetAllocation[key as keyof typeof config.assetAllocation]}%</span>
                      </div>
                      <Slider
                        value={[config.assetAllocation[key as keyof typeof config.assetAllocation]]}
                        onValueChange={(val) => handleAllocationChange(key as keyof typeof config.assetAllocation, val[0])}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>

                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">Allocation Preview</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getAllocationTotal() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          Total: {getAllocationTotal()}%
                        </span>
                        {getAllocationTotal() !== 100 && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={normalizeAllocation}
                            data-testid="button-normalize-allocation"
                          >
                            Normalize to 100%
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex h-8 rounded-lg overflow-hidden">
                      {config.assetAllocation.equity > 0 && (
                        <div className="bg-blue-500" style={{ width: `${config.assetAllocation.equity}%` }} title={`Equity: ${config.assetAllocation.equity}%`} />
                      )}
                      {config.assetAllocation.debt > 0 && (
                        <div className="bg-green-500" style={{ width: `${config.assetAllocation.debt}%` }} title={`Debt: ${config.assetAllocation.debt}%`} />
                      )}
                      {config.assetAllocation.gold > 0 && (
                        <div className="bg-yellow-500" style={{ width: `${config.assetAllocation.gold}%` }} title={`Gold: ${config.assetAllocation.gold}%`} />
                      )}
                      {config.assetAllocation.realestate > 0 && (
                        <div className="bg-purple-500" style={{ width: `${config.assetAllocation.realestate}%` }} title={`Real Estate: ${config.assetAllocation.realestate}%`} />
                      )}
                      {config.assetAllocation.cash > 0 && (
                        <div className="bg-gray-500" style={{ width: `${config.assetAllocation.cash}%` }} title={`Cash: ${config.assetAllocation.cash}%`} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Risk Profile Assessment</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Risk Tolerance Score</Label>
                    <Badge variant={
                      config.riskProfile.category === 'conservative' ? 'secondary' :
                      config.riskProfile.category === 'moderate' ? 'default' :
                      config.riskProfile.category === 'aggressive' ? 'outline' :
                      'destructive'
                    }>
                      {config.riskProfile.category.charAt(0).toUpperCase() + config.riskProfile.category.slice(1).replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <Slider
                    value={[config.riskProfile.score]}
                    onValueChange={handleRiskScoreChange}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Conservative</span>
                    <span>Moderate</span>
                    <span>Aggressive</span>
                    <span>Very Aggressive</span>
                  </div>
                </div>

                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Scale className="h-5 w-5 text-purple-600" />
                      <h4 className="font-medium">Risk Assessment Summary</h4>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">{config.riskProfile.tolerance}</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Recommended Equity:</span>
                        <span className="ml-2 font-medium">
                          {config.riskProfile.category === 'conservative' ? '20-40%' :
                           config.riskProfile.category === 'moderate' ? '40-60%' :
                           config.riskProfile.category === 'aggressive' ? '60-80%' : '80-100%'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Score:</span>
                        <span className="ml-2 font-medium">{config.riskProfile.score}/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Select Proposal Sections</h2>
                <p className="text-gray-500">Choose which content modules to include in the proposal</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {PROPOSAL_SECTIONS.map((section) => {
                    const SectionIcon = section.icon;
                    const isEnabled = config.sections[section.id as keyof typeof config.sections];

                    return (
                      <Card 
                        key={section.id}
                        className={`cursor-pointer transition-all ${
                          isEnabled ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''
                        }`}
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          sections: {
                            ...prev.sections,
                            [section.id]: !isEnabled,
                          }
                        }))}
                        data-testid={`section-${section.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                isEnabled ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800'
                              }`}>
                                <SectionIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="font-medium">{section.name}</h4>
                                <p className="text-sm text-gray-500">{section.description}</p>
                              </div>
                            </div>
                            <Switch checked={isEnabled} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Cover Page Settings</h3>
                  <div className="flex items-center justify-between">
                    <Label>Include Cover Page</Label>
                    <Switch
                      checked={config.coverPage.enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        coverPage: { ...prev.coverPage, enabled: checked }
                      }))}
                    />
                  </div>
                  
                  {config.coverPage.enabled && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2 block">Proposal Title</Label>
                        <Input
                          value={config.coverPage.title}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage, title: e.target.value }
                          }))}
                          data-testid="input-proposal-title"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Prepared By</Label>
                        <Input
                          value={config.coverPage.preparedBy}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage, preparedBy: e.target.value }
                          }))}
                          data-testid="input-prepared-by"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Compliance Settings</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Include SEBI Disclosures</Label>
                      <p className="text-sm text-gray-500">Regulatory compliance statements</p>
                    </div>
                    <Switch
                      checked={config.settings.includeSEBIDisclosure}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        settings: { ...prev.settings, includeSEBIDisclosure: checked }
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Generate Proposal</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Proposal Name</Label>
                    <Input
                      value={proposalName}
                      onChange={(e) => setProposalName(e.target.value)}
                      placeholder={`Investment Proposal - ${selectedClient?.fullName} - ${new Date().toLocaleDateString('en-IN')}`}
                      data-testid="input-final-proposal-name"
                    />
                  </div>

                  <Card className="bg-gray-50 dark:bg-gray-800">
                    <CardHeader>
                      <CardTitle className="text-sm">Proposal Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Client:</span>
                        <span className="font-medium">{selectedClient?.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Investment Goal:</span>
                        <span className="font-medium capitalize">{config.investmentGoals.primaryGoal.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target Corpus:</span>
                        <span className="font-medium">{formatCurrency(config.investmentGoals.targetAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Monthly Contribution:</span>
                        <span className="font-medium">{formatCurrency(config.investmentGoals.monthlyContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Risk Profile:</span>
                        <span className="font-medium capitalize">{config.riskProfile.category.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sections:</span>
                        <span className="font-medium">
                          {Object.values(config.sections).filter(Boolean).length} selected
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {generateMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                      <p className="text-lg">Generating your proposal...</p>
                      <p className="text-sm text-gray-500">This may take a moment</p>
                    </div>
                  ) : generatedProposalUrl ? (
                    <Card className="border-green-500 bg-green-50 dark:bg-green-900/10">
                      <CardContent className="py-8 text-center">
                        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                          Proposal Generated Successfully!
                        </h3>
                        <p className="text-green-600 dark:text-green-300 mb-6">
                          Your investment proposal is ready for download and sharing
                        </p>
                        <div className="flex justify-center gap-4">
                          <Button onClick={handleDownload} data-testid="button-download-proposal">
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setGeneratedProposalUrl(null);
                            setCurrentStep(1);
                            setConfig(defaultConfig);
                            setSelectedClient(null);
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
                        <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                        <p className="text-gray-500 mb-6">
                          Click the button below to create your proposal PDF
                        </p>
                        <Button 
                          size="lg"
                          onClick={() => generateMutation.mutate()}
                          disabled={!canProceed()}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="button-generate-proposal"
                        >
                          <Sparkles className="h-5 w-5 mr-2" />
                          Generate Proposal
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
                className="bg-purple-600 hover:bg-purple-700"
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
