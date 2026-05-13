import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, PlaneTakeoff, Building2, CreditCard, FileText, LucideShield as LucideShield, 
  Calculator, Users, Phone, Mail, MapPin, Clock, CheckCircle, 
  ArrowRight, Sparkles, TrendingUp, Banknote, Receipt, 
  Home, Car, GraduationCap, Heart, AlertTriangle, Info,
  Star, Target, Award, Crown, Zap, ChevronRight, Check
} from "lucide-react";

interface NRIService {
  id: string;
  title: string;
  description: string;
  category: string;
  features: string[];
  processingTime: string;
  minimumAmount?: number;
  currency: string;
  rating: number;
  isPopular?: boolean;
  isPremium?: boolean;
  icon: any;
  benefits: string[];
  href?: string;
}

interface RemittanceOption {
  id: string;
  name: string;
  provider: string;
  exchangeRate: number;
  fee: number;
  processingTime: string;
  maxAmount: number;
  features: string[];
}

interface NRICountry {
  code: string;
  name: string;
  flag: string;
  regulations: string[];
  taxTreaty: boolean;
  popularServices: string[];
}

// Comprehensive NRI Services
const nriServices: NRIService[] = [
  // Banking Services
  {
    id: "nre-account",
    title: "NRE Savings Account",
    description: "Fully repatriable account for NRIs with tax-free interest and easy fund transfer",
    category: "Banking",
    features: ["Fully Repatriable", "Tax-free Interest", "Multi-currency Support", "Online Banking"],
    processingTime: "3-5 business days",
    currency: "INR",
    rating: 4.8,
    isPopular: true,
    icon: CreditCard,
    benefits: ["No tax on interest earned", "Full repatriation facility", "Joint account with resident Indian", "Debit card facility"]
  },
  {
    id: "nro-account",
    title: "NRO Savings Account", 
    description: "Rupee account for managing income earned in India with partial repatriation",
    category: "Banking",
    features: ["Rupee Denominated", "Partial Repatriable", "Income Management", "Resident Nominee"],
    processingTime: "3-5 business days",
    currency: "INR",
    rating: 4.6,
    icon: Building2,
    benefits: ["Manage India income", "Current/Fixed deposit facility", "Repatriate up to USD 1 million per year", "Easy account maintenance"]
  },
  {
    id: "fcnr-deposit",
    title: "FCNR Fixed Deposit",
    description: "Foreign currency term deposits with exchange rate protection and tax benefits",
    category: "Banking",
    features: ["Exchange Rate Protection", "Tax-free Interest", "Major Currencies", "Flexible Tenure"],
    processingTime: "1-2 business days",
    minimumAmount: 1000,
    currency: "USD/GBP/EUR/JPY/AUD/CAD",
    rating: 4.9,
    isPremium: true,
    icon: Globe,
    benefits: ["No exchange rate risk", "Interest exempt from tax", "Loan facility up to 90%", "Minimum tenure 1 year"]
  },
  
  // Investment Services
  {
    id: "pis-trading",
    title: "Portfolio Investment Scheme (PIS)",
    description: "Invest in Indian stocks, mutual funds and securities with full regulatory compliance",
    category: "Investment",
    features: ["Stock Trading", "Mutual Funds", "Demat Account", "Regulatory Compliance"],
    processingTime: "5-7 business days",
    currency: "INR",
    rating: 4.7,
    isPopular: true,
    icon: TrendingUp,
    benefits: ["Invest up to 5% stake in listed companies", "Full repatriation of proceeds", "Professional portfolio management", "Tax-efficient investments"]
  },
  {
    id: "nri-mutual-funds",
    title: "NRI Mutual Funds",
    description: "Curated mutual fund portfolio designed specifically for Non-Resident Indians",
    category: "Investment",
    features: ["Diversified Portfolio", "Systematic Investment", "Tax Efficiency", "Professional Management"],
    processingTime: "2-3 business days",
    minimumAmount: 500,
    currency: "INR",
    rating: 4.5,
    icon: Target,
    benefits: ["ELSS tax benefits", "Global diversification", "SIP facility available", "Easy redemption process"]
  },
  {
    id: "real-estate-investment",
    title: "Real Estate Investment Advisory",
    description: "Expert guidance for property investment in India with legal and tax compliance",
    category: "Investment",
    features: ["Legal Compliance", "Market Research", "Tax Advisory", "End-to-end Support"],
    processingTime: "10-15 business days",
    currency: "INR",
    rating: 4.4,
    isPremium: true,
    icon: Home,
    benefits: ["FEMA compliance assistance", "Property due diligence", "Repatriation guidance", "Tax optimization strategies"]
  },
  
  // Remittance Services
  {
    id: "money-transfer",
    title: "International Money Transfer",
    description: "Send money to India with competitive exchange rates and multiple transfer options",
    category: "Remittance",
    features: ["Competitive Rates", "Multiple Options", "Quick Transfer", "24/7 Support"],
    processingTime: "0-2 business days",
    currency: "Multiple",
    rating: 4.6,
    isPopular: true,
    icon: PlaneTakeoff,
    benefits: ["Best exchange rates", "Bank-to-bank transfer", "Online tracking", "Regulatory compliance"]
  },
  {
    id: "education-remittance",
    title: "Education Loan Remittance",
    description: "Specialized remittance services for education expenses with preferential rates",
    category: "Remittance",
    features: ["Education Focused", "Preferential Rates", "Direct University Payment", "LRS Compliance"],
    processingTime: "1-2 business days",
    currency: "Multiple",
    rating: 4.7,
    icon: GraduationCap,
    benefits: ["Direct university payment", "LRS limit optimization", "Document assistance", "Multi-currency support"]
  },
  {
    id: "medical-emergency",
    title: "Emergency Medical Remittance",
    description: "Quick remittance facility for medical emergencies with priority processing",
    category: "Remittance",
    features: ["Priority Processing", "Emergency Support", "24/7 Availability", "Hospital Direct Payment"],
    processingTime: "Within hours",
    currency: "Multiple",
    rating: 4.9,
    icon: Heart,
    benefits: ["Fastest processing", "Hospital direct payment", "Emergency helpline", "Minimal documentation"]
  },
  
  // Tax & Compliance
  {
    id: "tax-compliance",
    title: "NRI Tax Compliance",
    description: "Complete tax filing and compliance services for NRIs across multiple jurisdictions",
    category: "Tax & Compliance",
    features: ["Multi-jurisdiction", "Expert CA Support", "TDS Management", "Treaty Benefits"],
    processingTime: "7-10 business days",
    currency: "INR",
    rating: 4.8,
    isPremium: true,
    icon: FileText,
    benefits: ["Double taxation avoidance", "TDS refund assistance", "Tax treaty optimization", "Year-round support"]
  },
  {
    id: "fema-compliance",
    title: "FEMA Compliance Services",
    description: "Expert assistance with Foreign Exchange Management Act compliance and reporting",
    category: "Tax & Compliance",
    features: ["FEMA Expertise", "Reporting Assistance", "Legal Support", "Documentation"],
    processingTime: "5-7 business days",
    currency: "INR",
    rating: 4.6,
    icon: LucideShield,
    benefits: ["Expert FEMA guidance", "Compliance documentation", "Penalty protection", "Regular updates"]
  },
  {
    id: "form-15ca-15cb",
    title: "Form 15CA/15CB Filing",
    description: "CA-assisted international remittance compliance with DTAA benefits and digital signature",
    category: "Tax & Compliance",
    features: ["CA Assisted", "DTAA Optimization", "Digital Signature", "Rule 37BB Compliance"],
    processingTime: "2-3 business days",
    currency: "INR",
    rating: 4.9,
    isPopular: true,
    isPremium: true,
    icon: FileText,
    benefits: ["CA-certified Form 15CB", "DTAA treaty benefits", "Bank compliance pack", "8-year audit trail"],
    href: "/tax-compliance/form15"
  },
  
  // Advisory Services
  {
    id: "financial-planning",
    title: "NRI Financial Planning",
    description: "Comprehensive financial planning considering global assets and India-specific goals",
    category: "Advisory",
    features: ["Holistic Planning", "Global Assets", "India Goals", "Regular Reviews"],
    processingTime: "7-14 business days",
    currency: "Multiple",
    rating: 4.9,
    isPremium: true,
    icon: Calculator,
    benefits: ["Retirement planning", "Child education planning", "Asset allocation", "Tax optimization"]
  },
  {
    id: "immigration-advisory",
    title: "Immigration & Visa Advisory",
    description: "Expert guidance on visa processes, citizenship matters and immigration compliance",
    category: "Advisory",
    features: ["Visa Guidance", "Citizenship Advisory", "Documentation", "Legal Support"],
    processingTime: "5-10 business days",
    currency: "Multiple",
    rating: 4.4,
    icon: Users,
    benefits: ["Visa application support", "OCI/PIO services", "Legal documentation", "Process guidance"]
  }
];

// Popular NRI destination countries
const nriCountries: NRICountry[] = [
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    regulations: ["FATCA Compliance", "Tax Treaty Benefits", "Form 1040 Filing"],
    taxTreaty: true,
    popularServices: ["Money Transfer", "Investment Advisory", "Tax Compliance"]
  },
  {
    code: "UK",
    name: "United Kingdom", 
    flag: "🇬🇧",
    regulations: ["HMRC Compliance", "Double Taxation Relief", "Tier 2 Visa Support"],
    taxTreaty: true,
    popularServices: ["FCNR Deposits", "Property Investment", "Remittances"]
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    regulations: ["Exchange Control Regulations", "Economic Substance Rules"],
    taxTreaty: true,
    popularServices: ["NRE Accounts", "Business Setup", "Investment Advisory"]
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    regulations: ["CRA Compliance", "TFSA Considerations", "Immigration Rules"],
    taxTreaty: true,
    popularServices: ["Education Remittance", "RRSP Advisory", "Tax Planning"]
  },
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    regulations: ["ATO Compliance", "Superannuation Rules", "Visa Requirements"],
    taxTreaty: true,
    popularServices: ["Superannuation Advisory", "Property Investment", "Remittances"]
  },
  {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    regulations: ["IRAS Compliance", "CPF Considerations", "Work Permit Rules"],
    taxTreaty: true,
    popularServices: ["Investment Advisory", "Banking Services", "Tax Optimization"]
  }
];

// Sample remittance providers
const remittanceOptions: RemittanceOption[] = [
  {
    id: "bank-wire",
    name: "Bank Wire Transfer",
    provider: "Major Banks",
    exchangeRate: 83.25,
    fee: 25,
    processingTime: "2-3 business days",
    maxAmount: 250000,
    features: ["Secure", "Widely Accepted", "Bank-to-Bank"]
  },
  {
    id: "online-transfer",
    name: "Online Money Transfer",
    provider: "Digital Platforms",
    exchangeRate: 83.45,
    fee: 5,
    processingTime: "0-1 business day",
    maxAmount: 10000,
    features: ["Fast", "Competitive Rates", "Real-time Tracking"]
  },
  {
    id: "forex-card",
    name: "Forex Card Load",
    provider: "Forex Services",
    exchangeRate: 83.15,
    fee: 0,
    processingTime: "Instant",
    maxAmount: 25000,
    features: ["Instant", "No Transfer Fee", "Multiple Currencies"]
  }
];

export default function NRIServices() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState<NRIService | null>(null);
  const [remittanceAmount, setRemittanceAmount] = useState(1000);
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [, setLocation] = useLocation();
  
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const categories = ["All", "Banking", "Investment", "Remittance", "Tax & Compliance", "Advisory"];

  const filteredServices = nriServices.filter(service => {
    const matchesCategory = activeCategory === "All" || service.category === activeCategory;
    const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedCountryData = nriCountries.find(country => country.code === selectedCountry);

  const handleServiceInquiry = (service: NRIService) => {
    // If service has a direct href, navigate to it
    if (service.href) {
      if (!isAuthenticated) {
        toast({
          title: "Login Required",
          description: "Please login to access this service.",
        });
        return;
      }
      setLocation(service.href);
      return;
    }
    
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to inquire about NRI services.",
      });
      return;
    }

    toast({
      title: "Inquiry Submitted",
      description: `Our NRI specialist will contact you about ${service.title} within 24 hours.`,
    });
  };

  const calculateRemittanceCost = (option: RemittanceOption) => {
    return (remittanceAmount * option.exchangeRate) - option.fee;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 rounded-3xl p-8 md:p-12 text-foreground overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-card/10 backdrop-blur-sm rounded-xl">
              <Globe className="h-8 w-8" />
            </div>
            <Badge variant="secondary" className="bg-card/20 text-foreground border-white/30">
              NRI Services
            </Badge>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Complete NRI Financial Services
          </h1>
          <p className="text-xl mb-8 text-blue-100 max-w-3xl leading-relaxed">
            Banking, investments, remittances, and compliance services designed specifically for Non-Resident Indians across the globe.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button size="lg" className="bg-card text-blue-600 hover:bg-blue-50 dark:bg-blue-950/30" data-testid="button-get-started">
              Get Started Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-foreground hover:bg-card/10" data-testid="button-speak-advisor">
              <Phone className="mr-2 h-5 w-5" />
              Speak to NRI Advisor
            </Button>
          </div>
        </div>
      </div>

      {/* Country Selection & Quick Info */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Select Your Country of Residence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {nriCountries.map(country => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedCountry === country.code 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-border hover:border-blue-300 dark:border-blue-700'
                  }`}
                  data-testid={`button-country-${country.code}`}
                >
                  <div className="text-2xl mb-2">{country.flag}</div>
                  <div className="font-semibold text-sm">{country.name}</div>
                  {country.taxTreaty && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Tax Treaty
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-green-600" />
              {selectedCountryData?.name} Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Popular Services</h4>
              <div className="space-y-1">
                {selectedCountryData?.popularServices.map(service => (
                  <div key={service} className="text-sm text-muted-foreground flex items-center">
                    <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                    {service}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Key Regulations</h4>
              <div className="space-y-1">
                {selectedCountryData?.regulations.map(regulation => (
                  <div key={regulation} className="text-sm text-muted-foreground flex items-center">
                    <LucideShield className="h-3 w-3 mr-2 text-blue-500" />
                    {regulation}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Section */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <ScrollableTabsList className="grid grid-cols-3 lg:grid-cols-6 w-full sm:w-auto">
            {categories.map(category => (
              <TabsTrigger 
                key={category} 
                value={category}
                className="text-xs sm:text-sm"
                data-testid={`tab-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category}
              </TabsTrigger>
            ))}
          </ScrollableTabsList>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search NRI services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64"
              data-testid="input-search-services"
            />
          </div>
        </div>

        <TabsContent value={activeCategory} className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => (
              <Card key={service.id} className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200">
                {service.isPremium && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-400 to-yellow-600 text-yellow-900 dark:text-yellow-100 px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    <Crown className="h-3 w-3 inline mr-1" />
                    PREMIUM
                  </div>
                )}
                {service.isPopular && (
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-purple-600 text-foreground px-3 py-1 text-xs font-semibold rounded-br-lg">
                    <Star className="h-3 w-3 inline mr-1" />
                    POPULAR
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <service.icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{service.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`h-3 w-3 ${i < Math.floor(service.rating) ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} 
                              />
                            ))}
                            <span className="text-sm text-muted-foreground ml-1">{service.rating}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{service.category}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Processing: {service.processingTime}</span>
                    </div>
                    {service.minimumAmount && (
                      <div className="flex items-center gap-2 text-sm">
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Min: {service.currency} {service.minimumAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm">Key Features:</h5>
                    <div className="flex flex-wrap gap-1">
                      {service.features.slice(0, 3).map(feature => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {service.features.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{service.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm">Benefits:</h5>
                    <div className="space-y-1">
                      {service.benefits.slice(0, 2).map(benefit => (
                        <div key={benefit} className="text-xs text-muted-foreground flex items-start">
                          <Check className="h-3 w-3 mr-1 text-green-500 mt-0.5 flex-shrink-0" />
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1" 
                      onClick={() => handleServiceInquiry(service)}
                      data-testid={`button-inquire-${service.id}`}
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedService(service)}
                      data-testid={`button-details-${service.id}`}
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Remittance Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-green-600" />
            Remittance Calculator
          </CardTitle>
          <p className="text-muted-foreground">Compare rates and fees for sending money to India</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount to Send</label>
              <Input
                type="number"
                value={remittanceAmount}
                onChange={(e) => setRemittanceAmount(Number(e.target.value))}
                data-testid="input-remittance-amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">From Currency</label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger data-testid="select-from-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" data-testid="button-calculate-remittance">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {remittanceOptions.map(option => (
              <div key={option.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{option.name}</h4>
                    <p className="text-sm text-muted-foreground">{option.provider}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ₹{calculateRemittanceCost(option).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rate: {option.exchangeRate} | Fee: ${option.fee}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{option.processingTime}</span>
                  <div className="flex gap-1">
                    {option.features.map(feature => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact & Support */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              NRI Customer Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">+91-80-4718-1000 (India)</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">nri@fintekpro.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">24/7 Support Available</span>
              </div>
            </div>
            <Button className="w-full" data-testid="button-contact-support">
              <Phone className="mr-2 h-4 w-4" />
              Call Now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Relationship Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get personalized service from a dedicated NRI relationship manager for all your financial needs.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>Dedicated point of contact</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>Priority service</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>Customized solutions</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" data-testid="button-assign-rm">
              <Award className="mr-2 h-4 w-4" />
              Assign Relationship Manager
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}