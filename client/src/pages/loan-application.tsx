import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calculator, 
  IndianRupee, 
  TrendingUp, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Building2, 
  User, 
  CreditCard,
  FileText,
  ArrowRight,
  Star,
  Percent
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface LoanOffer {
  lenderId: string;
  lenderName: string;
  interestRate: number;
  emi: number;
  processingFee: number;
  totalAmount: number;
  tenure: number;
  eligibilityScore: number;
  specialOffers?: string[];
  validityDays: number;
  terms: string[];
}

interface LoanEligibilityResult {
  eligible: boolean;
  offers: LoanOffer[];
  reasons?: string[];
}

interface ComparisonResult {
  eligible: boolean;
  totalOffers: number;
  bestOffer: LoanOffer | null;
  allOffers: LoanOffer[];
  comparisonSummary: {
    lowestRate: number;
    highestRate: number;
    averageProcessingFee: number;
  };
}

export default function LoanApplication() {
  const [currentStep, setCurrentStep] = useState(1);
  const [eligibilityResult, setEligibilityResult] = useState<LoanEligibilityResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string>("");
  const { toast } = useToast();
  
  // Form data
  const [eligibilityForm, setEligibilityForm] = useState({
    loanType: "",
    amount: "",
    tenure: "",
    monthlyIncome: "",
    cibilScore: "",
    employmentType: "",
    age: ""
  });

  const [applicationForm, setApplicationForm] = useState({
    applicantName: "",
    email: "",
    phone: "",
    address: "",
    panNumber: "",
    occupation: "",
    purpose: "",
    existingLoans: "",
    preferredLender: ""
  });

  const [consent, setConsent] = useState({
    termsAccepted: false,
    dataProcessing: false,
    creditCheck: false
  });

  // Step 1: Eligibility Check
  const checkEligibilityMutation = useMutation({
    mutationFn: async (data: typeof eligibilityForm) => {
      const response = await fetch('/api/loans/eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    },
    onSuccess: (result) => {
      setEligibilityResult(result.data);
      if (result.data.eligible) {
        setCurrentStep(2);
        toast({
          title: "Great News!",
          description: `You're eligible for loans from ${result.data.offers.length} lenders`,
        });
      } else {
        toast({
          title: "Eligibility Check",
          description: "Unfortunately, you don't meet the eligibility criteria",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to check eligibility. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Step 2: Compare Offers
  const compareOffersMutation = useMutation({
    mutationFn: async (data: typeof eligibilityForm) => {
      const response = await fetch('/api/loans/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    },
    onSuccess: (result) => {
      setComparisonResult(result.data);
      toast({
        title: "Offers Compared",
        description: `Found ${result.data.totalOffers} loan offers for you`,
      });
    }
  });

  // Step 3: Apply for Loan
  const applyLoanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/loans/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    },
    onSuccess: (result) => {
      setApplicationStatus("submitted");
      setCurrentStep(4);
      toast({
        title: "Application Submitted!",
        description: result.data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Application Failed",
        description: "Failed to submit loan application. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEligibilityCheck = () => {
    if (!eligibilityForm.loanType || !eligibilityForm.amount || !eligibilityForm.tenure || 
        !eligibilityForm.monthlyIncome || !eligibilityForm.employmentType || !eligibilityForm.age) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    checkEligibilityMutation.mutate(eligibilityForm);
  };

  const handleCompareOffers = () => {
    compareOffersMutation.mutate(eligibilityForm);
  };

  const handleSelectOffer = (offer: LoanOffer) => {
    setSelectedOffer(offer);
    setApplicationForm(prev => ({
      ...prev,
      preferredLender: offer.lenderId
    }));
    setCurrentStep(3);
  };

  const handleSubmitApplication = () => {
    if (!selectedOffer) {
      toast({
        title: "No Offer Selected",
        description: "Please select a loan offer first",
        variant: "destructive",
      });
      return;
    }

    if (!consent.termsAccepted || !consent.dataProcessing || !consent.creditCheck) {
      toast({
        title: "Consent Required",
        description: "Please accept all required consents to proceed",
        variant: "destructive",
      });
      return;
    }

    const applicationData = {
      ...eligibilityForm,
      ...applicationForm,
      applicantDetails: {
        name: applicationForm.applicantName,
        email: applicationForm.email,
        phone: applicationForm.phone,
        address: applicationForm.address,
        age: Number(eligibilityForm.age),
        pan: applicationForm.panNumber
      },
      amount: Number(eligibilityForm.amount),
      tenure: Number(eligibilityForm.tenure),
      monthlyIncome: Number(eligibilityForm.monthlyIncome),
      existingLoans: applicationForm.existingLoans ? Number(applicationForm.existingLoans) : 0,
      preferredLender: selectedOffer.lenderId
    };

    applyLoanMutation.mutate(applicationData);
  };

  const getBadgeVariant = (score: number) => {
    if (score >= 90) return "default";
    if (score >= 75) return "secondary";
    if (score >= 60) return "outline";
    return "destructive";
  };

  const getLenderLogo = (lenderId: string) => {
    const logos = {
      icici: "🏦",
      hdfc: "🏛️", 
      tata_capital: "🏢",
      bajaj_finance: "⭐"
    };
    return logos[lenderId as keyof typeof logos] || "🏦";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Apply for Loan
          </h1>
          <p className="text-xl text-muted-foreground">
            Get the best loan offers from ICICI, HDFC, Tata Capital & Bajaj Finance
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="mb-8">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
                </div>
                <span className="text-sm font-medium">Eligibility Check</span>
              </div>
              
              <div className="flex-1 mx-4">
                <Progress value={currentStep >= 2 ? 100 : 0} className="h-2" />
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
                </div>
                <span className="text-sm font-medium">Compare Offers</span>
              </div>
              
              <div className="flex-1 mx-4">
                <Progress value={currentStep >= 3 ? 100 : 0} className="h-2" />
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 3 ? <CheckCircle className="w-5 h-5" /> : '3'}
                </div>
                <span className="text-sm font-medium">Apply</span>
              </div>
              
              <div className="flex-1 mx-4">
                <Progress value={currentStep >= 4 ? 100 : 0} className="h-2" />
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 4 ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep >= 4 ? <CheckCircle className="w-5 h-5" /> : '4'}
                </div>
                <span className="text-sm font-medium">Status</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Eligibility Check */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="w-6 h-6 text-blue-600" />
                <span>Check Your Loan Eligibility</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="loanType">Loan Type *</Label>
                  <Select value={eligibilityForm.loanType} onValueChange={(value) => 
                    setEligibilityForm(prev => ({ ...prev, loanType: value }))}>
                    <SelectTrigger data-testid="select-loan-type">
                      <SelectValue placeholder="Select loan type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal Loan</SelectItem>
                      <SelectItem value="home">Home Loan</SelectItem>
                      <SelectItem value="business">Business Loan</SelectItem>
                      <SelectItem value="car">Car Loan</SelectItem>
                      <SelectItem value="against_property">Loan Against Property</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="e.g., 500000"
                    value={eligibilityForm.amount}
                    onChange={(e) => setEligibilityForm(prev => ({ ...prev, amount: e.target.value }))}
                    data-testid="input-loan-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenure">Tenure (Months) *</Label>
                  <Select value={eligibilityForm.tenure} onValueChange={(value) => 
                    setEligibilityForm(prev => ({ ...prev, tenure: value }))}>
                    <SelectTrigger data-testid="select-tenure">
                      <SelectValue placeholder="Select tenure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                      <SelectItem value="36">36 Months</SelectItem>
                      <SelectItem value="48">48 Months</SelectItem>
                      <SelectItem value="60">60 Months</SelectItem>
                      <SelectItem value="72">72 Months</SelectItem>
                      <SelectItem value="84">84 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Monthly Income (₹) *</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    placeholder="e.g., 50000"
                    value={eligibilityForm.monthlyIncome}
                    onChange={(e) => setEligibilityForm(prev => ({ ...prev, monthlyIncome: e.target.value }))}
                    data-testid="input-monthly-income"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type *</Label>
                  <Select value={eligibilityForm.employmentType} onValueChange={(value) => 
                    setEligibilityForm(prev => ({ ...prev, employmentType: value }))}>
                    <SelectTrigger data-testid="select-employment-type">
                      <SelectValue placeholder="Select employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salaried">Salaried</SelectItem>
                      <SelectItem value="self_employed">Self Employed</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="e.g., 30"
                    value={eligibilityForm.age}
                    onChange={(e) => setEligibilityForm(prev => ({ ...prev, age: e.target.value }))}
                    data-testid="input-age"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cibilScore">CIBIL Score (Optional)</Label>
                  <Input
                    id="cibilScore"
                    type="number"
                    placeholder="e.g., 750"
                    value={eligibilityForm.cibilScore}
                    onChange={(e) => setEligibilityForm(prev => ({ ...prev, cibilScore: e.target.value }))}
                    data-testid="input-cibil-score"
                  />
                  <p className="text-sm text-muted-foreground">Leave empty if you don't know your CIBIL score</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleEligibilityCheck}
                  disabled={checkEligibilityMutation.isPending}
                  className="px-8"
                  data-testid="button-check-eligibility"
                >
                  {checkEligibilityMutation.isPending ? "Checking..." : "Check Eligibility"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Compare Offers */}
        {currentStep === 2 && eligibilityResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <span>Available Loan Offers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {eligibilityResult.offers.map((offer, index) => (
                    <Card key={offer.lenderId} className="border-2 hover:border-blue-500 transition-colors cursor-pointer">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{getLenderLogo(offer.lenderId)}</span>
                            <h3 className="font-semibold text-lg">{offer.lenderName}</h3>
                          </div>
                          <Badge variant={getBadgeVariant(offer.eligibilityScore)}>
                            {offer.eligibilityScore}% Match
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Interest Rate</span>
                            <span className="font-semibold text-blue-600">{offer.interestRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">EMI</span>
                            <span className="font-semibold">₹{offer.emi.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Processing Fee</span>
                            <span className="font-semibold">₹{offer.processingFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Amount</span>
                            <span className="font-semibold">₹{offer.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        <Separator />

                        {offer.specialOffers && offer.specialOffers.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-green-600">Special Offers</h4>
                            {offer.specialOffers.map((offerText, idx) => (
                              <p key={idx} className="text-xs text-green-700 bg-green-50 p-2 rounded">
                                {offerText}
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Terms & Requirements</h4>
                          {offer.terms.slice(0, 2).map((term, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground">• {term}</p>
                          ))}
                          {offer.terms.length > 2 && (
                            <p className="text-xs text-blue-600">+{offer.terms.length - 2} more requirements</p>
                          )}
                        </div>

                        <Button 
                          onClick={() => handleSelectOffer(offer)}
                          className="w-full mt-4"
                          data-testid={`button-select-offer-${offer.lenderId}`}
                        >
                          Select This Offer
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <Button 
                    variant="outline" 
                    onClick={handleCompareOffers}
                    disabled={compareOffersMutation.isPending}
                    data-testid="button-compare-detailed"
                  >
                    {compareOffersMutation.isPending ? "Comparing..." : "Get Detailed Comparison"}
                  </Button>
                </div>

                {comparisonResult && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Offer Comparison Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Best Rate</p>
                          <p className="text-lg font-semibold text-green-600">{comparisonResult.comparisonSummary.lowestRate}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Offers</p>
                          <p className="text-lg font-semibold">{comparisonResult.totalOffers}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg. Processing Fee</p>
                          <p className="text-lg font-semibold">₹{Math.round(comparisonResult.comparisonSummary.averageProcessingFee).toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Application Form */}
        {currentStep === 3 && selectedOffer && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span>Loan Application - {selectedOffer.lenderName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected Offer Summary */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Selected Offer: {selectedOffer.lenderName}</h3>
                        <p className="text-sm text-muted-foreground">Interest Rate: {selectedOffer.interestRate}% | EMI: ₹{selectedOffer.emi.toLocaleString()}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                        data-testid="button-change-offer"
                      >
                        Change Offer
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Application Form */}
                <Tabs defaultValue="personal" className="w-full">
                  <ScrollableTabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="personal">Personal Details</TabsTrigger>
                    <TabsTrigger value="financial">Financial Details</TabsTrigger>
                    <TabsTrigger value="consent">Consent & Submit</TabsTrigger>
                  </ScrollableTabsList>
                  
                  <TabsContent value="personal" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="applicantName">Full Name *</Label>
                        <Input
                          id="applicantName"
                          placeholder="Enter your full name"
                          value={applicationForm.applicantName}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, applicantName: e.target.value }))}
                          data-testid="input-applicant-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={applicationForm.email}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, email: e.target.value }))}
                          data-testid="input-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="10-digit mobile number"
                          value={applicationForm.phone}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, phone: e.target.value }))}
                          data-testid="input-phone"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="panNumber">PAN Number *</Label>
                        <Input
                          id="panNumber"
                          placeholder="ABCDE1234F"
                          value={applicationForm.panNumber}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                          data-testid="input-pan-number"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Address *</Label>
                        <Textarea
                          id="address"
                          placeholder="Enter your complete address"
                          value={applicationForm.address}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, address: e.target.value }))}
                          data-testid="textarea-address"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="financial" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="occupation">Occupation *</Label>
                        <Input
                          id="occupation"
                          placeholder="Your job title/profession"
                          value={applicationForm.occupation}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, occupation: e.target.value }))}
                          data-testid="input-occupation"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="existingLoans">Existing Loan EMIs (₹)</Label>
                        <Input
                          id="existingLoans"
                          type="number"
                          placeholder="Total monthly EMI for existing loans"
                          value={applicationForm.existingLoans}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, existingLoans: e.target.value }))}
                          data-testid="input-existing-loans"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="purpose">Loan Purpose *</Label>
                        <Textarea
                          id="purpose"
                          placeholder="Describe how you plan to use this loan"
                          value={applicationForm.purpose}
                          onChange={(e) => setApplicationForm(prev => ({ ...prev, purpose: e.target.value }))}
                          data-testid="textarea-purpose"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="consent" className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="terms"
                          checked={consent.termsAccepted}
                          onCheckedChange={(checked) => setConsent(prev => ({ ...prev, termsAccepted: checked as boolean }))}
                          data-testid="checkbox-terms"
                        />
                        <Label htmlFor="terms" className="text-sm">
                          I accept the terms and conditions of {selectedOffer.lenderName}
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="dataProcessing"
                          checked={consent.dataProcessing}
                          onCheckedChange={(checked) => setConsent(prev => ({ ...prev, dataProcessing: checked as boolean }))}
                          data-testid="checkbox-data-processing"
                        />
                        <Label htmlFor="dataProcessing" className="text-sm">
                          I consent to processing of my personal data for loan assessment
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="creditCheck"
                          checked={consent.creditCheck}
                          onCheckedChange={(checked) => setConsent(prev => ({ ...prev, creditCheck: checked as boolean }))}
                          data-testid="checkbox-credit-check"
                        />
                        <Label htmlFor="creditCheck" className="text-sm">
                          I authorize credit bureau verification and CIBIL score check
                        </Label>
                      </div>
                    </div>

                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="py-4">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mt-1" />
                          <div>
                            <h4 className="font-semibold text-yellow-800">Important Notice</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              By submitting this application, you acknowledge that this is a binding agreement and 
                              any false information may result in rejection of your loan application.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Button 
                      onClick={handleSubmitApplication}
                      disabled={applyLoanMutation.isPending || !consent.termsAccepted || !consent.dataProcessing || !consent.creditCheck}
                      className="w-full py-3"
                      data-testid="button-submit-application"
                    >
                      {applyLoanMutation.isPending ? "Submitting Application..." : "Submit Loan Application"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Application Status */}
        {currentStep === 4 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-800">Application Submitted Successfully!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg text-muted-foreground">
                Your loan application has been submitted to {selectedOffer?.lenderName}
              </p>
              
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">What happens next?</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">Document verification (1-2 business days)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">Credit assessment and approval (2-3 business days)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <IndianRupee className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">Loan disbursement (1-2 business days after approval)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => window.location.href = '/loans'} data-testid="button-view-all-applications">
                  View All Applications
                </Button>
                <Button onClick={() => window.location.reload()} data-testid="button-apply-another">
                  Apply for Another Loan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}