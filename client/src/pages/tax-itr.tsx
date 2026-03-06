import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Users, 
  Calculator, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Shield,
  Sparkles,
  UserCheck,
  Receipt,
  IndianRupee,
  HelpCircle,
  FileCheck,
  Upload,
  ChevronRight,
  Star,
  Briefcase,
  Building2,
  Home as HomeIcon
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri";

interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
}

interface ITRForm {
  form: string;
  name: string;
  description: string;
}

interface ITRPricing {
  [key: string]: { selfFile: number; expert: number };
}

interface EligibleFormsResponse {
  panType: PANType;
  eligibleForms: ITRForm[];
  recommendedForm: string;
}

const FORM_FEATURES: Record<string, string[]> = {
  "ITR-1": ["Salary income", "One house property", "Interest income", "Agricultural income up to ₹5,000"],
  "ITR-2": ["Capital gains", "Multiple house properties", "Foreign income/assets", "Director in company"],
  "ITR-3": ["Business income", "Professional income", "Partnership income", "Presumptive taxation 44AD/44ADA"],
  "ITR-4": ["Presumptive income u/s 44AD", "Presumptive income u/s 44ADA", "Turnover up to ₹2 crore"],
  "ITR-5": ["Partnership firm income", "LLP income", "AOP/BOI income", "Audit requirements"],
  "ITR-6": ["Corporate income", "MAT calculation", "Transfer pricing", "Audit compliance"],
  "ITR-7": ["Charitable trust income", "Section 11/12 exemptions", "Political party returns"]
};

const FORM_COMPLEXITY: Record<string, "simple" | "moderate" | "complex"> = {
  "ITR-1": "simple",
  "ITR-2": "moderate",
  "ITR-3": "complex",
  "ITR-4": "moderate",
  "ITR-5": "complex",
  "ITR-6": "complex",
  "ITR-7": "complex"
};

export default function TaxITRPage() {
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("landing");
  const { isAuthenticated } = useAuth();
  
  const { data: panContext, isLoading: panLoading } = useQuery<PANContext>({
    queryKey: ["/api/tax/pan-context"],
    enabled: isAuthenticated
  });

  const { data: eligibleFormsData, isLoading: formsLoading } = useQuery<EligibleFormsResponse>({
    queryKey: ["/api/tax/eligible-forms"],
    enabled: isAuthenticated
  });

  const { data: pricing } = useQuery<ITRPricing>({
    queryKey: ["/api/tax/itr-pricing"]
  });

  const eligibleForms = eligibleFormsData?.eligibleForms || [];
  const isLoading = panLoading || formsLoading;

  const getPANTypeIcon = (type: PANType) => {
    switch (type) {
      case "individual": return <UserCheck className="h-5 w-5" />;
      case "huf": return <Users className="h-5 w-5" />;
      case "firm": return <Briefcase className="h-5 w-5" />;
      case "company": return <Building2 className="h-5 w-5" />;
      case "trust": return <Shield className="h-5 w-5" />;
      case "nri": return <HomeIcon className="h-5 w-5" />;
      default: return <UserCheck className="h-5 w-5" />;
    }
  };

  const getComplexityBadge = (complexity: string) => {
    switch (complexity) {
      case "simple": return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Simple</Badge>;
      case "moderate": return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Moderate</Badge>;
      case "complex": return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">Complex</Badge>;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* PAN Context Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                {getPANTypeIcon(panContext?.panType || "individual")}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{panContext?.name || "Loading..."}</span>
                  {panContext?.isVerified && (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>PAN: {panContext?.pan || "---"}</span>
                  <span>•</span>
                  <span className="capitalize">{panContext?.panType?.replace("_", " ") || "Individual"}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" data-testid="button-update-pan">
              Update Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Tax Return Filing</h1>
          <p className="text-muted-foreground">AY 2025-26 (FY 2024-25) | Due Date: July 31, 2025 &nbsp;·&nbsp; AY 2026-27 (FY 2025-26) opens April 1, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-orange-600 border-orange-300 dark:border-orange-700">
            <Clock className="h-3 w-3 mr-1" /> 45 days left
          </Badge>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <ScrollableTabsList className="w-full">
          <TabsTrigger value="landing" className="flex items-center gap-2" data-testid="tab-itr-landing">
            <FileText size={16} />
            Get Started
          </TabsTrigger>
          <TabsTrigger value="self-file" className="flex items-center gap-2" data-testid="tab-self-file">
            <Calculator size={16} />
            Self File
          </TabsTrigger>
          <TabsTrigger value="expert" className="flex items-center gap-2" data-testid="tab-hire-expert">
            <Users size={16} />
            Hire Expert
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2" data-testid="tab-filing-status">
            <FileCheck size={16} />
            Filing Status
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Landing Tab - Choose Filing Method */}
        <TabsContent value="landing" className="space-y-6" data-testid="content-itr-landing">
          {/* Filing Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Self File Option */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500" 
                  onClick={() => setSelectedTab("self-file")}
                  data-testid="card-self-file">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 dark:bg-blue-900 rounded-bl-full opacity-50" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Calculator className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Self File ITR</CardTitle>
                    <CardDescription>File your return yourself with guidance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Question-driven income capture
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Auto-selection of ITR form
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Real-time tax computation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    AI-powered deduction suggestions
                  </li>
                </ul>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Starting from</p>
                    <p className="text-2xl font-bold text-blue-600">₹499</p>
                  </div>
                  <Button className="gap-2" data-testid="button-start-self-file">
                    Start Filing <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Hire Expert Option */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500"
                  onClick={() => setSelectedTab("expert")}
                  data-testid="card-hire-expert">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 dark:bg-purple-900 rounded-bl-full opacity-50" />
              <Badge className="absolute top-4 right-4 bg-purple-600">Recommended</Badge>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Hire a Tax Expert</CardTitle>
                    <CardDescription>Let a CA handle your filing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Dedicated CA assigned
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Document collection & review
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Maximum deduction optimization
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Post-filing support included
                  </li>
                </ul>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Starting from</p>
                    <p className="text-2xl font-bold text-purple-600">₹1,999</p>
                  </div>
                  <Button className="gap-2 bg-purple-600 hover:bg-purple-700" data-testid="button-hire-expert">
                    Get Expert Help <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Eligible ITR Forms */}
          <Card data-testid="card-eligible-forms">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Eligible ITR Forms for You
              </CardTitle>
              <CardDescription>Based on your PAN type: {panContext?.panType?.toUpperCase() || "Individual"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibleForms.map((form) => {
                  const formPricing = pricing?.[form.form] || { selfFile: 0, expert: 0 };
                  const features = FORM_FEATURES[form.form] || [];
                  const complexity = FORM_COMPLEXITY[form.form] || "moderate";
                  return (
                    <Card key={form.form} className="border hover:shadow-md transition-shadow" data-testid={`form-${form.form.toLowerCase()}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{form.form}</CardTitle>
                          {getComplexityBadge(complexity)}
                        </div>
                        <CardDescription className="font-medium">{form.name}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{form.description}</p>
                        <div className="space-y-1">
                          {features.slice(0, 3).map((feature, idx) => (
                            <p key={idx} className="text-xs flex items-center gap-1 text-muted-foreground">
                              <CheckCircle className="h-3 w-3 text-green-500" /> {feature}
                            </p>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t text-sm">
                          <div>
                            <span className="text-muted-foreground">Self: </span>
                            <span className="font-semibold">₹{formPricing.selfFile}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expert: </span>
                            <span className="font-semibold">₹{formPricing.expert}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">98%</div>
                  <p className="text-xs text-muted-foreground">Accuracy Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">15 min</div>
                  <p className="text-xs text-muted-foreground">Avg. Filing Time</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">50+</div>
                  <p className="text-xs text-muted-foreground">Expert CAs</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-6">
                <div className="text-center">
                  <IndianRupee className="h-8 w-8 mx-auto text-orange-600 mb-2" />
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">₹2.5L</div>
                  <p className="text-xs text-muted-foreground">Avg. Refund</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Self File Tab */}
        <TabsContent value="self-file" className="space-y-6" data-testid="content-self-file">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Self-File Your ITR
              </CardTitle>
              <CardDescription>Answer simple questions and we'll prepare your return</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Filing Progress</span>
                  <span className="font-medium">Step 1 of 6</span>
                </div>
                <Progress value={16} className="h-2" />
              </div>

              {/* Self-file wizard steps indicator */}
              <div className="grid grid-cols-6 gap-2 text-xs text-center">
                {["Personal", "Income", "Deductions", "Tax", "Preview", "Submit"].map((step, idx) => (
                  <div key={step} className={`p-2 rounded ${idx === 0 ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium" : "bg-muted text-muted-foreground"}`}>
                    {step}
                  </div>
                ))}
              </div>

              {/* Step 1: Income Sources Selection */}
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">What are your income sources?</CardTitle>
                  <CardDescription>Select all that apply - we'll auto-select the right ITR form</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: "salary", label: "Salary/Pension", icon: Briefcase },
                      { id: "house", label: "House Property", icon: HomeIcon },
                      { id: "capital", label: "Capital Gains", icon: Receipt },
                      { id: "business", label: "Business Income", icon: Building2 },
                      { id: "profession", label: "Professional Income", icon: UserCheck },
                      { id: "other", label: "Other Sources", icon: HelpCircle }
                    ].map(({ id, label, icon: Icon }) => (
                      <Button 
                        key={id} 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2 hover:border-blue-500 hover:bg-blue-50 dark:bg-blue-950/30"
                        data-testid={`income-source-${id}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm">{label}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setSelectedTab("landing")}>
                  Back
                </Button>
                <Button onClick={() => navigate("/tax/itr/self")} data-testid="button-continue-self-file">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hire Expert Tab */}
        <TabsContent value="expert" className="space-y-6" data-testid="content-hire-expert">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Hire a Tax Expert
              </CardTitle>
              <CardDescription>Get your ITR filed by a qualified Chartered Accountant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Expert Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <Star className="h-6 w-6 text-purple-600 mb-2" />
                  <h4 className="font-semibold">Dedicated CA</h4>
                  <p className="text-sm text-muted-foreground">Personal tax expert assigned to your case</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600 mb-2" />
                  <h4 className="font-semibold">100% Accuracy</h4>
                  <p className="text-sm text-muted-foreground">Expert review ensures error-free filing</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <IndianRupee className="h-6 w-6 text-blue-600 mb-2" />
                  <h4 className="font-semibold">Max Savings</h4>
                  <p className="text-sm text-muted-foreground">Optimize deductions for maximum refund</p>
                </div>
              </div>

              {/* Document Upload Section */}
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Your Documents
                  </CardTitle>
                  <CardDescription>Our CA will review and prepare your ITR</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { name: "Form 16", required: true },
                      { name: "Bank Statements", required: true },
                      { name: "Investment Proofs", required: false },
                      { name: "Rent Receipts", required: false }
                    ].map((doc) => (
                      <Button 
                        key={doc.name} 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2"
                        data-testid={`upload-${doc.name.toLowerCase().replace(" ", "-")}`}
                      >
                        <FileText className="h-6 w-6" />
                        <span className="text-sm">{doc.name}</span>
                        {doc.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setSelectedTab("landing")}>
                  Back
                </Button>
                <Button onClick={() => navigate("/tax/itr/expert")} className="bg-purple-600 hover:bg-purple-700" data-testid="button-create-case">
                  Create Expert Case <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Filing Status Tab */}
        <TabsContent value="status" className="space-y-6" data-testid="content-filing-status">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Your ITR Filing Status
              </CardTitle>
              <CardDescription>Track your current and past filings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Filing */}
                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950" data-testid="current-filing">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">AY 2025-26</h4>
                        <p className="text-sm text-muted-foreground">ITR-1 (Sahaj)</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">In Progress</Badge>
                  </div>
                  <Progress value={40} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">Step 3 of 6: Deductions</p>
                  <Button size="sm" className="mt-3" data-testid="button-continue-filing">
                    Continue Filing <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {/* Past Filings */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Past Filings</h4>
                  {[
                    { ay: "2023-24", form: "ITR-1", status: "Filed", date: "Jul 28, 2023", refund: "₹12,500" },
                    { ay: "2022-23", form: "ITR-1", status: "Filed", date: "Jul 25, 2022", refund: "₹8,200" }
                  ].map((filing, idx) => (
                    <div key={idx} className="p-4 border rounded-lg" data-testid={`past-filing-${idx}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">AY {filing.ay}</h4>
                            <p className="text-sm text-muted-foreground">{filing.form} • Filed {filing.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{filing.status}</Badge>
                          <p className="text-sm text-green-600 mt-1">Refund: {filing.refund}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card className="bg-muted">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-blue-500" />
              <div>
                <p className="font-medium">Need help choosing?</p>
                <p className="text-sm text-muted-foreground">Our tax experts are available 24/7</p>
              </div>
            </div>
            <Button variant="outline" data-testid="button-contact-support">
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
