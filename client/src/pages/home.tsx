import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { MarketTicker } from "@/components/dashboard/market-ticker";
import { MarketChart } from "@/components/dashboard/market-chart";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { MarketMovers } from "@/components/dashboard/market-movers";
import { MarketNews } from "@/components/dashboard/market-news";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  TrendingUp, 
  Shield, 
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
  const currentUser = user || fallbackUser;
  const userId = (currentUser as any)?.id || "demo-user-1";
  const portfolioId = `portfolio-${userId}`;
  
  // Get greeting based on time of day
  const getGreeting = () => {
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
  
  // Fetch real-time portfolio value
  const { data: portfolios } = useQuery({
    queryKey: ["/api/portfolios", userId],
    enabled: !!userId,
  });
  
  const { data: holdings } = useQuery({
    queryKey: ["/api/portfolios", portfolioId, "holdings"],
    enabled: !!portfolioId,
  });
  
  // Calculate total value from actual holdings
  const totalValue = Array.isArray(holdings) ? holdings.reduce((sum: number, holding: any) => {
    return sum + (holding.currentValue || 0);
  }, 0) : 2850000; // Updated realistic fallback

  const platformFeatures = [
    {
      title: "AI-Powered Portfolio Management",
      description: "Advanced portfolio analytics with real-time rebalancing suggestions and risk optimization using machine learning algorithms.",
      icon: Cpu,
      color: "blue",
      stats: "₹28.5L+ Avg Portfolio Value"
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
      stats: "15,000+ Investment Options"
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
      description: "MF Central integration with 2,500+ schemes",
      icon: Coins,
      color: "blue",
      route: "/mutual-funds",
      features: ["Live NAV", "SIP Calculator", "Goal Planning"],
      volume: "₹45.2L Cr AUM"
    },
    {
      name: "Portfolio Tracker",
      description: "AI-powered portfolio management & analytics",
      icon: PieChart,
      color: "green", 
      route: "/portfolio",
      features: ["Real-time Tracking", "Risk Analysis", "Rebalancing"],
      volume: "₹12.8L+ Portfolios"
    },
    {
      name: "IPO Center",
      description: "Complete IPO lifecycle management",
      icon: Building,
      color: "purple",
      route: "/ipo",
      features: ["Live Applications", "GMP Tracking", "Allotment Status"],
      volume: "45+ Active IPOs"
    },
    {
      name: "Market Intelligence",
      description: "Real-time market data & analytics",
      icon: TrendingUp,
      color: "red",
      route: "/markets", 
      features: ["Live Quotes", "Technical Charts", "News Feed"],
      volume: "5,000+ Stocks Tracked"
    },
    {
      name: "Bonds & NCDs",
      description: "Fixed income investment platform",
      icon: Receipt,
      color: "yellow",
      route: "/unlisted",
      features: ["Government Bonds", "Corporate NCDs", "Tax-free Bonds"],
      volume: "₹85.4K Cr Issuances"
    },
    {
      name: "Loan Services",
      description: "Personal & business loan solutions", 
      icon: CreditCard,
      color: "indigo",
      route: "/loans",
      features: ["LAS Facility", "Digital KYC", "Instant Approval"],
      volume: "₹2,850 Cr Disbursed"
    }
  ];

  const financialServices = [
    {
      category: "Investment Services",
      services: [
        { name: "NSDL Services", desc: "410M+ demat accounts", icon: Database, route: "/nsdl-services" },
        { name: "CDSL Services", desc: "6.5Cr+ BO accounts", icon: Shield, route: "/cdsl-services" },
        { name: "Pre-IPO Access", desc: "Unicorn equity stakes", icon: Sparkles, route: "/pre-ipo" },
        { name: "Unlisted Securities", desc: "Pre-IPO opportunities", icon: Building2, route: "/unlisted" }
      ]
    },
    {
      category: "Loans & Credit",
      services: [
        { name: "Personal Loan", desc: "Quick personal loans up to ₹40L", icon: CreditCard, route: "/loans/personal" },
        { name: "Home Loan", desc: "Competitive home loan rates", icon: Building2, route: "/loans/home" },
        { name: "Business Loan", desc: "SME & corporate financing", icon: Briefcase, route: "/loans/business" },
        { name: "Loan Against Securities", desc: "LAS facility up to 80% value", icon: Receipt, route: "/loans/las" }
      ]
    },
    {
      category: "Professional Tools",
      services: [
        { name: "Calculators", desc: "25+ financial tools", icon: Calculator, route: "/calculators" },
        { name: "CIBIL Services", desc: "Credit score check", icon: Activity, route: "/cibil" },
        { name: "Capital Gains", desc: "Tax reports", icon: Receipt, route: "/capital-gains" },
        { name: "CKYC Verification", desc: "KYC compliance", icon: CheckCircle, route: "/ckyc" }
      ]
    }
  ];

  const platformStats = [
    { label: "Active Users", value: "2.5M+", icon: Users, color: "blue" },
    { label: "Portfolio Value", value: "₹18,500 Cr", icon: PieChart, color: "green" },
    { label: "Daily Trades", value: "45,000+", icon: TrendingUp, color: "purple" },
    { label: "API Calls/Day", value: "2.5M", icon: Zap, color: "orange" }
  ];

  const colorClasses = {
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    green: "text-green-600 bg-green-50 border-green-200", 
    purple: "text-purple-600 bg-purple-50 border-purple-200",
    red: "text-red-600 bg-red-50 border-red-200",
    orange: "text-orange-600 bg-orange-50 border-orange-200",
    yellow: "text-yellow-600 bg-yellow-50 border-yellow-200",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-200",
    teal: "text-teal-600 bg-teal-50 border-teal-200"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" data-testid="home-page">
      <EnhancedNavigation />
      <MarketTicker />
      
      <main className="relative">
        {/* Hero Section with Enhanced Design */}
        <section className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-purple-900 text-white py-20 overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white/20 animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-purple-300/30 animate-bounce slow"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Content */}
              <div className="space-y-8">
                {/* Personalized Greeting */}
                {isAuthenticated && currentUser && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20" data-testid="user-greeting">
                    <p className="text-lg text-blue-100">
                      {getGreeting()}, <span className="font-semibold text-yellow-400">{getUserDisplayName()}</span>! 👋
                    </p>
                    <p className="text-sm text-blue-200 mt-1">
                      Welcome back to your financial dashboard
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Badge className="bg-yellow-500 text-yellow-900 text-sm px-4 py-2 font-semibold">
                    🚀 India's #1 Fintech Platform
                  </Badge>
                  <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                    Build Wealth with 
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent block">
                      Smart Investments
                    </span>
                  </h1>
                  <p className="text-xl text-blue-100 leading-relaxed">
                    Complete financial platform with AI-powered portfolio management, real-time market data, 
                    and access to 15,000+ investment options. Start your wealth journey with ₹500.
                  </p>
                </div>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/wealth-management">
                    <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold px-8 py-4 rounded-xl shadow-2xl transform hover:scale-105 transition-all">
                      <Target className="w-5 h-5 mr-2" />
                      Start Smart Investing
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-xl backdrop-blur-sm">
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Watch Demo
                  </Button>
                </div>

                {/* Platform Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/20">
                  {platformStats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <stat.icon className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
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
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why Choose FintekPro?
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
                          ? 'border-blue-500 bg-blue-50 shadow-lg' 
                          : 'border-gray-200 hover:border-gray-300'
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
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                          <p className="text-gray-600 mb-3">{feature.description}</p>
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
                  className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-2xl p-8 text-white shadow-2xl"
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
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
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
        <section className="py-20 bg-gray-50" data-testid="investment-products-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Investment Products</h2>
              <p className="text-xl text-gray-600">Complete suite of investment solutions for wealth creation</p>
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
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </CardTitle>
                        <p className="text-gray-600">{product.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 mb-4">
                          {product.features.map((feature, fIndex) => (
                            <div key={fIndex} className="flex items-center text-sm text-gray-600">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900">{product.volume}</p>
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
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Financial Services</h2>
              <p className="text-xl text-gray-600">Comprehensive financial services ecosystem</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {financialServices.map((category, index) => (
                <div key={index} className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <div className="w-3 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-3"></div>
                    {category.category}
                  </h3>
                  <div className="space-y-4">
                    {category.services.map((service, sIndex) => {
                      const ServiceIcon = service.icon;
                      return (
                        <Link key={sIndex} href={service.route}>
                          <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 hover:border-blue-300">
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <ServiceIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {service.name}
                                  </h4>
                                  <p className="text-sm text-gray-600">{service.desc}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
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

        {/* Live Market Data Section */}
        <section className="py-20 bg-gradient-to-r from-gray-900 to-blue-900 text-white">
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
                <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold px-8 py-4 rounded-xl">
                  <Activity className="w-5 h-5 mr-2" />
                  Explore Full Market Data
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Security & Trust Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Security & Trust</h2>
              <p className="text-xl text-gray-600">Your security is our top priority</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: Shield,
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
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
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
                <h3 className="text-lg font-semibold mb-2">Global Presence</h3>
                <p className="text-blue-200">Available in 15+ countries</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}