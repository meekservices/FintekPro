import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Home, Car, User, Building2, Calculator, Clock, CheckCircle, IndianRupee, GraduationCap, Star, TrendingUp, Shield, RefreshCw, Search, Filter, ArrowRight, Plus, GitCompare, Target, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

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

export default function Loans() {
  const [activeTab, setActiveTab] = useState("marketplace");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [isGeneratingOffers, setIsGeneratingOffers] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string>("");
  
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
      setOffers(offersResponse.data || []);
      setActiveTab("compare");
      
      toast({
        title: "Offers Generated",
        description: `Found ${offersResponse.data?.length || 0} loan offers for you!`,
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
      vehicle: Car,
      business: Building2,
      education: GraduationCap,
      securities: IndianRupee,
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
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const toggleOfferSelection = (offerId: string) => {
    setSelectedOffers(prev => 
      prev.includes(offerId) 
        ? prev.filter(id => id !== offerId)
        : [...prev, offerId]
    );
  };

  return (
    <div className="space-y-8" data-testid="loan-marketplace">
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Loan Marketplace</h1>
          <p className="text-xl text-gray-600">Compare loan offers from multiple banks and NBFCs</p>
          <div className="flex justify-center gap-6 text-sm text-gray-500">
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="marketplace" data-testid="tab-marketplace">Find Loans</TabsTrigger>
            <TabsTrigger value="request" data-testid="tab-request">Get Offers</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">Compare Offers</TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">My Applications</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">EMI Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="space-y-6" data-testid="marketplace-content">
            {/* Marketplace Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {loanProviders?.data?.length || 0}
                      </p>
                      <p className="text-sm text-gray-600">Partner Lenders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">8.5%</p>
                      <p className="text-sm text-gray-600">Starting Interest Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">24h</p>
                      <p className="text-sm text-gray-600">Quick Approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Loan Products */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Loan Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg mb-4"></div>
                        <div className="h-6 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded mb-4"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded"></div>
                          <div className="h-3 bg-gray-200 rounded"></div>
                          <div className="h-3 bg-gray-200 rounded"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  loanProducts?.data?.map((product: any, index: number) => {
                    const IconComponent = getIcon(product.key);
                    return (
                      <Card 
                        key={product.id}
                        className="hover:shadow-md transition-shadow cursor-pointer group"
                        data-testid={`product-${product.key}`}
                      >
                        <CardContent className="p-6">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-blue-100">
                            <IconComponent className="h-6 w-6 text-blue-600" />
                          </div>
                          <h3 className="font-bold text-gray-900 mb-2">{product.name}</h3>
                          <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                          
                          <div className="space-y-2 text-xs text-gray-600 mb-4">
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
                              <span className="font-semibold">{product.minTenure} - {product.maxTenure} years</span>
                            </div>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
                            onClick={() => {
                              setSelectedProduct(product.key);
                              form.setValue("productKey", product.key);
                              setActiveTab("request");
                            }}
                            data-testid={`select-${product.key}`}
                          >
                            Get Offers
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

            {/* Provider Network */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Partner Network</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loanProviders?.data?.slice(0, 8).map((provider: any) => (
                  <Card key={provider.id} className="p-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-600" />
                      </div>
                      <p className="font-semibold text-sm">{provider.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-gray-600">{provider.rating || "4.5"}</span>
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
                <p className="text-gray-600">
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
                                  <SelectItem key={product.id} value={product.key}>
                                    {product.name}
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
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GitCompare className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Offers Yet</h3>
                  <p className="text-gray-500 text-center mb-4">
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
                    <h2 className="text-2xl font-bold text-gray-900">Compare Loan Offers</h2>
                    <p className="text-gray-600">Found {offers.length} offers matching your requirements</p>
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
                            <p className="text-sm text-gray-600">{offer.productName}</p>
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
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Interest Rate</p>
                            <p className="text-2xl font-bold text-blue-600">{offer.interestRate}%</p>
                            <p className="text-xs text-gray-500">per annum</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Monthly EMI</p>
                              <p className="font-semibold">{formatCurrency(offer.monthlyEmi)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Processing Fee</p>
                              <p className="font-semibold">{offer.processingFee}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Total Interest</p>
                              <p className="font-semibold text-red-600">{formatCurrency(offer.totalInterest)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Response Time</p>
                              <p className="font-semibold">{offer.responseTime}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm text-gray-600 mb-2">Key Features</p>
                            <div className="space-y-1">
                              {offer.features.slice(0, 3).map((feature, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-6" data-testid="applications-content">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h2>
              
              {!applications?.data || applications.data.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Yet</h3>
                    <p className="text-gray-500 text-center mb-4">
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
                            <p className="text-gray-600">
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
                            <p className="text-gray-600">Interest Rate</p>
                            <p className="font-semibold">{application.interestRate}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Tenure</p>
                            <p className="font-semibold">{application.tenure} years</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Monthly EMI</p>
                            <p className="font-semibold">{formatCurrency(application.monthlyEmi)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Application ID</p>
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
                <p className="text-gray-600">
                  Calculate your monthly EMI for any loan amount
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Loan Amount (₹)
                      </label>
                      <Input 
                        type="number" 
                        placeholder="5,00,000" 
                        data-testid="calc-amount"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Interest Rate (% per annum)
                      </label>
                      <Input 
                        type="number" 
                        placeholder="10.5" 
                        data-testid="calc-rate"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Loan Tenure (Years)
                      </label>
                      <Input 
                        type="number" 
                        placeholder="5" 
                        data-testid="calc-tenure"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Monthly EMI</h3>
                      <p className="text-3xl font-bold text-blue-600" data-testid="calc-emi">
                        ₹0
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700">Principal Amount</h4>
                        <p className="text-lg font-bold text-green-600" data-testid="calc-principal">
                          ₹0
                        </p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700">Total Interest</h4>
                        <p className="text-lg font-bold text-red-600" data-testid="calc-interest">
                          ₹0
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700">Total Amount</h4>
                        <p className="text-lg font-bold text-purple-600" data-testid="calc-total">
                          ₹0
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}