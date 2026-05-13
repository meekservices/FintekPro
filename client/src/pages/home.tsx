import { MarketChart } from "@/components/dashboard/market-chart";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { MarketMovers } from "@/components/dashboard/market-movers";
import { MarketNews } from "@/components/dashboard/market-news";
import { YieldCurveChart } from "@/components/dashboard/yield-curve-chart";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  TrendingUp, 
  LucideShield as LucideShield, 
  Database, 
  Banknote, 
  BarChart3, 
  Coins, 
  Building2, 
  CreditCard, 
  PiggyBank, 
  FileText, 
  Building, 
  Briefcase, 
  Target, 
  PieChart, 
  Landmark, 
  Receipt, 
  Activity,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Users,
  Globe,
  Lock,
  Cpu,
  Phone,
  Mail,
  PlayCircle,
  Star
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management for accessibility
  useEffect(() => {
    const activeTab = tabRefs.current[activeFeature];
    if (activeTab && document.activeElement !== activeTab) {
      // Only focus if the current focus is on another tab (keyboard navigation)
      const focusedElement = document.activeElement;
      if (focusedElement && focusedElement.getAttribute('role') === 'tab') {
        activeTab.focus();
      }
    }
  }, [activeFeature]);
  
  // Get authenticated user data
  const { user, isAuthenticated } = useAuth();
  const { data: fallbackUser } = useQuery({ queryKey: ["/api/user"], retry: false });
  const currentUser = user || (fallbackUser as any);
  const userId = (currentUser as any)?.id;
  
  // Get greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };
  
  // Get user's display name
  const getUserDisplayName = (): string => {
    if (!currentUser) return "Guest";
    const firstName = (currentUser as any)?.firstName;
    const lastName = (currentUser as any)?.lastName;
    const email = (currentUser as any)?.email;
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (email) {
      return email.split('@')[0]; // Use email username part
    }
    return "Client";
  };
  
  // Fetch real-time portfolio value - only when user is authenticated
  const { data: portfolios } = useQuery({
    queryKey: ["/api/portfolios", userId],
    enabled: !!userId && isAuthenticated,
  });
  
  // Get portfolio ID from actual portfolios data
  const portfolioId = (portfolios && Array.isArray(portfolios) && portfolios.length > 0) 
    ? portfolios[0]?.id 
    : null;
  
  const { data: holdings } = useQuery({
    queryKey: ["/api/portfolios", portfolioId, "holdings"],
    enabled: !!portfolioId && isAuthenticated,
  });
  
  // Calculate total value from actual holdings
  const totalValue = Array.isArray(holdings) ? holdings.reduce((sum: number, holding: any) => {
    return sum + (holding.currentValue || 0);
  }, 0) : 2850000; // Updated realistic fallback

  // Fetch real platform statistics with stale-while-revalidate pattern
  // Uses placeholderData to show instant content while loading
  const { data: platformStatsData, isLoading: statsLoading } = useQuery<{
    activeUsers: string;
    portfolioValue: string;
    avgPortfolioValue: string;
    portfoliosCount: string;
    dailyTrades: string;
    monthlyTrades: string;
    mutualFundsCount: string;
    bondsCount: string;
    stocksCount: string;
    activeIpos: string;
    investmentOptions: string;
  }>({
    queryKey: ["/api/platform/stats"],
    refetchInterval: 60000, // Refresh every minute
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    placeholderData: {
      activeUsers: "...",
      portfolioValue: "...",
      avgPortfolioValue: "₹2.5L",
      portfoliosCount: "...",
      dailyTrades: "...",
      monthlyTrades: "...",
      mutualFundsCount: "14K+",
      bondsCount: "20+",
      stocksCount: "2.8K+",
      activeIpos: "3",
      investmentOptions: "14K+"
    }
  });

  const platformFeatures = [
    {
      title: "AI-Powered Portfolio Management",
      description: "Advanced portfolio analytics with real-time rebalancing suggestions and risk optimization using machine learning algorithms.",
      icon: Cpu,
      color: "blue",
      stats: statsLoading ? "Loading..." : (platformStatsData?.avgPortfolioValue ? `${platformStatsData.avgPortfolioValue} Avg Portfolio` : "₹0 Avg Portfolio")
    },
    {
      title: "Real-Time Market Intelligence", 
      description: "Live data from NSE, BSE, MCX, NCDEX with advanced charting and technical analysis tools.",
      icon: Activity,
      color: "green", 
      stats: "500ms Data Latency"
    },
    {
      title: "Comprehensive Investment Suite",
      description: "Access to Mutual Funds, IPOs, Pre-IPO, Bonds, AIFs, PMS, and alternative investments from one platform.",
      icon: Target,
      color: "purple",
      stats: statsLoading ? "Loading..." : (platformStatsData?.investmentOptions || "0+") + " Investment Options"
    },
    {
      title: "Smart Financial Tools",
      description: "Advanced calculators for SIP, EMI, tax planning, retirement corpus, and goal-based investing.",
      icon: Calculator,
      color: "orange",
      stats: "25+ Planning Tools"
    }
  ];

  const investmentProducts = [
    {
      name: "Mutual Funds",
      description: "Comprehensive mutual fund investment platform",
      icon: Coins,
      color: "blue",
      route: "/mutual-funds",
      features: ["Live NAV", "SIP Calculator", "Goal Planning"],
      volume: statsLoading ? "Loading..." : `${platformStatsData?.mutualFundsCount || "0"} Schemes Available`
    },
    {
      name: "Portfolio Tracker",
      description: "AI-powered portfolio management & analytics",
      icon: PieChart,
      color: "green", 
      route: "/portfolio",
      features: ["Real-time Tracking", "Risk Analysis", "Rebalancing"],
      volume: statsLoading ? "Loading..." : `${platformStatsData?.portfoliosCount || "0"} Active Portfolios`
    },
    {
      name: "IPO Center",
      description: "Complete IPO lifecycle management",
      icon: Building,
      color: "purple",
      route: "/ipo",
      features: ["Live Applications", "GMP Tracking", "Allotment Status"],
      volume: statsLoading ? "Loading..." : `${platformStatsData?.activeIpos || "0"} Active IPOs`
    },
    {
      name: "Market Intelligence",
      description: "Real-time market data & analytics",
      icon: TrendingUp,
      color: "red",
      route: "/markets", 
      features: ["Live Quotes", "Technical Charts", "News Feed"],
      volume: statsLoading ? "Loading..." : `${platformStatsData?.stocksCount || "0"} Stocks Tracked`
    },
    {
      name: "Bonds & NCDs",
      description: "Fixed income investment platform",
      icon: Receipt,
      color: "yellow",
      route: "/bonds",
      features: ["Government Bonds", "Corporate NCDs", "Tax-free Bonds"],
      volume: statsLoading ? "Loading..." : `${platformStatsData?.bondsCount || "0"} Bonds Available`
    },
    {
      name: "Loan Services",
      description: "Personal & business loan solutions", 
      icon: CreditCard,
      color: "indigo",
      route: "/loans",
      features: ["LAS Facility", "Digital KYC", "Instant Approval"],
      volume: "Multiple Lending Partners"
    }
  ];

  const financialServices = [
    {
      category: "Investment Services",
      services: [
        { name: "NSDL Services", desc: "Depository services integration", icon: Database, route: "/nsdl-services" },
        { name: "CDSL Services", desc: "Depository account access", icon: LucideShield, route: "/cdsl-services" },
        { name: "Pre-IPO Access", desc: "Unicorn equity stakes", icon: Sparkles, route: "/pre-ipo" },
        { name: "Unlisted Securities", desc: "Pre-IPO opportunities", icon: Building2, route: "/unlisted" }
      ]
    },
    {
      category: "Loans & Credit",
      services: [
        { name: "Personal Loan", desc: "Quick personal loans", icon: CreditCard, route: "/loans?type=personal" },
        { name: "Home Loan", desc: "Competitive home loan rates", icon: Building2, route: "/loans?type=home" },
        { name: "Business Loan", desc: "SME & corporate financing", icon: Briefcase, route: "/loans?type=business" },
        { name: "Loan Against Securities", desc: "Flexible LAS facility", icon: Receipt, route: "/loans?type=las" }
      ]
    },
    {
      category: "Professional Tools",
      services: [
        { name: "Calculators", desc: "Financial planning tools", icon: Calculator, route: "/calculators" },
        { name: "CIBIL Services", desc: "Credit score check", icon: Activity, route: "/cibil" },
        { name: "Capital Gains", desc: "Tax reports", icon: Receipt, route: "/capital-gains" },
        { name: "KYC Verification", desc: "KYC compliance", icon: CheckCircle, route: "/onboarding" }
      ]
    }
  ];

  const platformStats = [
    { label: "Active Users", value: statsLoading ? "..." : (platformStatsData?.activeUsers || "0"), icon: Users, color: "blue" },
    { label: "Portfolio Value", value: statsLoading ? "..." : (platformStatsData?.portfolioValue || "₹0"), icon: PieChart, color: "green" },
    { label: "Daily Trades", value: statsLoading ? "..." : (platformStatsData?.dailyTrades || "0"), icon: TrendingUp, color: "purple" },
    { label: "Monthly Trades", value: statsLoading ? "..." : (platformStatsData?.monthlyTrades || "0"), icon: Zap, color: "orange" }
  ];

  const colorClasses = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    green: "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", 
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    red: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    yellow: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
    teal: "text-teal-600 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800"
  };

  return (
    <div className="space-y-8" data-testid="home-page">
        {/* Quick Actions Widget */}
        <div>
          <QuickActionsWidget />
        </div>
        
        {/* Hero Section with Enhanced Design */}
        <section className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-purple-900 text-foreground py-20 overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-card/20 animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-purple-300/30 animate-bounce slow"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Content */}
              <div className="space-y-8">
                {/* Personalized Greeting */}
                {isAuthenticated && currentUser && (
                  <div className="bg-card/10 backdrop-blur-sm rounded-xl p-4 border border-white/20" data-testid="user-greeting">
                    <p className="text-lg text-blue-100">
                      {getGreeting()}, <span className="font-semibold text-yellow-400">{getUserDisplayName()}</span>! 👋
                    </p>
                    <p className="text-sm text-blue-200 mt-1">
                      Welcome back to your financial dashboard
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Badge className="bg-yellow-500 text-yellow-900 dark:text-yellow-100 text-sm px-4 py-2 font-semibold">
                    🚀 Your Complete Financial Platform
                  </Badge>
                  <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                    Build Wealth with 
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent block">
                      Smart Investments
                    </span>
                  </h1>
                  <p className="text-xl text-blue-100 leading-relaxed">
                    Complete financial platform with AI-powered portfolio management, real-time market data, 
                    and access to diverse investment options. Start your wealth journey today.
                  </p>
                </div>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <Link href="/wealth-management" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-foreground font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-2xl transform hover:scale-105 transition-all">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="text-sm sm:text-base">Start Smart Investing</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-white/30 text-foreground hover:bg-card/10 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl backdrop-blur-sm">
                    <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="text-sm sm:text-base">Watch Demo</span>
                  </Button>
                </div>

                {/* Platform Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/20">
                  {platformStats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <stat.icon className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-sm text-blue-200">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right side - Portfolio Summary */}
              <div className="space-y-6">
                <PortfolioSummary userId={userId} />
              </div>
            </div>
          </div>
        </section>

        {/* Platform Features Section */}
        <section className="py-20 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Why Choose FintekPro?
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Experience next-generation financial technology with AI-powered insights, 
                real-time data, and comprehensive investment solutions.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Features List */}
              <div className="space-y-6" role="tablist" aria-label="Platform features" aria-orientation="vertical">
                {platformFeatures.map((feature, index) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <button 
                      key={index}
                      ref={(el) => tabRefs.current[index] = el}
                      type="button"
                      role="tab"
                      id={`feature-tab-${index}`}
                      className={`w-full text-left p-6 rounded-xl border-2 cursor-pointer transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        activeFeature === index 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg' 
                          : 'border-border hover:border-border'
                      }`}
                      onClick={() => setActiveFeature(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveFeature((prev) => (prev + 1) % platformFeatures.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setActiveFeature((prev) => (prev - 1 + platformFeatures.length) % platformFeatures.length);
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          setActiveFeature(0);
                        } else if (e.key === 'End') {
                          e.preventDefault();
                          setActiveFeature(platformFeatures.length - 1);
                        }
                      }}
                      data-testid={`feature-tab-${index}`}
                      aria-selected={activeFeature === index}
                      aria-controls="feature-showcase-panel"
                      tabIndex={activeFeature === index ? 0 : -1}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-lg ${colorClasses[feature.color as keyof typeof colorClasses]}`}>
                          <FeatureIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground mb-3">{feature.description}</p>
                          <Badge variant="secondary" className="text-xs">
                            {feature.stats}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feature Showcase */}
              <div className="relative">
                <div 
                  className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl p-8 text-foreground shadow-2xl"
                  role="tabpanel"
                  id="feature-showcase-panel"
                  aria-labelledby={`feature-tab-${activeFeature}`}
                  tabIndex={0}
                >
                  <div className="flex items-center mb-6">
                    {(() => {
                      const ShowcaseIcon = platformFeatures[activeFeature].icon;
                      return <ShowcaseIcon className="w-8 h-8 mr-3 text-yellow-400" />;
                    })()}
                    <h3 className="text-2xl font-bold">{platformFeatures[activeFeature].title}</h3>
                  </div>
                  <p className="text-blue-100 text-lg mb-6">{platformFeatures[activeFeature].description}</p>
                  <div className="bg-card/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-3xl font-bold text-yellow-400 mb-2">
                      {platformFeatures[activeFeature].stats}
                    </div>
                    <p className="text-blue-200">Platform Performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Investment Products Grid */}
        <section className="py-20 bg-muted" data-testid="investment-products-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">Investment Products</h2>
              <p className="text-xl text-muted-foreground">Complete suite of investment solutions for wealth creation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {investmentProducts.map((product, index) => {
                const ProductIcon = product.icon;
                return (
                  <Link key={index} href={product.route}>
                    <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className={`p-3 rounded-lg ${colorClasses[product.color as keyof typeof colorClasses]}`}>
                            <ProductIcon className="w-6 h-6" />
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                        <CardTitle className="text-xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </CardTitle>
                        <p className="text-muted-foreground">{product.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 mb-4">
                          {product.features.map((feature, fIndex) => (
                            <div key={fIndex} className="flex items-center text-sm text-muted-foreground">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-border">
                          <p className="text-sm font-semibold text-foreground">{product.volume}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Financial Services Categories */}
        <section className="py-20 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">Financial Services</h2>
              <p className="text-xl text-muted-foreground">Comprehensive financial services ecosystem</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {financialServices.map((category, index) => (
                <div key={index} className="space-y-4">
                  <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                    <div className="w-3 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-3"></div>
                    {category.category}
                  </h3>
                  <div className="space-y-4">
                    {category.services.map((service, sIndex) => {
                      const ServiceIcon = service.icon;
                      return (
                        <Link key={sIndex} href={service.route}>
                          <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border border-border hover:border-blue-300 dark:border-blue-700">
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <ServiceIcon className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                                    {service.name}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">{service.desc}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Government Securities Yield Curve Section */}
        <section className="py-16 bg-card" data-testid="yield-curve-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground mb-3">Fixed Income Market Insights</h2>
              <p className="text-lg text-muted-foreground">Track government securities yields and compare historical trends</p>
            </div>
            <YieldCurveChart />
            <div className="mt-8 text-center">
              <Link href="/bonds">
                <Button variant="outline" size="lg" className="px-6">
                  <Receipt className="w-5 h-5 mr-2" />
                  Explore Bonds & NCDs
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Live Market Data Section */}
        <section className="py-20 bg-gradient-to-r from-gray-900 to-blue-900 text-foreground">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Live Market Intelligence</h2>
              <p className="text-xl text-blue-200">Real-time market data and analytics at your fingertips</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <MarketMovers />
              </div>
              <div className="space-y-6">
                <MarketNews />
              </div>
            </div>

            <div className="mt-12 text-center">
              <Link href="/markets">
                <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-foreground font-semibold px-8 py-4 rounded-xl">
                  <Activity className="w-5 h-5 mr-2" />
                  Explore Full Market Data
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Security & Trust Section */}
        <section className="py-20 bg-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">Security & Trust</h2>
              <p className="text-xl text-muted-foreground">Your security is our top priority</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: LucideShield,
                  title: "Bank-Grade Security",
                  description: "256-bit SSL encryption and multi-factor authentication"
                },
                {
                  icon: Lock,
                  title: "Regulatory Compliance", 
                  description: "SEBI registered and RBI compliant platform"
                },
                {
                  icon: Database,
                  title: "Data Protection",
                  description: "GDPR compliant with secure data centers"
                },
                {
                  icon: CheckCircle,
                  title: "Verified Platform",
                  description: "ISO 27001 certified and audited security"
                }
              ].map((item, index) => (
                <div key={index} className="text-center p-6">
                  <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact & Support Section */}
        <section className="py-16 bg-blue-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <Phone className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">24/7 Support</h3>
                <p className="text-blue-200">+91-80-4718-8888</p>
              </div>
              <div className="text-center">
                <Mail className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Email Support</h3>
                <p className="text-blue-200">support@fintekpro.com</p>
              </div>
              <div className="text-center">
                <Globe className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Servicing at 15+ countries</h3>
              </div>
            </div>
          </div>
        </section>
      
    </div>
  );
}