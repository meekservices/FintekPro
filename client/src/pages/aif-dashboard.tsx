import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Rocket, LineChart, Lock, FileCheck, Briefcase, Phone, ArrowRight } from "lucide-react";

export default function AifDashboard() {
  const { data: user, isLoading } = useQuery({ queryKey: ["/api/user"] });
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (user?.kycTier !== "tier_3") {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20" data-testid="alert-access-denied">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-xl font-semibold text-amber-900 dark:text-amber-100">
            Accredited Investor Required
          </AlertTitle>
          <AlertDescription className="mt-4 space-y-4 text-amber-800 dark:text-amber-200">
            <p className="text-base">
              Alternative Investment Funds (AIF) are exclusively available to Accredited Investors as per SEBI regulations.
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <p className="font-semibold mb-2 text-amber-900 dark:text-amber-100">SEBI Accredited Investor Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Net worth of ₹7.5 Crore or more (excluding primary residence)</li>
                <li><strong>OR</strong> Annual income of ₹2 Crore or more</li>
              </ul>
            </div>
            <p className="text-sm">
              Complete your KYC upgrade to unlock access to premium investment products including AIF, PMS, and Private Market opportunities.
            </p>
            <Button
              onClick={() => navigate("/smart-production-kyc")}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-upgrade-kyc"
            >
              Upgrade to Accredited Investor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const aifFunds = [
    {
      name: "Venture Capital Fund - Series A",
      category: "Category I",
      type: "Venture Capital",
      minInvestment: "₹1 Crore",
      returns: "28.5% IRR",
      tenure: "7 years",
      commitmentStatus: "Open",
      targetCorpus: "₹250 Cr",
    },
    {
      name: "Private Equity Growth Fund",
      category: "Category II",
      type: "Private Equity",
      minInvestment: "₹2 Crore",
      returns: "22.3% IRR",
      tenure: "5 years",
      commitmentStatus: "Open",
      targetCorpus: "₹500 Cr",
    },
    {
      name: "Real Estate Opportunity Fund",
      category: "Category II",
      type: "Real Estate",
      minInvestment: "₹1.5 Crore",
      returns: "18.7% IRR",
      tenure: "4 years",
      commitmentStatus: "Limited",
      targetCorpus: "₹350 Cr",
    },
    {
      name: "Long-Short Equity Hedge Fund",
      category: "Category III",
      type: "Hedge Fund",
      minInvestment: "₹1 Crore",
      returns: "19.2% CAGR",
      tenure: "3 years",
      commitmentStatus: "Open",
      targetCorpus: "₹200 Cr",
    },
    {
      name: "Infrastructure Debt Fund",
      category: "Category I",
      type: "Debt",
      minInvestment: "₹1 Crore",
      returns: "12.5% CAGR",
      tenure: "6 years",
      commitmentStatus: "Open",
      targetCorpus: "₹400 Cr",
    },
  ];

  const benefits = [
    {
      icon: Rocket,
      title: "High Growth Potential",
      description: "Access to high-growth startups, private equity, and alternative assets with superior return potential",
    },
    {
      icon: LineChart,
      title: "Portfolio Diversification",
      description: "Reduce correlation with public markets through alternative asset classes and strategies",
    },
    {
      icon: Lock,
      title: "Exclusive Access",
      description: "Invest in pre-IPO companies and private opportunities unavailable to retail investors",
    },
    {
      icon: FileCheck,
      title: "Professional Management",
      description: "Expert fund managers with proven track records in alternative investments",
    },
    {
      icon: Briefcase,
      title: "Institutional Quality",
      description: "Access to institutional-grade investment opportunities with rigorous due diligence",
    },
    {
      icon: Phone,
      title: "Dedicated Support",
      description: "Personalized service from our alternative investments team",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center" data-testid="section-hero">
          <Badge className="mb-4 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300" data-testid="badge-premium">
            Premium Investment Product
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
            Alternative Investment Funds
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Unlock exclusive investment opportunities in venture capital, private equity, hedge funds, and real estate. Diversify beyond traditional markets with SEBI-regulated alternative investment funds.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-explore-opportunities"
            >
              Explore Opportunities
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400"
              data-testid="button-talk-to-rm"
            >
              <Phone className="mr-2 h-5 w-5" />
              Talk to Relationship Manager
            </Button>
          </div>
        </div>

        {/* Key Benefits Grid */}
        <div className="mb-12" data-testid="section-benefits">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
            Why Invest in AIFs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card 
                  key={index} 
                  className="border-amber-200 hover:border-amber-400 transition-all hover:shadow-lg dark:border-amber-800 dark:hover:border-amber-600"
                  data-testid={`card-benefit-${index}`}
                >
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Investment Opportunities */}
        <div data-testid="section-opportunities">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
            Available AIF Opportunities
          </h2>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
              <CardTitle>Active AIF Funds</CardTitle>
              <CardDescription>
                SEBI-registered Alternative Investment Funds across Category I, II, and III
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100 dark:bg-amber-900/20">
                      <TableHead className="font-semibold">Fund Name</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Min. Investment</TableHead>
                      <TableHead className="font-semibold">Returns</TableHead>
                      <TableHead className="font-semibold">Tenure</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aifFunds.map((fund, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-amber-50 dark:hover:bg-amber-950/10"
                        data-testid={`row-fund-${index}`}
                      >
                        <TableCell className="font-medium">{fund.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-purple-500 text-purple-700 dark:text-purple-400">
                            {fund.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{fund.type}</TableCell>
                        <TableCell>{fund.minInvestment}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {fund.returns}
                          </Badge>
                        </TableCell>
                        <TableCell>{fund.tenure}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              fund.commitmentStatus === "Open" 
                                ? "border-green-500 text-green-700 dark:text-green-400" 
                                : "border-orange-500 text-orange-700 dark:text-orange-400"
                            }
                          >
                            {fund.commitmentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                            data-testid={`button-view-details-${index}`}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AIF Categories Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="section-categories">
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="text-purple-700 dark:text-purple-400">Category I</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Venture capital, angel funds, infrastructure funds, and SME funds that invest in startups and socially/economically desirable sectors
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">Category II</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Private equity, debt funds, and fund of funds that don't use leverage or derivatives except for hedging
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="text-orange-700 dark:text-orange-400">Category III</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Hedge funds that employ complex trading strategies including leverage, derivatives, and short selling
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="section-cta">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Ready to Explore Alternative Investments?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Connect with our alternative investments specialist to discuss fund options and commitment requirements.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-schedule-consultation"
            >
              Schedule Consultation
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400"
              data-testid="button-download-brochure"
            >
              Download AIF Guide
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
