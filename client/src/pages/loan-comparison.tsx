import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  GitCompare, 
  Calculator, 
  TrendingDown, 
  TrendingUp,
  Star,
  Clock,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Share,
  Filter,
  SortAsc,
  SortDesc,
  BarChart3,
  PieChart,
  Award,
  Target,
  Percent,
  Plus
} from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LoanOffer {
  id: string;
  providerId: string;
  providerName: string;
  providerLogo?: string;
  providerRating: number;
  productName: string;
  productType: string;
  
  // Financial Details
  approvedAmount: number;
  interestRate: number;
  tenure: number; // months
  emi: number;
  
  // Fees
  processingFee: number;
  legalCharges: number;
  otherCharges: number;
  totalCost: number;
  
  // Risk & Eligibility
  eligibilityScore: number;
  approvalProbability: number;
  qualityScore: number;
  
  // Additional Info
  features: string[];
  terms: string[];
  responseTime: string;
  rateType: 'fixed' | 'floating';
  
  // Calculated Fields
  totalInterest: number;
  totalRepayment: number;
  apr: number; // True Annual Percentage Rate
  comparisonScore?: number;
}

interface ComparisonCriteria {
  interestRate: number;
  processingFee: number;
  totalCost: number;
  approvalProbability: number;
  providerRating: number;
}

interface LoanComparisonParams {
  amount: number;
  tenure: number;
  loanType: string;
  monthlyIncome: number;
  creditScore?: number;
}

export default function LoanComparison() {
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [comparisonParams, setComparisonParams] = useState<LoanComparisonParams>({
    amount: 500000,
    tenure: 60, // 5 years
    loanType: 'personal',
    monthlyIncome: 50000,
    creditScore: 750
  });
  
  const [comparisonCriteria, setComparisonCriteria] = useState<ComparisonCriteria>({
    interestRate: 30,
    processingFee: 20,
    totalCost: 25,
    approvalProbability: 15,
    providerRating: 10
  });
  
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'bestOffer' | 'lowestEMI' | 'lowestRate' | 'highestApproval'>('bestOffer');
  const [filterBy, setFilterBy] = useState({
    provider: '',
    maxRate: 25,
    minAmount: 0,
    rateType: 'all'
  });

  const { toast } = useToast();

  // Fetch loan offers based on comparison parameters
  const { data: loanOffers, isLoading, refetch } = useQuery<LoanOffer[]>({
    queryKey: ['/api/loan-comparison/offers', comparisonParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        amount: comparisonParams.amount.toString(),
        tenure: comparisonParams.tenure.toString(),
        loanType: comparisonParams.loanType,
        monthlyIncome: comparisonParams.monthlyIncome.toString(),
        ...(comparisonParams.creditScore && { creditScore: comparisonParams.creditScore.toString() })
      });
      
      const response = await fetch(`/api/loan-comparison/offers?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch loan offers');
      }
      return response.json();
    },
    enabled: !!comparisonParams.amount && !!comparisonParams.tenure
  });

  // Mock providers since the database endpoint is failing
  const providers = [
    { id: 'hdfc-bank', name: 'HDFC Bank', rating: 4.2 },
    { id: 'icici-bank', name: 'ICICI Bank', rating: 4.1 },
    { id: 'bajaj-finserv', name: 'Bajaj Finserv', rating: 4.0 },
    { id: 'tata-capital', name: 'Tata Capital', rating: 3.9 },
    { id: 'axis-bank', name: 'Axis Bank', rating: 4.0 },
    { id: 'kotak-bank', name: 'Kotak Mahindra Bank', rating: 3.8 }
  ];

  // Calculate APR using Newton-Raphson method for IRR
  const calculateAPR = (principal: number, emi: number, tenure: number, fees: number): number => {
    // Set up cash flows: initial outflow (loan - fees), then monthly EMI payments
    const cashFlows = [-principal + fees, ...Array(tenure).fill(emi)];
    
    // Newton-Raphson method to find IRR
    let rate = 0.01; // Start with 1% monthly rate
    const maxIterations = 100;
    const tolerance = 0.000001;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let npvDerivative = 0;
      
      for (let t = 0; t < cashFlows.length; t++) {
        const discountFactor = Math.pow(1 + rate, -t);
        npv += cashFlows[t] * discountFactor;
        npvDerivative += cashFlows[t] * (-t) * discountFactor / (1 + rate);
      }
      
      if (Math.abs(npv) < tolerance) break;
      
      // Guard against division by zero or near-zero derivative
      if (Math.abs(npvDerivative) < tolerance) {
        rate = 0.01; // Reset to default rate
        break;
      }
      
      const newRate = rate - npv / npvDerivative;
      
      // Clamp rate to reasonable bounds (0.1% to 50% monthly)
      const clampedRate = Math.max(0.001, Math.min(0.5, newRate));
      
      if (Math.abs(clampedRate - rate) < tolerance) break;
      
      rate = clampedRate;
    }
    
    // Guard against NaN or unreasonable rates
    if (isNaN(rate) || rate <= 0 || rate > 0.5) {
      rate = 0.01; // Fallback to 1% monthly
    }
    
    // Convert monthly rate to annual percentage rate
    return (Math.pow(1 + rate, 12) - 1) * 100;
  };

  // Calculate EMI and comparison scores
  const processedOffers = useMemo(() => {
    if (!loanOffers) return [];
    
    const processedData = loanOffers.map(offer => {
      // Calculate derived values
      const principal = offer.approvedAmount;
      const monthlyRate = offer.interestRate / (12 * 100);
      const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, offer.tenure)) / 
                  (Math.pow(1 + monthlyRate, offer.tenure) - 1);
      
      const totalRepayment = emi * offer.tenure;
      const totalInterest = totalRepayment - principal;
      const totalFees = offer.processingFee + offer.legalCharges + offer.otherCharges;
      const totalCost = totalInterest + totalFees;
      
      // Calculate true APR
      const apr = calculateAPR(principal, emi, offer.tenure, totalFees);
      
      return {
        ...offer,
        emi: Math.round(emi),
        totalInterest: Math.round(totalInterest),
        totalRepayment: Math.round(totalRepayment),
        totalCost: Math.round(totalCost),
        apr: Math.round(apr * 100) / 100,
        comparisonScore: 0 // Will be calculated after normalization
      };
    });
    
    // Dynamic normalization based on actual data range
    const rates = processedData.map(o => o.interestRate);
    const fees = processedData.map(o => o.processingFee);
    const costs = processedData.map(o => o.totalCost);
    const ratings = processedData.map(o => o.providerRating);
    
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const minFee = Math.min(...fees);
    const maxFee = Math.max(...fees);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    
    // Calculate normalized scores with comparison criteria weights
    return processedData.map(offer => {
      // Normalize to 0-100 scale (lower is better for rate/fee/cost, higher is better for others)
      const normalizedRate = maxRate > minRate ? 
        (1 - (offer.interestRate - minRate) / (maxRate - minRate)) * 100 : 100;
      const normalizedFee = maxFee > minFee ?
        (1 - (offer.processingFee - minFee) / (maxFee - minFee)) * 100 : 100;
      const normalizedCost = maxCost > minCost ?
        (1 - (offer.totalCost - minCost) / (maxCost - minCost)) * 100 : 100;
      const normalizedRating = maxRating > minRating ?
        (offer.providerRating - minRating) / (maxRating - minRating) * 100 : 100;
      
      const comparisonScore = (
        (normalizedRate * comparisonCriteria.interestRate) +
        (normalizedFee * comparisonCriteria.processingFee) +
        (normalizedCost * comparisonCriteria.totalCost) +
        (offer.approvalProbability * comparisonCriteria.approvalProbability) +
        (normalizedRating * comparisonCriteria.providerRating)
      ) / 100;
      
      return {
        ...offer,
        comparisonScore: Math.round(comparisonScore * 100) / 100
      };
    });
  }, [loanOffers, comparisonCriteria]);

  // Filter and sort offers
  const filteredOffers = useMemo(() => {
    let filtered = processedOffers.filter(offer => {
      if (filterBy.provider && offer.providerName !== filterBy.provider) return false;
      if (offer.interestRate > filterBy.maxRate) return false;
      if (offer.approvedAmount < filterBy.minAmount) return false;
      if (filterBy.rateType !== 'all' && offer.rateType !== filterBy.rateType) return false;
      return true;
    });

    // Sort offers
    switch (sortBy) {
      case 'bestOffer':
        filtered.sort((a, b) => (b.comparisonScore || 0) - (a.comparisonScore || 0));
        break;
      case 'lowestEMI':
        filtered.sort((a, b) => a.emi - b.emi);
        break;
      case 'lowestRate':
        filtered.sort((a, b) => a.interestRate - b.interestRate);
        break;
      case 'highestApproval':
        filtered.sort((a, b) => b.approvalProbability - a.approvalProbability);
        break;
    }

    return filtered;
  }, [processedOffers, filterBy, sortBy]);

  // Get comparison data for selected offers
  const selectedOffersData = useMemo(() => {
    return filteredOffers.filter(offer => selectedOffers.includes(offer.id));
  }, [filteredOffers, selectedOffers]);

  // Generate offers mutation
  const generateOffersMutation = useMutation({
    mutationFn: async (params: LoanComparisonParams) => {
      const response = await apiRequest('POST', '/api/loan-comparison/generate', {
        body: params
      });
      return await response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Offers Generated",
        description: "Fresh loan offers have been generated based on your criteria."
      });
    }
  });

  // Save comparison mutation
  const saveComparisonMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/loan-comparison/save', {
        body: data
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comparison Saved",
        description: "Your loan comparison has been saved successfully."
      });
    }
  });

  const handleOfferSelection = (offerId: string) => {
    setSelectedOffers(prev => {
      if (prev.includes(offerId)) {
        return prev.filter(id => id !== offerId);
      } else if (prev.length < 4) { // Max 4 offers for comparison
        return [...prev, offerId];
      }
      return prev;
    });
  };

  const handleGenerateOffers = () => {
    generateOffersMutation.mutate(comparisonParams);
  };

  const handleSaveComparison = () => {
    if (selectedOffers.length < 2) {
      toast({
        title: "Select Offers",
        description: "Please select at least 2 offers to compare.",
        variant: "destructive"
      });
      return;
    }

    saveComparisonMutation.mutate({
      comparisonName: `Loan Comparison - ${new Date().toLocaleDateString()}`,
      comparisonAmount: comparisonParams.amount,
      comparisonTenure: comparisonParams.tenure,
      loanType: comparisonParams.loanType,
      selectedOffers,
      comparisonCriteria
    });
  };

  // Chart data for comparison
  const chartData = useMemo(() => {
    return selectedOffersData.map(offer => ({
      provider: offer.providerName,
      EMI: offer.emi,
      'Interest Rate': offer.interestRate,
      'Total Cost': offer.totalCost / 1000, // in thousands
      'Approval %': offer.approvalProbability,
      'Score': offer.comparisonScore
    }));
  }, [selectedOffersData]);

  const pieChartData = useMemo(() => {
    if (selectedOffersData.length === 0) return [];
    
    const categories = ['Principal', 'Interest', 'Processing Fee', 'Other Charges'];
    const bestOffer = selectedOffersData[0];
    
    return [
      { name: 'Principal', value: bestOffer.approvedAmount, color: '#3b82f6' },
      { name: 'Total Interest', value: bestOffer.totalInterest, color: '#ef4444' },
      { name: 'Processing Fee', value: bestOffer.processingFee, color: '#f59e0b' },
      { name: 'Other Charges', value: bestOffer.legalCharges + bestOffer.otherCharges, color: '#10b981' }
    ];
  }, [selectedOffersData]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <GitCompare className="h-8 w-8 text-blue-600" />
          Loan Comparison Tool
        </h1>
        <p className="text-muted-foreground">Compare multiple loan offers side-by-side to find the best deal</p>
      </div>

      {/* Comparison Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Comparison Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Loan Amount</Label>
              <Input
                id="amount"
                type="number"
                value={comparisonParams.amount}
                onChange={(e) => setComparisonParams(prev => ({
                  ...prev,
                  amount: parseInt(e.target.value) || 0
                }))}
                data-testid="input-loan-amount"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tenure">Tenure (Years)</Label>
              <Select
                value={(comparisonParams.tenure / 12).toString()}
                onValueChange={(value) => setComparisonParams(prev => ({
                  ...prev,
                  tenure: parseInt(value) * 12
                }))}
              >
                <SelectTrigger data-testid="select-tenure">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year} Year{year > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loanType">Loan Type</Label>
              <Select
                value={comparisonParams.loanType}
                onValueChange={(value) => setComparisonParams(prev => ({
                  ...prev,
                  loanType: value
                }))}
              >
                <SelectTrigger data-testid="select-loan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Loan</SelectItem>
                  <SelectItem value="home">Home Loan</SelectItem>
                  <SelectItem value="business">Business Loan</SelectItem>
                  <SelectItem value="vehicle">Vehicle Loan</SelectItem>
                  <SelectItem value="education">Education Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="income">Monthly Income</Label>
              <Input
                id="income"
                type="number"
                value={comparisonParams.monthlyIncome}
                onChange={(e) => setComparisonParams(prev => ({
                  ...prev,
                  monthlyIncome: parseInt(e.target.value) || 0
                }))}
                data-testid="input-monthly-income"
              />
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <Button 
              onClick={handleGenerateOffers}
              disabled={generateOffersMutation.isPending}
              data-testid="button-generate-offers"
            >
              {generateOffersMutation.isPending ? (
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Generate Fresh Offers
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleSaveComparison}
              disabled={saveComparisonMutation.isPending || selectedOffers.length < 2}
              data-testid="button-save-comparison"
            >
              {saveComparisonMutation.isPending ? (
                <Download className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Save Comparison
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Comparison Criteria Weights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {Object.entries(comparisonCriteria).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label className="text-sm font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
                <div className="px-2">
                  <Slider
                    value={[value]}
                    onValueChange={([newValue]) => 
                      setComparisonCriteria(prev => ({ ...prev, [key]: newValue }))
                    }
                    max={50}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">{value}%</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Total Weight: {Object.values(comparisonCriteria).reduce((a, b) => a + b, 0)}%
          </div>
        </CardContent>
      </Card>

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-48" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bestOffer">Best Overall Offer</SelectItem>
              <SelectItem value="lowestEMI">Lowest EMI</SelectItem>
              <SelectItem value="lowestRate">Lowest Interest Rate</SelectItem>
              <SelectItem value="highestApproval">Highest Approval Chance</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterBy.rateType} onValueChange={(value) => 
            setFilterBy(prev => ({ ...prev, rateType: value }))
          }>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rates</SelectItem>
              <SelectItem value="fixed">Fixed Rate</SelectItem>
              <SelectItem value="floating">Floating Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            data-testid="button-card-view"
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            data-testid="button-table-view"
          >
            Table
          </Button>
        </div>
      </div>

      {/* Selected Offers Summary */}
      {selectedOffers.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200">
              Selected for Comparison ({selectedOffers.length}/4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedOffersData.map(offer => (
                <Badge key={offer.id} variant="secondary" className="flex items-center gap-1">
                  {offer.providerName} - {offer.interestRate}%
                  <button
                    onClick={() => handleOfferSelection(offer.id)}
                    className="ml-1 text-red-500 hover:text-red-700 dark:text-red-300"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="offers" className="space-y-4">
        <ScrollableTabsList>
          <TabsTrigger value="offers">Available Offers</TabsTrigger>
          <TabsTrigger value="comparison">Side-by-Side Comparison</TabsTrigger>
          <TabsTrigger value="analytics">Visual Analytics</TabsTrigger>
        </ScrollableTabsList>

        {/* Available Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-5/6"></div>
                      <div className="h-8 bg-muted rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOffers.map((offer, index) => (
                <Card 
                  key={offer.id} 
                  className={`relative cursor-pointer transition-all duration-200 ${
                    selectedOffers.includes(offer.id) 
                      ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                      : 'hover:shadow-lg'
                  } ${index === 0 ? 'border-green-500 border-2' : ''}`}
                  onClick={() => handleOfferSelection(offer.id)}
                  data-testid={`card-offer-${offer.id}`}
                >
                  {index === 0 && (
                    <div className="absolute -top-2 left-4 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                      <Award className="h-3 w-3 inline mr-1" />
                      Best Offer
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{offer.providerName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{offer.productName}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{offer.providerRating}</span>
                        </div>
                        {offer.comparisonScore && (
                          <Badge variant="secondary" className="mt-1">
                            Score: {offer.comparisonScore}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="text-lg font-bold text-blue-600">{offer.interestRate}%</p>
                        <Badge variant={offer.rateType === 'fixed' ? 'default' : 'secondary'}>
                          {offer.rateType}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly EMI</p>
                        <p className="text-lg font-bold">₹{offer.emi.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Processing Fee</p>
                        <p className="font-medium">₹{offer.processingFee.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Cost</p>
                        <p className="font-medium">₹{offer.totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Approval Probability</span>
                        <span className="font-medium">{offer.approvalProbability}%</span>
                      </div>
                      <Progress value={offer.approvalProbability} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {offer.responseTime}
                      </div>
                      <Button 
                        size="sm" 
                        variant={selectedOffers.includes(offer.id) ? "secondary" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOfferSelection(offer.id);
                        }}
                        data-testid={`button-select-${offer.id}`}
                      >
                        {selectedOffers.includes(offer.id) ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        {selectedOffers.includes(offer.id) ? 'Selected' : 'Compare'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Side-by-Side Comparison Tab */}
        <TabsContent value="comparison">
          {selectedOffersData.length < 2 ? (
            <Card>
              <CardContent className="text-center py-12">
                <GitCompare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select Offers to Compare</h3>
                <p className="text-muted-foreground">Choose at least 2 offers from the available offers tab to see detailed comparison</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Comparison Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparison Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Parameter</th>
                          {selectedOffersData.map(offer => (
                            <th key={offer.id} className="text-center py-2 px-4 min-w-32">
                              {offer.providerName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Interest Rate', key: 'interestRate', suffix: '%', type: 'lower-better' },
                          { label: 'APR (True Rate)', key: 'apr', suffix: '%', type: 'lower-better' },
                          { label: 'Monthly EMI', key: 'emi', prefix: '₹', type: 'lower-better' },
                          { label: 'Processing Fee', key: 'processingFee', prefix: '₹', type: 'lower-better' },
                          { label: 'Total Interest', key: 'totalInterest', prefix: '₹', type: 'lower-better' },
                          { label: 'Total Cost', key: 'totalCost', prefix: '₹', type: 'lower-better' },
                          { label: 'Approval Probability', key: 'approvalProbability', suffix: '%', type: 'higher-better' },
                          { label: 'Provider Rating', key: 'providerRating', suffix: '/5', type: 'higher-better' },
                          { label: 'Response Time', key: 'responseTime', type: 'neutral' }
                        ].map(param => {
                          const values = selectedOffersData.map(offer => offer[param.key as keyof LoanOffer] as number | string);
                          const numericValues = values.filter(v => typeof v === 'number') as number[];
                          const bestValue = param.type === 'lower-better' 
                            ? Math.min(...numericValues)
                            : param.type === 'higher-better'
                            ? Math.max(...numericValues)
                            : null;

                          return (
                            <tr key={param.key} className="border-b">
                              <td className="py-3 px-4 font-medium">{param.label}</td>
                              {selectedOffersData.map(offer => {
                                const value = offer[param.key as keyof LoanOffer];
                                const isNumeric = typeof value === 'number';
                                const isBest = isNumeric && bestValue !== null && value === bestValue;
                                
                                return (
                                  <td key={offer.id} className={`text-center py-3 px-4 ${isBest ? 'bg-green-100 dark:bg-green-900/30 font-bold text-green-800 dark:text-green-200' : ''}`}>
                                    {param.prefix}{typeof value === 'number' ? value.toLocaleString() : value}{param.suffix}
                                    {isBest && <span className="ml-1">🏆</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Visual Analytics Tab */}
        <TabsContent value="analytics">
          {selectedOffersData.length < 2 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select Offers for Analytics</h3>
                <p className="text-muted-foreground">Choose at least 2 offers to see visual comparisons and analytics</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>EMI vs Interest Rate Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="provider" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="EMI" fill="#3b82f6" name="Monthly EMI (₹)" />
                        <Bar dataKey="Interest Rate" fill="#ef4444" name="Interest Rate (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cost Breakdown - Best Offer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Comparison Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Comparison Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="provider" type="category" />
                      <Tooltip />
                      <Bar dataKey="Score" fill="#10b981" name="Comparison Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}