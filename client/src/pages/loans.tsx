import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { LoadingState } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Home, Car, User, Building2, Calculator, Clock, CheckCircle, IndianRupee, GraduationCap, Star, TrendingUp, Shield, RefreshCw, Search, Filter, ArrowRight, Plus, GitCompare, Target, Zap, FileText, ExternalLink, Info, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

// Marketplace schemas for form validation
const loanRequestSchema = z.object({
  productKey: z.string().min(1, "Please select a loan product"),
  amount: z.number().min(50000, "Minimum amount is ₹50,000").max(100000000, "Maximum amount is ₹10 Crores"),
  tenure: z.number().min(1, "Minimum tenure is 1 year").max(30, "Maximum tenure is 30 years"),
  purpose: z.string().min(3, "Purpose is required"),
  monthlyIncome: z.number().min(10000, "Minimum monthly income is ₹10,000"),
  employmentType: z.enum(["salaried", "self_employed", "business_owner", "professional"]),
  creditScore: z.number().min(300).max(850).optional(),
});

type LoanRequestFormData = z.infer<typeof loanRequestSchema>;

interface LoanOffer {
  id: string;
  providerId: string;
  providerName: string;
  productName: string;
  interestRate: number;
  processingFee: number;
  amount: number;
  tenure: number;
  monthlyEmi: number;
  totalInterest: number;
  totalAmount: number;
  features: string[];
  eligibilityScore: number;
  approvalProbability: number;
  responseTime: string;
  status: string;
  kfsUrl?: string;
  apr?: number;
  prepaymentCharges?: string;
  latePaymentFee?: string;
  insuranceCharges?: string;
  otherCharges?: { name: string; amount: string }[];
  regulator?: string;
  licenseNumber?: string;
}

interface CreditProfile {
  id: string;
  userId: string;
  annualIncome: number;
  monthlyIncome: number;
  employmentType: string;
  workExperience: number;
  creditScore?: number;
  existingLoans: number;
  existingEMI: number;
}

interface EMICalculation {
  emi: number;
  totalPayment: number;
  totalInterest: number;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  schedule: { month: number; emi: number; principal: number; interest: number; balance: number }[];
}

export default function Loans() {
  const [activeTab, setActiveTab] = useState("marketplace");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [isGeneratingOffers, setIsGeneratingOffers] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string>("");
  
  const [calcAmount, setCalcAmount] = useState<number>(500000);
  const [calcRate, setCalcRate] = useState<number>(10.5);
  const [calcTenure, setCalcTenure] = useState<number>(5);
  const [emiResult, setEmiResult] = useState<EMICalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<LoanRequestFormData>({
    resolver: zodResolver(loanRequestSchema),
    defaultValues: {
      productKey: "",
      amount: 500000,
      tenure: 5,
      purpose: "",
      monthlyIncome: 50000,
      employmentType: "salaried",
      creditScore: 750,
    },
  });

  // Fetch marketplace data
  const { data: loanProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/marketplace/loan-products"],
  });

  const { data: loanProviders } = useQuery({
    queryKey: ["/api/marketplace/loan-providers"],
  });

  const { data: creditProfile } = useQuery({
    queryKey: ["/api/marketplace/credit-profile"],
  });

  const { data: myRequests } = useQuery({
    queryKey: ["/api/marketplace/my-requests"],
  });

  const { data: applications } = useQuery({
    queryKey: ["/api/marketplace/applications"],
  });

  // Mutations
  const createLoanRequestMutation = useMutation({
    mutationFn: async (data: LoanRequestFormData) => {
      const response = await fetch("/api/marketplace/loan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create loan request");
      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "Loan Request Created",
        description: "Your loan request has been saved. Now generating offers...",
      });
      setLastRequestId(response.data.id);
      generateOffers(response.data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-requests"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create loan request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateOffers = async (requestId: string) => {
    setIsGeneratingOffers(true);
    try {
      const response = await fetch(`/api/marketplace/loan-requests/${requestId}/generate-offers`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to generate offers");
      
      const offersResponse = await response.json();
      const generatedOffers = offersResponse.data || [];
      setOffers(generatedOffers);
      setActiveTab("compare");
      
      const borderlineOffers = generatedOffers.filter(
        (o: LoanOffer) => o.eligibilityScore >= 40 && o.eligibilityScore < 70
      );
      
      if (borderlineOffers.length > 0 || generatedOffers.length === 0) {
        try {
          await fetch("/api/loans/background-routing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              requestId,
              reason: generatedOffers.length === 0 ? 'borderline_credit' : 'income_edge',
            }),
          });
        } catch (bgError) {
          console.log("Background routing initiated for additional offers");
        }
      }
      
      toast({
        title: "Offers Generated",
        description: `Found ${generatedOffers.length} loan offers for you!`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate offers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingOffers(false);
    }
  };

  const applyForLoan = async (offerId: string) => {
    try {
      const offer = offers.find(o => o.id === offerId);
      if (!offer) return;

      const response = await fetch("/api/marketplace/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: lastRequestId,
          offerId: offerId,
          providerId: offer.providerId,
          amount: offer.amount,
          interestRate: offer.interestRate,
          tenure: offer.tenure,
          monthlyEmi: offer.monthlyEmi,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to submit application");
      
      toast({
        title: "Application Submitted",
        description: `Your application to ${offer.providerName} has been submitted successfully!`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/applications"] });
      setActiveTab("applications");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: LoanRequestFormData) => {
    createLoanRequestMutation.mutate(data);
  };

  const getIcon = (productKey: string) => {
    const icons = {
      personal: User,
      home: Home,
      car: Car,
      vehicle: Car,
      business: Building2,
      education: GraduationCap,
      gold: Star,
      securities: TrendingUp,
      lap: Building2,
    };
    return icons[productKey as keyof typeof icons] || User;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100 dark:bg-green-900/30";
    if (score >= 60) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
    return "text-red-600 bg-red-100 dark:bg-red-900/30";
  };

  const toggleOfferSelection = (offerId: string) => {
    setSelectedOffers(prev => 
      prev.includes(offerId) 
        ? prev.filter(id => id !== offerId)
        : [...prev, offerId]
    );
  };

  const calculateEMI = useCallback(async () => {
    if (calcAmount <= 0 || calcRate <= 0 || calcTenure <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid values for amount, rate, and tenure.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    try {
      const response = await fetch("/api/marketplace/emi-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal: calcAmount,
          annualRate: calcRate,
          tenureMonths: calcTenure * 12,
        }),
      });

      if (!response.ok) throw new Error("Failed to calculate EMI");
      
      const result = await response.json();
      if (result.success) {
        setEmiResult(result.data);
      }
    } catch (error) {
      toast({
        title: "Calculation Error",
        description: "Failed to calculate EMI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  }, [calcAmount, calcRate, calcTenure, toast]);

  useEffect(() => {
    if (activeTab === "calculator" && calcAmount > 0 && calcRate > 0 && calcTenure > 0) {
      const timer = setTimeout(() => {
        calculateEMI();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [calcAmount, calcRate, calcTenure, activeTab, calculateEMI]);

  return (
    <div className="space-y-8" data-testid="loan-marketplace">
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Loan Marketplace</h1>
          <p className="text-xl text-muted-foreground">Compare loan offers from multiple banks and NBFCs</p>
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Secure & Transparent</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Instant Offers</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>Best Rates</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <ScrollableTabsList>
            <TabsTrigger value="marketplace" data-testid="tab-marketplace" className="flex-shrink-0">Find Loans</TabsTrigger>
            <TabsTrigger value="request" data-testid="tab-request" className="flex-shrink-0">Get Offers</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare" className="flex-shrink-0">Compare Offers</TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications" className="flex-shrink-0">My Applications</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator" className="flex-shrink-0">EMI Calculator</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="marketplace" className="space-y-6" data-testid="marketplace-content">
            {/* Marketplace Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {loanProviders?.data?.length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Partner Lenders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">8.5%</p>
                      <p className="text-sm text-muted-foreground">Starting Interest Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Clock className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">24h</p>
                      <p className="text-sm text-muted-foreground">Quick Approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Loan Products */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">Available Loan Products</h2>
              {productsLoading ? (
                <LoadingState variant="card" count={6} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loanProducts?.data?.map((product: any, index: number) => {
                    const productKey = product.productKey || product.key;
                    const IconComponent = getIcon(productKey);
                    return (
                      <Card 
                        key={product.id || productKey}
                        className="hover:shadow-md transition-shadow cursor-pointer group"
                        data-testid={`product-${productKey}`}
                      >
                        <CardContent className="p-6">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-blue-100 dark:bg-blue-900/30">
                            <IconComponent className="h-6 w-6 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-1">{product.productName || product.name || 'Loan Product'}</h3>
                          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{product.description}</p>
                          
                          <div className="space-y-2 text-xs text-muted-foreground mb-4">
                            <div className="flex justify-between">
                              <span>Rate Range:</span>
                              <span className="font-semibold text-green-600">
                                {product.minInterestRate}% - {product.maxInterestRate}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Amount:</span>
                              <span className="font-semibold">
                                {formatCurrency(product.minAmount)} - {formatCurrency(product.maxAmount)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tenure:</span>
                              <span className="font-semibold">{Math.round(product.minTenure / 12)} - {Math.round(product.maxTenure / 12)} years</span>
                            </div>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
                            onClick={() => {
                              setSelectedProduct(productKey);
                              form.setValue("productKey", productKey);
                              setActiveTab("request");
                            }}
                            data-testid={`select-${productKey}`}
                          >
                            Get Offers
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Provider Network */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">Our Partner Network</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loanProviders?.data?.slice(0, 8).map((provider: any, index: number) => (
                  <Card key={provider.id || `provider-${index}`} className="p-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-semibold text-sm">{provider.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-muted-foreground">{provider.rating || "4.5"}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="request" className="space-y-6" data-testid="request-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Tell us what you need
                </CardTitle>
                <p className="text-muted-foreground">
                  Fill in your requirements and we'll find the best loan offers for you
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="productKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Product</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="product-select">
                                  <SelectValue placeholder="Select loan product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loanProducts?.data?.map((product: any) => (
                                  <SelectItem key={product.id || product.productKey} value={product.productKey || product.key}>
                                    {product.productName || product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Amount (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="5,00,000"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                data-testid="amount-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tenure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Tenure (Years)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="5"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                data-testid="tenure-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="monthlyIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Income (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="50,000"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                data-testid="income-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="employmentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employment Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="employment-select">
                                  <SelectValue placeholder="Select employment type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="salaried">Salaried</SelectItem>
                                <SelectItem value="self_employed">Self Employed</SelectItem>
                                <SelectItem value="business_owner">Business Owner</SelectItem>
                                <SelectItem value="professional">Professional</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="creditScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Score (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="750"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                                data-testid="credit-score-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loan Purpose</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Home renovation, Business expansion"
                              {...field}
                              data-testid="purpose-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createLoanRequestMutation.isPending || isGeneratingOffers}
                      data-testid="generate-offers-btn"
                    >
                      {createLoanRequestMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creating Request...
                        </>
                      ) : isGeneratingOffers ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating Offers...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Find Best Offers
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare" className="space-y-6" data-testid="compare-content">
            {offers.length === 0 ? (
              <Card className="border-dashed border-2 border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Offers Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Submit a loan request to see personalized offers from multiple lenders
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("request")}
                    data-testid="goto-request-btn"
                  >
                    Get Loan Offers
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Compare Loan Offers</h2>
                    <p className="text-muted-foreground">Found {offers.length} offers matching your requirements</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedOffers.length > 0 && (
                      <Badge variant="secondary">
                        {selectedOffers.length} selected for comparison
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {offers.map((offer) => (
                    <Card 
                      key={offer.id} 
                      className={`relative hover:shadow-lg transition-shadow ${
                        selectedOffers.includes(offer.id) ? 'ring-2 ring-blue-500' : ''
                      }`}
                      data-testid={`offer-${offer.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{offer.providerName}</CardTitle>
                            <p className="text-sm text-muted-foreground">{offer.productName}</p>
                          </div>
                          <div className="text-right">
                            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getRiskColor(offer.approvalProbability)}`}>
                              {offer.approvalProbability}% Match
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <p className="text-sm text-muted-foreground">Interest Rate</p>
                            <p className="text-2xl font-bold text-blue-600">{offer.interestRate}%</p>
                            <p className="text-xs text-muted-foreground">per annum</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Monthly EMI</p>
                              <p className="font-semibold">{formatCurrency(offer.monthlyEmi)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Processing Fee</p>
                              <p className="font-semibold">{offer.processingFee}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Interest</p>
                              <p className="font-semibold text-red-600">{formatCurrency(offer.totalInterest)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Response Time</p>
                              <p className="font-semibold">{offer.responseTime}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Key Features</p>
                            <div className="space-y-1">
                              {offer.features.slice(0, 3).map((feature, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* RBI Mandated KFS Link */}
                          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">Key Facts Statement (KFS)</span>
                            </div>
                            <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                              <div className="flex justify-between">
                                <span>APR (All-in Cost):</span>
                                <span className="font-semibold">{offer.apr || (offer.interestRate + 0.5).toFixed(2)}%</span>
                              </div>
                              {offer.prepaymentCharges && (
                                <div className="flex justify-between">
                                  <span>Prepayment:</span>
                                  <span>{offer.prepaymentCharges}</span>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-2 text-blue-600"
                              onClick={() => {
                              const kfsUrl = offer.kfsUrl || `/api/loans/kfs/${offer.id}?amount=${offer.amount}&tenure=${offer.tenure}&rate=${offer.interestRate}&provider=${encodeURIComponent(offer.providerName || 'Partner Lender')}&fee=${offer.processingFee}`;
                              window.open(kfsUrl, '_blank');
                            }}
                              data-testid={`kfs-${offer.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Full KFS Document
                            </Button>
                          </div>

                          <div className="pt-2 space-y-2">
                            <Button
                              className="w-full"
                              onClick={() => applyForLoan(offer.id)}
                              data-testid={`apply-${offer.id}`}
                            >
                              Apply Now
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => toggleOfferSelection(offer.id)}
                              data-testid={`compare-${offer.id}`}
                            >
                              {selectedOffers.includes(offer.id) ? 
                                'Remove from Compare' : 
                                'Add to Compare'
                              }
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Interactive Side-by-Side Comparison Table */}
                {selectedOffers.length >= 2 && (
                  <Card className="mt-8">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl">Side-by-Side Comparison</CardTitle>
                          <p className="text-muted-foreground">Compare selected offers in detail</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOffers([])}
                            data-testid="clear-comparison"
                          >
                            Clear All
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const bestOffer = selectedOffers.map(id => offers.find(o => o.id === id))
                                .filter(Boolean)
                                .sort((a, b) => a!.interestRate - b!.interestRate)[0];
                              if (bestOffer) applyForLoan(bestOffer.id);
                            }}
                            data-testid="apply-best-offer"
                          >
                            Apply to Best Offer
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-2 font-medium text-foreground">Criteria</th>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                return offer ? (
                                  <th key={offerId} className="text-center py-3 px-4 min-w-[200px]" data-testid={`comparison-header-${offerId}`}>
                                    <div className="space-y-1">
                                      <div className="font-semibold text-foreground">{offer.providerName}</div>
                                      <div className="text-xs text-muted-foreground">{offer.productName}</div>
                                      <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getRiskColor(offer.approvalProbability)}`}>
                                        {offer.approvalProbability}% Match
                                      </div>
                                    </div>
                                  </th>
                                ) : null;
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Interest Rate Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Interest Rate</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                const bestRate = Math.min(...selectedOffers.map(id => offers.find(o => o.id === id)?.interestRate || Infinity));
                                const isBest = offer.interestRate === bestRate;
                                return (
                                  <td key={offerId} className={`py-4 px-4 text-center ${isBest ? 'bg-green-50 dark:bg-green-950/30' : ''}`} data-testid={`rate-${offerId}`}>
                                    <div className={`text-xl font-bold ${isBest ? 'text-green-600' : 'text-foreground'}`}>
                                      {offer.interestRate}%
                                    </div>
                                    {isBest && <div className="text-xs text-green-600 font-medium">LOWEST</div>}
                                    <div className="text-xs text-muted-foreground">per annum</div>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Monthly EMI Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Monthly EMI</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                const lowestEmi = Math.min(...selectedOffers.map(id => offers.find(o => o.id === id)?.monthlyEmi || Infinity));
                                const isBest = offer.monthlyEmi === lowestEmi;
                                return (
                                  <td key={offerId} className={`py-4 px-4 text-center ${isBest ? 'bg-green-50 dark:bg-green-950/30' : ''}`} data-testid={`emi-${offerId}`}>
                                    <div className={`text-lg font-semibold ${isBest ? 'text-green-600' : 'text-foreground'}`}>
                                      {formatCurrency(offer.monthlyEmi)}
                                    </div>
                                    {isBest && <div className="text-xs text-green-600 font-medium">LOWEST</div>}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Processing Fee Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Processing Fee</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                const lowestFee = Math.min(...selectedOffers.map(id => offers.find(o => o.id === id)?.processingFee || Infinity));
                                const isBest = offer.processingFee === lowestFee;
                                return (
                                  <td key={offerId} className={`py-4 px-4 text-center ${isBest ? 'bg-green-50 dark:bg-green-950/30' : ''}`} data-testid={`fee-${offerId}`}>
                                    <div className={`text-lg font-semibold ${isBest ? 'text-green-600' : 'text-foreground'}`}>
                                      {offer.processingFee}%
                                    </div>
                                    {isBest && <div className="text-xs text-green-600 font-medium">LOWEST</div>}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Total Interest Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Total Interest</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                const lowestInterest = Math.min(...selectedOffers.map(id => offers.find(o => o.id === id)?.totalInterest || Infinity));
                                const isBest = offer.totalInterest === lowestInterest;
                                return (
                                  <td key={offerId} className={`py-4 px-4 text-center ${isBest ? 'bg-green-50 dark:bg-green-950/30' : ''}`} data-testid={`total-interest-${offerId}`}>
                                    <div className={`text-lg font-semibold ${isBest ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(offer.totalInterest)}
                                    </div>
                                    {isBest && <div className="text-xs text-green-600 font-medium">LOWEST</div>}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Response Time Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Response Time</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                return (
                                  <td key={offerId} className="py-4 px-4 text-center" data-testid={`response-time-${offerId}`}>
                                    <div className="text-lg font-semibold text-foreground">
                                      {offer.responseTime}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Tenure Options Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Tenure Options</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                return (
                                  <td key={offerId} className="py-4 px-4 text-center" data-testid={`tenure-${offerId}`}>
                                    <div className="text-sm text-muted-foreground">
                                      {Math.round(offer.minTenure / 12)} - {Math.round(offer.maxTenure / 12)} years
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Key Features Row */}
                            <tr className="border-b hover:bg-muted">
                              <td className="py-4 px-2 font-medium text-foreground">Key Features</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                return (
                                  <td key={offerId} className="py-4 px-4" data-testid={`features-${offerId}`}>
                                    <div className="space-y-1">
                                      {offer.features.slice(0, 4).map((feature, index) => (
                                        <div key={index} className="flex items-center gap-1 text-xs">
                                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                          <span className="text-left">{feature}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Action Buttons Row */}
                            <tr>
                              <td className="py-4 px-2 font-medium text-foreground">Actions</td>
                              {selectedOffers.map((offerId) => {
                                const offer = offers.find(o => o.id === offerId);
                                if (!offer) return null;
                                return (
                                  <td key={offerId} className="py-4 px-4" data-testid={`actions-${offerId}`}>
                                    <div className="space-y-2">
                                      <Button
                                        className="w-full"
                                        onClick={() => applyForLoan(offer.id)}
                                        data-testid={`comparison-apply-${offerId}`}
                                      >
                                        Apply Now
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => toggleOfferSelection(offer.id)}
                                        data-testid={`comparison-remove-${offerId}`}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Comparison Insights */}
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">Comparison Insights</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          {(() => {
                            const selectedOfferData = selectedOffers.map(id => offers.find(o => o.id === id)).filter(Boolean);
                            const bestRate = Math.min(...selectedOfferData.map(o => o!.interestRate));
                            const worstRate = Math.max(...selectedOfferData.map(o => o!.interestRate));
                            const bestEmi = Math.min(...selectedOfferData.map(o => o!.monthlyEmi));
                            const worstEmi = Math.max(...selectedOfferData.map(o => o!.monthlyEmi));
                            const rateDifference = worstRate - bestRate;
                            const emiDifference = worstEmi - bestEmi;
                            const bestRateOffer = selectedOfferData.find(o => o!.interestRate === bestRate);
                            
                            return (
                              <>
                                <div className="space-y-1">
                                  <p className="text-blue-800 dark:text-blue-200 font-medium">Rate Difference</p>
                                  <p className="text-blue-600">{rateDifference.toFixed(2)}% spread</p>
                                  <p className="text-xs text-blue-600">Best: {bestRate}% | Worst: {worstRate}%</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-blue-800 dark:text-blue-200 font-medium">EMI Difference</p>
                                  <p className="text-blue-600">{formatCurrency(emiDifference)} monthly</p>
                                  <p className="text-xs text-blue-600">{formatCurrency(emiDifference * 12)} annually</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-blue-800 dark:text-blue-200 font-medium">Best Overall</p>
                                  <p className="text-blue-600 font-semibold">{bestRateOffer?.providerName}</p>
                                  <p className="text-xs text-blue-600">Lowest rate & competitive terms</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-6" data-testid="applications-content">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">My Applications</h2>
              
              {!applications?.data || applications.data.length === 0 ? (
                <Card className="border-dashed border-2 border-border">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Applications Yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Your loan applications will appear here
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("marketplace")}
                      data-testid="start-application-btn"
                    >
                      Start New Application
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {applications.data.map((application: any) => (
                    <Card key={application.id} data-testid={`application-${application.id}`}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {application.providerId} - {application.amount && formatCurrency(application.amount)}
                            </h3>
                            <p className="text-muted-foreground">
                              Applied on {new Date(application.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              application.status === 'approved' ? 'default' :
                              application.status === 'rejected' ? 'destructive' :
                              application.status === 'processing' ? 'secondary' : 'outline'
                            }
                          >
                            {application.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Interest Rate</p>
                            <p className="font-semibold">{application.interestRate}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tenure</p>
                            <p className="font-semibold">{application.tenure} years</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Monthly EMI</p>
                            <p className="font-semibold">{formatCurrency(application.monthlyEmi)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Application ID</p>
                            <p className="font-mono text-xs">{application.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calculator" className="space-y-6" data-testid="calculator-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  EMI Calculator
                </CardTitle>
                <p className="text-muted-foreground">
                  Calculate your monthly EMI for any loan amount with full amortization schedule
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Loan Amount (₹)
                      </label>
                      <Input 
                        type="number" 
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(Number(e.target.value))}
                        placeholder="5,00,000" 
                        data-testid="calc-amount"
                      />
                      <div className="flex gap-2 mt-2">
                        {[500000, 1000000, 2500000, 5000000].map((amt) => (
                          <Button 
                            key={amt}
                            variant="outline" 
                            size="sm"
                            onClick={() => setCalcAmount(amt)}
                            className="text-xs"
                          >
                            {formatCurrency(amt)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Interest Rate (% per annum)
                      </label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={calcRate}
                        onChange={(e) => setCalcRate(Number(e.target.value))}
                        placeholder="10.5" 
                        data-testid="calc-rate"
                      />
                      <div className="flex gap-2 mt-2">
                        {[8.5, 10.5, 12, 14].map((rate) => (
                          <Button 
                            key={rate}
                            variant="outline" 
                            size="sm"
                            onClick={() => setCalcRate(rate)}
                            className="text-xs"
                          >
                            {rate}%
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Loan Tenure (Years)
                      </label>
                      <Input 
                        type="number" 
                        value={calcTenure}
                        onChange={(e) => setCalcTenure(Number(e.target.value))}
                        placeholder="5" 
                        data-testid="calc-tenure"
                      />
                      <div className="flex gap-2 mt-2">
                        {[1, 3, 5, 10, 20].map((tenure) => (
                          <Button 
                            key={tenure}
                            variant="outline" 
                            size="sm"
                            onClick={() => setCalcTenure(tenure)}
                            className="text-xs"
                          >
                            {tenure}Y
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={calculateEMI}
                      disabled={isCalculating}
                      className="w-full"
                      data-testid="calc-button"
                    >
                      {isCalculating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="h-4 w-4 mr-2" />
                          Calculate EMI
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div className="text-center p-6 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Monthly EMI</h3>
                      <p className="text-3xl font-bold text-blue-600" data-testid="calc-emi">
                        {emiResult ? formatCurrency(emiResult.emi) : '₹0'}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground">Principal Amount</h4>
                        <p className="text-lg font-bold text-green-600" data-testid="calc-principal">
                          {emiResult ? formatCurrency(emiResult.principal) : '₹0'}
                        </p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground">Total Interest</h4>
                        <p className="text-lg font-bold text-red-600" data-testid="calc-interest">
                          {emiResult ? formatCurrency(emiResult.totalInterest) : '₹0'}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground">Total Amount Payable</h4>
                        <p className="text-lg font-bold text-purple-600" data-testid="calc-total">
                          {emiResult ? formatCurrency(emiResult.totalPayment) : '₹0'}
                        </p>
                      </div>
                    </div>

                    {emiResult && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowSchedule(!showSchedule)}
                        data-testid="toggle-schedule"
                      >
                        {showSchedule ? 'Hide' : 'Show'} Amortization Schedule
                      </Button>
                    )}
                  </div>
                </div>

                {showSchedule && emiResult && emiResult.schedule.length > 0 && (
                  <div className="mt-8 border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-3 border-b">
                      <h4 className="font-semibold">Amortization Schedule ({emiResult.schedule.length} months)</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-4 font-medium">Month</th>
                            <th className="text-right py-2 px-4 font-medium">EMI</th>
                            <th className="text-right py-2 px-4 font-medium">Principal</th>
                            <th className="text-right py-2 px-4 font-medium">Interest</th>
                            <th className="text-right py-2 px-4 font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emiResult.schedule.map((row) => (
                            <tr key={row.month} className="border-t hover:bg-muted">
                              <td className="py-2 px-4">{row.month}</td>
                              <td className="py-2 px-4 text-right">{formatCurrency(row.emi)}</td>
                              <td className="py-2 px-4 text-right text-green-600">{formatCurrency(row.principal)}</td>
                              <td className="py-2 px-4 text-right text-red-600">{formatCurrency(row.interest)}</td>
                              <td className="py-2 px-4 text-right font-medium">{formatCurrency(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* RBI Digital Lending Directions 2025 Compliance Footer */}
        <Card className="mt-8 bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-orange-50 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Info className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">RBI Digital Lending Disclosure</h3>
                  <p className="text-sm text-muted-foreground">
                    As per RBI Digital Lending Directions 2025, we are committed to transparent and unbiased loan offer presentation.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      Ranking Methodology
                    </h4>
                    <p className="text-muted-foreground">
                      Offers are ranked by: (1) Lowest APR (All-in Cost), (2) Eligibility match score based on your profile, 
                      (3) Processing time. No lender pays for preferential placement.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Key Facts Statement (KFS)
                    </h4>
                    <p className="text-muted-foreground">
                      Each offer includes a standardized KFS document with APR, fees, charges, and terms 
                      as mandated by RBI for borrower protection.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>RBI Registered LSP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>No Hidden Fees</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Unbiased Offer Display</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Data Privacy Compliant</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    <strong>Grievance Redressal:</strong> For complaints, contact our Nodal Officer at grievance@fintekpro.com 
                    or escalate to RBI Ombudsman at rbiombudsman@rbi.org.in
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}