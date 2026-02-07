import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { 
  Building2, Crown, Globe, TrendingUp, Shield, Award, ArrowRight, Sparkles,
  Banknote, Target, FileText, Users, Briefcase, Calculator, Phone, Mail,
  CheckCircle, Star, Lock, Zap, PiggyBank, DollarSign, Percent, Clock,
  BarChart3, LineChart, Activity, Wallet, CreditCard, MapPin, Calendar
} from "lucide-react";

interface GiftCityProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  minimumInvestment: number;
  currency: string;
  expectedReturns: string;
  riskLevel: string;
  provider: string;
  features: string[];
  regulatoryBenefits: string[];
  eligibility: string[];
  isPremium: boolean;
  isLimited?: boolean;
}

// GIFT City IFSC Premium Products
const giftCityProducts: GiftCityProduct[] = [
  // Alternative Investment Funds (AIFs)
  {
    id: "aif-1",
    name: "GIFT City Private Equity AIF",
    description: "Category II AIF focusing on private equity investments across Asia-Pacific region with tax-efficient structure",
    category: "Alternative Investment Funds",
    minimumInvestment: 10000000,
    currency: "USD",
    expectedReturns: "18-25%",
    riskLevel: "High",
    provider: "GIFT City Asset Management",
    features: ["Professional Management", "Tax Efficient", "Diversified Portfolio", "Quarterly Reports"],
    regulatoryBenefits: ["No STT/CTT", "Tax Pass-through", "SEBI Regulated", "FPI Friendly"],
    eligibility: ["HNI (₹2Cr+ Net Worth)", "Institutional Investors", "Non-resident Indians"],
    isPremium: true,
    isLimited: true
  },
  {
    id: "aif-2", 
    name: "GIFT City Real Estate AIF",
    description: "Category I AIF investing in commercial real estate across India with REIT-like benefits",
    category: "Alternative Investment Funds",
    minimumInvestment: 5000000,
    currency: "USD",
    expectedReturns: "15-20%",
    riskLevel: "Medium-High",
    provider: "GIFT Realty Partners",
    features: ["Real Estate Focus", "Professional Management", "Regular Distributions", "Asset-backed"],
    regulatoryBenefits: ["Tax Benefits", "SEBI Regulated", "Transparency", "Professional Management"],
    eligibility: ["HNI (₹1Cr+ Net Worth)", "Family Offices", "Institutional Investors"],
    isPremium: true
  },
  
  // IFSC Banking Services
  {
    id: "ifsc-bank-1",
    name: "GIFT City Multi-Currency Account",
    description: "Offshore banking account supporting 15+ currencies with competitive rates and global transfer facilities",
    category: "IFSC Banking",
    minimumInvestment: 100000,
    currency: "Multi-Currency",
    expectedReturns: "3-5%",
    riskLevel: "Low",
    provider: "GIFT City International Bank",
    features: ["Multi-Currency Support", "Global Transfers", "Zero FX Margins", "Relationship Manager"],
    regulatoryBenefits: ["IFSC Regulatory Benefits", "Tax Efficient", "Global Compliance", "KYC Once"],
    eligibility: ["NRIs", "HNIs", "Corporate Clients", "Institutional Investors"],
    isPremium: true
  },
  {
    id: "ifsc-bank-2",
    name: "GIFT City Trade Finance Solutions",
    description: "Complete trade finance ecosystem including LC, Bank Guarantees, and Export Credit with competitive rates",
    category: "IFSC Banking", 
    minimumInvestment: 500000,
    currency: "USD",
    expectedReturns: "8-12%",
    riskLevel: "Medium",
    provider: "GIFT Trade Finance Ltd",
    features: ["Trade Finance", "LC Facilities", "Export Credit", "Global Network"],
    regulatoryBenefits: ["IFSC Benefits", "Regulatory Arbitrage", "Tax Efficiency", "Faster Processing"],
    eligibility: ["Exporters", "Importers", "Trading Companies", "Manufacturing Units"],
    isPremium: true
  },

  // Structured Products
  {
    id: "structured-1",
    name: "GIFT City Principal Protected Note",
    description: "USD denominated structured product with 100% capital protection and equity upside participation",
    category: "Structured Products",
    minimumInvestment: 250000,
    currency: "USD",
    expectedReturns: "6-18%",
    riskLevel: "Medium",
    provider: "GIFT Structured Solutions",
    features: ["Capital Protection", "Equity Upside", "USD Denominated", "3-Year Maturity"],
    regulatoryBenefits: ["Tax Efficient", "IFSC Regulated", "FPI Compliant", "Transparent Pricing"],
    eligibility: ["HNIs", "NRIs", "Family Offices", "Institutional Clients"],
    isPremium: true
  },
  {
    id: "structured-2",
    name: "GIFT City Commodity Linked Note",
    description: "Structured note linked to basket of commodities providing inflation hedge with guaranteed returns",
    category: "Structured Products",
    minimumInvestment: 500000,
    currency: "USD",
    expectedReturns: "10-15%",
    riskLevel: "Medium-High", 
    provider: "GIFT Commodity Partners",
    features: ["Commodity Exposure", "Inflation Hedge", "Professional Management", "Liquidity Options"],
    regulatoryBenefits: ["IFSC Benefits", "Tax Arbitrage", "Global Compliance", "Risk Management"],
    eligibility: ["HNIs", "Institutional Investors", "Corporate Treasuries", "Family Offices"],
    isPremium: true
  },

  // Wealth Management Services
  {
    id: "wealth-1",
    name: "GIFT City Family Office Services",
    description: "Comprehensive family office solutions including wealth structuring, succession planning, and global investments",
    category: "Wealth Management",
    minimumInvestment: 25000000,
    currency: "Multi-Currency",
    expectedReturns: "12-20%",
    riskLevel: "Customized",
    provider: "GIFT Wealth Advisory",
    features: ["Family Office Setup", "Wealth Structuring", "Succession Planning", "Tax Optimization"],
    regulatoryBenefits: ["IFSC Advantages", "Global Tax Planning", "Regulatory Efficiency", "Privacy Protection"],
    eligibility: ["Ultra HNI (₹25Cr+)", "Business Families", "Promoter Groups", "Institutional Families"],
    isPremium: true,
    isLimited: true
  },
  {
    id: "wealth-2",
    name: "GIFT City Investment Advisory",
    description: "Personalized investment advisory with global asset allocation and alternative investments access",
    category: "Wealth Management",
    minimumInvestment: 2500000,
    currency: "Multi-Currency", 
    expectedReturns: "15-22%",
    riskLevel: "Customized",
    provider: "GIFT Advisory Services",
    features: ["Personalized Advisory", "Global Assets", "Alternative Investments", "Regular Reviews"],
    regulatoryBenefits: ["IFSC Benefits", "Tax Optimization", "Global Access", "Professional Management"],
    eligibility: ["HNIs", "NRIs", "Corporate Treasuries", "Institutional Clients"],
    isPremium: true
  }
];

const categories = [
  { id: "all", name: "All Products", icon: Globe, count: giftCityProducts.length },
  { id: "Alternative Investment Funds", name: "Alternative Investment Funds", icon: TrendingUp, count: 2 },
  { id: "IFSC Banking", name: "IFSC Banking", icon: Banknote, count: 2 },
  { id: "Structured Products", name: "Structured Products", icon: BarChart3, count: 2 },
  { id: "Wealth Management", name: "Wealth Management", icon: Crown, count: 2 }
];

const regulatoryAdvantages = [
  {
    title: "Tax Efficiency",
    description: "No Securities Transaction Tax (STT) or Commodity Transaction Tax (CTT)",
    icon: Percent
  },
  {
    title: "Global Access", 
    description: "Access to global markets and international financial products",
    icon: Globe
  },
  {
    title: "Regulatory Arbitrage",
    description: "Benefit from IFSC's liberal regulatory framework",
    icon: Shield
  },
  {
    title: "FPI Benefits",
    description: "Foreign Portfolio Investment benefits and easier compliance",
    icon: FileText
  },
  {
    title: "Multi-Currency Operations",
    description: "Operate in multiple currencies without conversion hassles",
    icon: DollarSign
  },
  {
    title: "Professional Management",
    description: "Access to international fund managers and advisory services",
    icon: Users
  }
];

export default function GiftCity() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = giftCityProducts.filter(product => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "USD") {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (currency === "Multi-Currency") {
      return `$${(amount / 1000000).toFixed(1)}M+`;
    }
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  };

  return (
    <div className="p-6 space-y-6" data-testid="gift-city-page">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg">
            <Building2 className="h-8 w-8 text-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              GIFT City IFSC
            </h1>
            <p className="text-lg text-muted-foreground">
              Premium Financial Services for High-Net-Worth Clients
            </p>
          </div>
          <div className="ml-auto">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              <Crown className="h-3 w-3 mr-1" />
              Premium Zone
            </Badge>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Assets Under Management</p>
                  <p className="text-2xl font-bold text-foreground">$2.5B+</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">HNI Clients</p>
                  <p className="text-2xl font-bold text-foreground">500+</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Average Returns</p>
                  <p className="text-2xl font-bold text-foreground">18.5%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-8 w-8 text-indigo-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Global Markets</p>
                  <p className="text-2xl font-bold text-foreground">25+</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value="products" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" data-testid="tab-products">Premium Products</TabsTrigger>
          <TabsTrigger value="advantages" data-testid="tab-advantages">IFSC Advantages</TabsTrigger>
          <TabsTrigger value="contact" data-testid="tab-contact">Relationship Manager</TabsTrigger>
        </ScrollableTabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search premium products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {categories.map((category) => (
              <Card 
                key={category.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedCategory === category.id 
                    ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedCategory(category.id)}
                data-testid={`category-${category.id}`}
              >
                <CardContent className="p-4 text-center">
                  <category.icon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="font-semibold text-sm">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.count} Products</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="relative group hover:shadow-xl transition-all duration-300"
                data-testid={`product-card-${product.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold mb-1">{product.name}</CardTitle>
                      <Badge 
                        variant={product.isPremium ? "default" : "secondary"}
                        className={`mb-2 ${product.isPremium ? 'bg-purple-600' : ''}`}
                      >
                        {product.category}
                      </Badge>
                      {product.isLimited && (
                        <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Limited Access
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Minimum Investment</p>
                      <p className="font-bold text-lg text-purple-600">
                        {formatCurrency(product.minimumInvestment, product.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expected Returns</p>
                      <p className="font-bold text-lg text-green-600">{product.expectedReturns}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                      <Badge variant={
                        product.riskLevel === "High" ? "destructive" :
                        product.riskLevel === "Medium-High" ? "outline" :
                        product.riskLevel === "Medium" ? "secondary" : "default"
                      }>
                        {product.riskLevel}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Currency</p>
                      <p className="font-medium">{product.currency}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Key Features</p>
                    <div className="flex flex-wrap gap-1">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Regulatory Benefits */}
                  <div>
                    <p className="text-sm font-semibold mb-2">IFSC Benefits</p>
                    <div className="flex flex-wrap gap-1">
                      {product.regulatoryBenefits.slice(0, 2).map((benefit, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Provider */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Provided by</p>
                    <p className="font-medium">{product.provider}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700" data-testid={`button-invest-${product.id}`}>
                      <Wallet className="h-4 w-4 mr-1" />
                      Invest Now
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-details-${product.id}`}>
                      <FileText className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* IFSC Advantages Tab */}
        <TabsContent value="advantages" className="space-y-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Why Choose GIFT City IFSC?
            </h2>
            <p className="text-muted-foreground">
              India's first International Financial Services Centre offers unparalleled advantages for sophisticated investors
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regulatoryAdvantages.map((advantage, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <advantage.icon className="h-6 w-6 text-purple-600" />
                    </div>
                    <CardTitle className="text-lg">{advantage.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{advantage.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Benefits Section */}
          <Card className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-6 w-6 text-purple-600" />
                Exclusive IFSC Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Zero STT on equity transactions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">No CTT on commodity trades</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Tax pass-through for AIFs</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Global market access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Multi-currency operations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Liberal regulatory framework</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Relationship Manager Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-purple-600" />
                  Dedicated Relationship Manager
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-12 w-12 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Priya Sharma</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Senior Relationship Manager - GIFT City IFSC
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-purple-600" />
                      <span>+91 79 4040 5000</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-purple-600" />
                      <span>priya.sharma@fintekpro.com</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <span>GIFT City, Gandhinagar</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-schedule-call">
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule Call
                  </Button>
                  <Button variant="outline" data-testid="button-send-message">
                    <Mail className="h-4 w-4 mr-1" />
                    Send Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Office Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-purple-600" />
                  GIFT City Office
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Address</h4>
                  <p className="text-sm text-muted-foreground">
                    FintekPro IFSC Branch<br/>
                    Block A, 15th Floor<br/>
                    GIFT One Building<br/>
                    GIFT City, Gandhinagar - 382355<br/>
                    Gujarat, India
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Business Hours</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Monday - Friday:</span>
                      <span>9:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday:</span>
                      <span>10:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday:</span>
                      <span>Closed</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Services Available</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Portfolio Review & Strategy</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Global Investment Planning</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Tax Optimization Strategies</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Regulatory Compliance Support</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="button-book-visit">
                  <MapPin className="h-4 w-4 mr-1" />
                  Book Office Visit
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
              <p className="text-sm text-muted-foreground">
                Our relationship managers will contact you within 24 hours
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Full Name" data-testid="input-name" />
                <Input placeholder="Phone Number" data-testid="input-phone" />
                <Input placeholder="Email Address" className="md:col-span-2" data-testid="input-email" />
                <Input placeholder="Investment Interest (Optional)" className="md:col-span-2" data-testid="input-interest" />
              </div>
              <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700" data-testid="button-submit-contact">
                <Phone className="h-4 w-4 mr-1" />
                Request Callback
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}