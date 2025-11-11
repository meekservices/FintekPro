import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, TrendingUp, Shield, BarChart3, Users, Award, Phone, ArrowRight } from "lucide-react";

export default function PmsDashboard() {
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
              Portfolio Management Services (PMS) are exclusively available to Accredited Investors as per SEBI regulations.
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <p className="font-semibold mb-2 text-amber-900 dark:text-amber-100">SEBI Accredited Investor Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Net worth of ₹7.5 Crore or more (excluding primary residence)</li>
                <li><strong>OR</strong> Annual income of ₹2 Crore or more</li>
              </ul>
            </div>
            <p className="text-sm">
              Complete your KYC upgrade to unlock access to premium investment products including PMS, AIF, and Private Market opportunities.
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

  const portfolioStrategies = [
    {
      name: "Large Cap Growth",
      minInvestment: "₹50 Lakhs",
      returns: "18.5% CAGR",
      risk: "Moderate",
      holdings: 25,
      aum: "₹450 Cr",
    },
    {
      name: "Dividend Yield Plus",
      minInvestment: "₹50 Lakhs",
      returns: "15.2% CAGR",
      risk: "Low-Moderate",
      holdings: 30,
      aum: "₹320 Cr",
    },
    {
      name: "Multi-Cap Value",
      minInvestment: "₹75 Lakhs",
      returns: "21.3% CAGR",
      risk: "Moderate-High",
      holdings: 20,
      aum: "₹580 Cr",
    },
    {
      name: "Small & Mid Cap Focus",
      minInvestment: "₹1 Crore",
      returns: "24.7% CAGR",
      risk: "High",
      holdings: 18,
      aum: "₹280 Cr",
    },
    {
      name: "Sector Rotation",
      minInvestment: "₹1 Crore",
      returns: "19.8% CAGR",
      risk: "Moderate-High",
      holdings: 22,
      aum: "₹410 Cr",
    },
    {
      name: "Global Equity",
      minInvestment: "₹75 Lakhs",
      returns: "16.9% CAGR",
      risk: "Moderate",
      holdings: 35,
      aum: "₹365 Cr",
    },
  ];

  const benefits = [
    {
      icon: TrendingUp,
      title: "Personalized Management",
      description: "Dedicated portfolio managers crafting strategies aligned with your financial goals",
    },
    {
      icon: Shield,
      title: "Direct Ownership",
      description: "Securities held in your demat account, ensuring complete transparency and control",
    },
    {
      icon: BarChart3,
      title: "Superior Returns",
      description: "Outperform market benchmarks with actively managed, research-driven portfolios",
    },
    {
      icon: Users,
      title: "Expert Research",
      description: "Access to institutional-grade research and proprietary investment insights",
    },
    {
      icon: Award,
      title: "Tax Efficiency",
      description: "Optimized tax planning with long-term capital gains benefits and loss harvesting",
    },
    {
      icon: Phone,
      title: "Dedicated Support",
      description: "24/7 relationship manager support for all your investment needs",
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
            Portfolio Management Services
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Elite wealth management tailored for accredited investors. Experience institutional-grade portfolio management with personalized strategies designed to maximize returns while managing risk.
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
            Why Choose Our PMS
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
            Available Portfolio Strategies
          </h2>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
              <CardTitle>Active Portfolio Strategies</CardTitle>
              <CardDescription>
                Select from our curated portfolio strategies managed by experienced fund managers
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100 dark:bg-amber-900/20">
                      <TableHead className="font-semibold">Strategy Name</TableHead>
                      <TableHead className="font-semibold">Min. Investment</TableHead>
                      <TableHead className="font-semibold">Returns (3Y)</TableHead>
                      <TableHead className="font-semibold">Risk Level</TableHead>
                      <TableHead className="font-semibold">Holdings</TableHead>
                      <TableHead className="font-semibold">AUM</TableHead>
                      <TableHead className="font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolioStrategies.map((strategy, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-amber-50 dark:hover:bg-amber-950/10"
                        data-testid={`row-strategy-${index}`}
                      >
                        <TableCell className="font-medium">{strategy.name}</TableCell>
                        <TableCell>{strategy.minInvestment}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {strategy.returns}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              strategy.risk === "Low-Moderate" ? "border-blue-500 text-blue-700 dark:text-blue-400" :
                              strategy.risk === "Moderate" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                              strategy.risk === "Moderate-High" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                              "border-red-500 text-red-700 dark:text-red-400"
                            }
                          >
                            {strategy.risk}
                          </Badge>
                        </TableCell>
                        <TableCell>{strategy.holdings}</TableCell>
                        <TableCell>{strategy.aum}</TableCell>
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

        {/* CTA Section */}
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="section-cta">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Ready to Start Your PMS Journey?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Schedule a consultation with our wealth management team to discuss your investment goals and find the perfect portfolio strategy.
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
              Download Brochure
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
