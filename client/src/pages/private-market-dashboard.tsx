import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Gem, TrendingUp, Eye, Shield, Award, Phone, ArrowRight } from "lucide-react";

export default function PrivateMarketDashboard() {
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
              Private Market investments in unlisted securities and private equity are exclusively available to Accredited Investors as per SEBI regulations.
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <p className="font-semibold mb-2 text-amber-900 dark:text-amber-100">SEBI Accredited Investor Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Net worth of ₹7.5 Crore or more (excluding primary residence)</li>
                <li><strong>OR</strong> Annual income of ₹2 Crore or more</li>
              </ul>
            </div>
            <p className="text-sm">
              Complete your KYC upgrade to unlock access to premium investment products including Private Markets, PMS, and AIF opportunities.
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

  const privateOpportunities = [
    {
      company: "PharmaTech Innovations",
      sector: "Healthcare",
      stage: "Series C",
      valuation: "₹2,400 Cr",
      minInvestment: "₹50 Lakhs",
      expectedReturns: "3-4x",
      timeline: "3-4 years",
      status: "Open",
    },
    {
      company: "GreenEnergy Solutions",
      sector: "Renewable Energy",
      stage: "Growth Stage",
      valuation: "₹1,800 Cr",
      minInvestment: "₹75 Lakhs",
      expectedReturns: "2.5-3x",
      timeline: "2-3 years",
      status: "Limited",
    },
    {
      company: "FinTech Express",
      sector: "Financial Services",
      stage: "Pre-IPO",
      valuation: "₹5,200 Cr",
      minInvestment: "₹1 Crore",
      expectedReturns: "1.8-2.5x",
      timeline: "12-18 months",
      status: "Open",
    },
    {
      company: "EduLearn Platform",
      sector: "EdTech",
      stage: "Series B",
      valuation: "₹950 Cr",
      minInvestment: "₹50 Lakhs",
      expectedReturns: "4-5x",
      timeline: "4-5 years",
      status: "Open",
    },
    {
      company: "LogisticsPro Network",
      sector: "Supply Chain",
      stage: "Growth Stage",
      valuation: "₹1,600 Cr",
      minInvestment: "₹75 Lakhs",
      expectedReturns: "2-3x",
      timeline: "2-3 years",
      status: "Limited",
    },
    {
      company: "AI Solutions Hub",
      sector: "Artificial Intelligence",
      stage: "Series C",
      valuation: "₹3,200 Cr",
      minInvestment: "₹1 Crore",
      expectedReturns: "3.5-5x",
      timeline: "3-4 years",
      status: "Open",
    },
    {
      company: "FoodTech Ventures",
      sector: "Food & Beverage",
      stage: "Pre-IPO",
      valuation: "₹2,100 Cr",
      minInvestment: "₹50 Lakhs",
      expectedReturns: "2-2.5x",
      timeline: "18-24 months",
      status: "Open",
    },
    {
      company: "RealEstate PropTech",
      sector: "Real Estate Tech",
      stage: "Series D",
      valuation: "₹4,500 Cr",
      minInvestment: "₹1 Crore",
      expectedReturns: "2.5-3.5x",
      timeline: "2-3 years",
      status: "Limited",
    },
  ];

  const benefits = [
    {
      icon: Gem,
      title: "Exclusive Access",
      description: "Invest in high-potential unlisted companies before they go public on stock exchanges",
    },
    {
      icon: TrendingUp,
      title: "Superior Returns",
      description: "Access to pre-IPO valuations with potential for significant capital appreciation",
    },
    {
      icon: Eye,
      title: "Early-Stage Opportunities",
      description: "Participate in the growth journey of tomorrow's market leaders and unicorns",
    },
    {
      icon: Shield,
      title: "Rigorous Due Diligence",
      description: "Comprehensive vetting process ensuring quality investment opportunities",
    },
    {
      icon: Award,
      title: "Portfolio Diversification",
      description: "Reduce market correlation by investing across sectors and growth stages",
    },
    {
      icon: Phone,
      title: "Expert Guidance",
      description: "Dedicated advisors with expertise in private market investments",
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
            Private Market Investments
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Discover exclusive opportunities in unlisted securities and private equity. Invest in India's fastest-growing startups and pre-IPO companies with significant upside potential.
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
            Why Invest in Private Markets
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
            Available Private Market Opportunities
          </h2>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
              <CardTitle>Unlisted Securities & Pre-IPO Investments</CardTitle>
              <CardDescription>
                Curated opportunities in high-growth startups and pre-IPO companies across sectors
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100 dark:bg-amber-900/20">
                      <TableHead className="font-semibold">Company</TableHead>
                      <TableHead className="font-semibold">Sector</TableHead>
                      <TableHead className="font-semibold">Stage</TableHead>
                      <TableHead className="font-semibold">Valuation</TableHead>
                      <TableHead className="font-semibold">Min. Investment</TableHead>
                      <TableHead className="font-semibold">Expected Returns</TableHead>
                      <TableHead className="font-semibold">Timeline</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {privateOpportunities.map((opportunity, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-amber-50 dark:hover:bg-amber-950/10"
                        data-testid={`row-opportunity-${index}`}
                      >
                        <TableCell className="font-medium">{opportunity.company}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                            {opportunity.sector}
                          </Badge>
                        </TableCell>
                        <TableCell>{opportunity.stage}</TableCell>
                        <TableCell>{opportunity.valuation}</TableCell>
                        <TableCell>{opportunity.minInvestment}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {opportunity.expectedReturns}
                          </Badge>
                        </TableCell>
                        <TableCell>{opportunity.timeline}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              opportunity.status === "Open" 
                                ? "border-green-500 text-green-700 dark:text-green-400" 
                                : "border-orange-500 text-orange-700 dark:text-orange-400"
                            }
                          >
                            {opportunity.status}
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

        {/* Risk Disclaimer */}
        <div className="mt-12" data-testid="section-disclaimer">
          <Alert className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-700">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">Investment Disclaimer</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Private market investments are illiquid and carry higher risk compared to listed securities. Past performance is not indicative of future returns. 
              Investors should carefully review offering documents and consult with financial advisors before investing.
            </AlertDescription>
          </Alert>
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="section-cta">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Ready to Explore Private Markets?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Connect with our private markets team to discuss investment opportunities and due diligence reports.
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
              Download Investment Guide
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
