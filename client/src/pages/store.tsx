import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Heart, ShoppingCart, Filter, Search, Star, TrendingUp, Shield, Clock, Grid, List, 
  SortAsc, SortDesc, X, Building2, Award, Plus, Globe, CreditCard, FileText, Users, 
  Briefcase, Banknote, Target, Crown, Landmark, Store as StoreIcon, ArrowRight, Sparkles, 
  Zap, ChevronRight, Check, ArrowUpDown, Package
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  subcategory?: string;
  productType: string;
  price?: number;
  minimumInvestment: number;
  riskLevel: string;
  expectedReturns: number;
  provider: string;
  features: string[];
  isFeatured: boolean;
  isPremium?: boolean;
  isNew?: boolean;
  badge?: string;
}

// Comprehensive FintekPro marketplace products
const mockProducts: Product[] = [
  // INVESTMENT PRODUCTS - MUTUAL FUNDS
  {
    id: "1",
    name: "HDFC Top 100 Fund",
    shortDescription: "Large cap equity fund with consistent performance and strong dividend history",
    category: "Investment Products",
    subcategory: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "medium",
    expectedReturns: 12.5,
    provider: "HDFC Asset Management",
    features: ["SIP Available", "Tax Efficient", "Professional Management", "Blue Chip Stocks"],
    isFeatured: true,
  },
  {
    id: "2",
    name: "Axis Small Cap Fund",
    shortDescription: "High growth potential small cap equity fund for aggressive investors",
    category: "Investment Products",
    subcategory: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "high",
    expectedReturns: 15.8,
    provider: "Axis Asset Management",
    features: ["High Growth Potential", "SIP Available", "Research Driven", "Long Term Wealth"],
    isFeatured: false,
  },

  // INVESTMENT PRODUCTS - IPO & PRE-IPO
  {
    id: "3",
    name: "Zomato IPO",
    shortDescription: "Food delivery platform IPO with strong market presence and growth potential",
    category: "Investment Products",
    subcategory: "IPO & Pre-IPO",
    productType: "ipo",
    minimumInvestment: 15000,
    riskLevel: "high",
    expectedReturns: 18.5,
    provider: "Zomato Limited",
    features: ["Public Offering", "Tech Sector", "Market Leader", "Growth Story"],
    isFeatured: true,
    badge: "HOT",
  },
  {
    id: "4",
    name: "Nykaa Pre-IPO Investment",
    shortDescription: "Beauty and cosmetics e-commerce leader with pre-IPO investment opportunity",
    category: "Investment Products",
    subcategory: "IPO & Pre-IPO",
    productType: "pre_ipo",
    minimumInvestment: 500000,
    riskLevel: "high",
    expectedReturns: 25.0,
    provider: "Nykaa E-Retail",
    features: ["Pre-IPO Access", "Beauty Sector", "High Growth", "Premium Investment"],
    isFeatured: true,
    isPremium: true,
    badge: "PREMIUM",
  },

  // INVESTMENT PRODUCTS - DEBENTURES & BONDS
  {
    id: "5",
    name: "Mahindra Finance NCD",
    shortDescription: "Non-convertible debentures with fixed returns and regular interest payments",
    category: "Investment Products",
    subcategory: "Debentures & Bonds",
    productType: "debenture",
    minimumInvestment: 10000,
    riskLevel: "medium",
    expectedReturns: 9.5,
    provider: "Mahindra Finance",
    features: ["Fixed Returns", "Regular Interest", "Rated Investment", "Tax Efficient"],
    isFeatured: false,
  },
  {
    id: "6",
    name: "Tata Capital Housing NCD",
    shortDescription: "Secured non-convertible debentures from trusted Tata Group company",
    category: "Investment Products",
    subcategory: "Debentures & Bonds",
    productType: "debenture",
    minimumInvestment: 25000,
    riskLevel: "low",
    expectedReturns: 8.8,
    provider: "Tata Capital Housing",
    features: ["Tata Brand", "Secured", "Regular Income", "Capital Protection"],
    isFeatured: true,
  },

  // GLOBAL PRODUCTS
  {
    id: "7",
    name: "US Tech Stock Portfolio",
    shortDescription: "Diversified portfolio of US technology stocks including Apple, Google, Microsoft",
    category: "Global Products",
    subcategory: "International Stocks",
    productType: "global_equity",
    minimumInvestment: 100000,
    riskLevel: "high",
    expectedReturns: 15.2,
    provider: "FintekPro Global",
    features: ["US Market Access", "Tech Focus", "Multi-Currency", "Global Diversification"],
    isFeatured: true,
    isNew: true,
    badge: "NEW",
  },
  {
    id: "8",
    name: "European ESG Fund",
    shortDescription: "Sustainable investing in European companies with strong ESG credentials",
    category: "Global Products",
    subcategory: "International Funds",
    productType: "global_fund",
    minimumInvestment: 50000,
    riskLevel: "medium",
    expectedReturns: 12.8,
    provider: "European Asset Management",
    features: ["ESG Focus", "European Markets", "Sustainable Investing", "EUR Exposure"],
    isFeatured: false,
  },

  // INSURANCE PRODUCTS
  {
    id: "9",
    name: "HDFC Life Click 2 Protect",
    shortDescription: "Comprehensive term insurance with high cover and online convenience",
    category: "Insurance",
    subcategory: "Life Insurance",
    productType: "insurance",
    price: 18000,
    minimumInvestment: 15000,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "HDFC Life Insurance",
    features: ["High Sum Assured", "Online Process", "Tax Benefits", "Affordable Premiums"],
    isFeatured: true,
  },
  {
    id: "10",
    name: "Star Health Red Carpet",
    shortDescription: "Comprehensive health insurance with no room rent limits and global coverage",
    category: "Insurance",
    subcategory: "Health Insurance",
    productType: "insurance",
    price: 25000,
    minimumInvestment: 8000,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "Star Health Insurance",
    features: ["No Room Rent Limit", "Global Coverage", "Cashless Claims", "Family Floater"],
    isFeatured: false,
  },

  // BANKING PRODUCTS
  {
    id: "11",
    name: "Bajaj Finance Fixed Deposit",
    shortDescription: "High-interest fixed deposits with flexible tenures and guaranteed returns",
    category: "Banking Products",
    subcategory: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 25000,
    riskLevel: "low",
    expectedReturns: 8.5,
    provider: "Bajaj Finance",
    features: ["High Interest", "Flexible Tenure", "Guaranteed Returns", "Senior Citizen Benefits"],
    isFeatured: true,
  },
  {
    id: "12",
    name: "HDFC Bank Regalia Credit Card",
    shortDescription: "Premium lifestyle credit card with exclusive rewards and airport lounge access",
    category: "Banking Products",
    subcategory: "Credit Cards",
    productType: "credit_card",
    minimumInvestment: 0,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "HDFC Bank",
    features: ["Reward Points", "Lounge Access", "Fuel Surcharge Waiver", "Premium Benefits"],
    isFeatured: false,
  },

  // PROFESSIONAL SERVICES
  {
    id: "13",
    name: "Wealth Advisory Premium",
    shortDescription: "Personalized investment advisory with dedicated relationship manager",
    category: "Professional Services",
    subcategory: "Advisory Services",
    productType: "advisory",
    minimumInvestment: 1000000,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "FintekPro Advisory",
    features: ["Dedicated RM", "Customized Portfolio", "Regular Reviews", "Tax Planning"],
    isFeatured: true,
    isPremium: true,
    badge: "PREMIUM",
  },
  {
    id: "14",
    name: "ITR Filing Expert",
    shortDescription: "Professional ITR filing service with expert CA consultation and compliance",
    category: "Professional Services",
    subcategory: "Tax Services",
    productType: "tax_service",
    price: 2999,
    minimumInvestment: 2999,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "FintekPro Tax Solutions",
    features: ["Expert CA", "All ITR Forms", "Notice Support", "Quick Turnaround"],
    isFeatured: false,
  }
];

const categoryTabs = [
  { value: "featured", label: "Featured", icon: Star },
  { value: "all", label: "All Products", icon: StoreIcon },
  { value: "investments", label: "Investment Products", icon: TrendingUp },
  { value: "global", label: "Global Products", icon: Globe },
  { value: "insurance", label: "Insurance", icon: Shield },
  { value: "banking", label: "Banking", icon: CreditCard },
  { value: "services", label: "Services", icon: Users }
];

const subcategories = {
  "Investment Products": ["Mutual Funds", "IPO & Pre-IPO", "Debentures & Bonds", "ETFs", "Unlisted Securities"],
  "Global Products": ["International Stocks", "International Funds", "Multi-Currency Deposits", "Global ETFs"],
  "Insurance": ["Life Insurance", "Health Insurance", "Motor Insurance", "Travel Insurance"],
  "Banking Products": ["Fixed Deposits", "Credit Cards", "Savings Accounts", "Current Accounts"],
  "Professional Services": ["Advisory Services", "Tax Services", "Legal Services", "Research Services"]
};

type SortField = "name" | "returns" | "investment" | "risk";
type SortDirection = "asc" | "desc";

export default function StorePage() {
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "featured";
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [selectedRisk, setSelectedRisk] = useState("All");
  const [selectedInvestmentRange, setSelectedInvestmentRange] = useState("All");
  const [selectedProvider, setSelectedProvider] = useState("All");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { addToCart, isAddingToCart } = useCart();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

  // Update URL when tab changes
  useEffect(() => {
    const newUrl = `/store?tab=${activeTab}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab]);

  // Map tab values to categories
  const getTabCategory = (tab: string): string => {
    switch(tab) {
      case "featured": return "Featured";
      case "all": return "All";
      case "investments": return "Investment Products";
      case "global": return "Global Products";
      case "insurance": return "Insurance";
      case "banking": return "Banking Products";
      case "services": return "Professional Services";
      default: return "All";
    }
  };

  const currentCategory = getTabCategory(activeTab);

  const handleAddToCart = (product: Product) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to add items to your cart.",
        action: (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/auth'}
            data-testid="toast-login-button"
          >
            Login
          </Button>
        ),
      });
      return;
    }

    addToCart({
      productId: product.id,
      quantity: 1,
      investmentAmount: product.minimumInvestment.toString()
    }, {
      onSuccess: () => {
        toast({
          title: "Added to Cart",
          description: `${product.name} has been added to your cart.`,
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to add product to cart. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const getFilteredProducts = () => {
    let products = mockProducts;

    // Filter by tab category
    if (activeTab === "featured") {
      products = products.filter(p => p.isFeatured);
    } else if (activeTab !== "all") {
      products = products.filter(p => p.category === currentCategory);
    }

    // Filter by search
    if (searchTerm) {
      products = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.provider.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by subcategory
    if (selectedSubcategory !== "All") {
      products = products.filter(p => p.subcategory === selectedSubcategory);
    }

    // Filter by risk level
    if (selectedRisk !== "All") {
      products = products.filter(p => p.riskLevel === selectedRisk.toLowerCase());
    }

    // Filter by investment range
    if (selectedInvestmentRange !== "All") {
      products = products.filter(p => {
        const min = p.minimumInvestment;
        switch(selectedInvestmentRange) {
          case "0-5000": return min <= 5000;
          case "5001-25000": return min > 5000 && min <= 25000;
          case "25001-100000": return min > 25000 && min <= 100000;
          case "100001+": return min > 100000;
          default: return true;
        }
      });
    }

    // Filter by provider
    if (selectedProvider !== "All") {
      products = products.filter(p => p.provider === selectedProvider);
    }

    // Sort products
    products.sort((a, b) => {
      let comparison = 0;
      switch(sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "returns":
          comparison = a.expectedReturns - b.expectedReturns;
          break;
        case "investment":
          comparison = a.minimumInvestment - b.minimumInvestment;
          break;
        case "risk":
          const riskOrder = { low: 1, medium: 2, high: 3 };
          comparison = riskOrder[a.riskLevel as keyof typeof riskOrder] - riskOrder[b.riskLevel as keyof typeof riskOrder];
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return products;
  };

  // Group products by subcategory for intelligent organization
  const getProductsBySubcategory = () => {
    const products = getFilteredProducts();
    const grouped: Record<string, Product[]> = {};
    
    products.forEach(product => {
      const subcat = product.subcategory || "Other";
      if (!grouped[subcat]) {
        grouped[subcat] = [];
      }
      grouped[subcat].push(product);
    });
    
    return grouped;
  };

  const filteredProducts = getFilteredProducts();
  const productsBySubcategory = getProductsBySubcategory();

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case "low": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "high": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400";
      default: return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getBadgeColor = (badge: string) => {
    switch(badge) {
      case "NEW": return "bg-green-500 text-white";
      case "HOT": return "bg-red-500 text-white";
      case "PREMIUM": return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white";
      default: return "bg-blue-500 text-white";
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const availableSubcategories = currentCategory && currentCategory !== "All" && currentCategory !== "Featured" 
    ? subcategories[currentCategory as keyof typeof subcategories] || []
    : [];

  // Get unique providers from all products
  const uniqueProviders = Array.from(new Set(mockProducts.map(p => p.provider))).sort();

  // Reset all filters when changing tabs
  useEffect(() => {
    setSelectedSubcategory("All");
    setSelectedRisk("All");
    setSelectedInvestmentRange("All");
    setSelectedProvider("All");
  }, [activeTab]);

  // Check if any filters are active
  const hasActiveFilters = selectedSubcategory !== "All" || selectedRisk !== "All" || 
    selectedInvestmentRange !== "All" || selectedProvider !== "All" || searchTerm !== "";

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedSubcategory("All");
    setSelectedRisk("All");
    setSelectedInvestmentRange("All");
    setSelectedProvider("All");
  };

  // Render product card
  const renderProductCard = (product: Product) => (
    <Card key={product.id} className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden" data-testid={`product-card-${product.id}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardHeader className="relative pb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2 flex-wrap">
            {product.isFeatured && (
              <Badge className="bg-gradient-to-r from-finance-blue to-blue-600 text-white text-xs">
                <Star className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
            {product.badge && (
              <Badge className={getBadgeColor(product.badge)}>
                {product.badge}
              </Badge>
            )}
            {product.isPremium && (
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleWishlist(product.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid={`wishlist-${product.id}`}
          >
            <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </Button>
        </div>
        <CardTitle className="text-lg group-hover:text-finance-blue transition-colors">
          {product.name}
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {product.shortDescription}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Building2 className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-500">{product.provider}</span>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Expected Returns</span>
            <span className="font-semibold text-green-600">{product.expectedReturns}%</span>
          </div>
          <div>
            <span className="text-gray-500 block">Min Investment</span>
            <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Badge className={getRiskColor(product.riskLevel)}>
            {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)} Risk
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-finance-blue hover:bg-finance-blue/90 group-hover:scale-105 transition-transform"
            onClick={() => openProductDetails(product)}
            data-testid={`view-details-${product.id}`}
          >
            View Details
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddToCart(product)}
            disabled={isAddingToCart}
            data-testid={`add-cart-${product.id}`}
            className="group-hover:scale-105 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Check if we should show subcategory grouping
  const showSubcategoryGrouping = activeTab !== "featured" && activeTab !== "all" && selectedSubcategory === "All" && Object.keys(productsBySubcategory).length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 p-6">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-finance-blue to-blue-600 rounded-2xl shadow-lg">
            <StoreIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              FintekPro Marketplace
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Complete financial ecosystem • Investment Products • Global Access • Professional Services
            </p>
          </div>
          <div className="ml-auto">
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 mr-2" />
              {mockProducts.length} Products Available
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Search and Filter Controls */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar Row */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Search products, providers, or features..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    data-testid="view-card"
                    className="rounded-r-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    data-testid="view-table"
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Advanced Filters Row */}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Filter className="h-4 w-4" />
                  <span>Filters:</span>
                </div>

                {/* Subcategory Filter */}
                {availableSubcategories.length > 0 && (
                  <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                    <SelectTrigger className="w-full lg:w-48" data-testid="subcategory-filter">
                      <SelectValue placeholder="All Subcategories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Subcategories</SelectItem>
                      {availableSubcategories.map(sub => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Risk Level Filter */}
                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-full lg:w-40" data-testid="risk-filter">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Risk Levels</SelectItem>
                    <SelectItem value="Low">Low Risk</SelectItem>
                    <SelectItem value="Medium">Medium Risk</SelectItem>
                    <SelectItem value="High">High Risk</SelectItem>
                  </SelectContent>
                </Select>

                {/* Investment Range Filter */}
                <Select value={selectedInvestmentRange} onValueChange={setSelectedInvestmentRange}>
                  <SelectTrigger className="w-full lg:w-48" data-testid="investment-range-filter">
                    <SelectValue placeholder="Investment Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Investment Ranges</SelectItem>
                    <SelectItem value="0-5000">₹0 - ₹5,000</SelectItem>
                    <SelectItem value="5001-25000">₹5,001 - ₹25,000</SelectItem>
                    <SelectItem value="25001-100000">₹25,001 - ₹1,00,000</SelectItem>
                    <SelectItem value="100001+">₹1,00,000+</SelectItem>
                  </SelectContent>
                </Select>

                {/* Provider Filter */}
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-full lg:w-56" data-testid="provider-filter">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Providers</SelectItem>
                    {uniqueProviders.map(provider => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="clear-filters"
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear All
                  </Button>
                )}
              </div>

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Search: "{searchTerm}"
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm("")} />
                    </Badge>
                  )}
                  {selectedSubcategory !== "All" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {selectedSubcategory}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSubcategory("All")} />
                    </Badge>
                  )}
                  {selectedRisk !== "All" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {selectedRisk} Risk
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedRisk("All")} />
                    </Badge>
                  )}
                  {selectedInvestmentRange !== "All" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      ₹{selectedInvestmentRange}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedInvestmentRange("All")} />
                    </Badge>
                  )}
                  {selectedProvider !== "All" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {selectedProvider}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedProvider("All")} />
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-7 w-full bg-white dark:bg-gray-800 p-1 rounded-lg shadow-md">
            {categoryTabs.map(tab => {
              const Icon = tab.icon;
              const count = tab.value === "featured" 
                ? mockProducts.filter(p => p.isFeatured).length
                : tab.value === "all"
                ? mockProducts.length
                : mockProducts.filter(p => p.category === getTabCategory(tab.value)).length;
              
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="data-[state=active]:bg-finance-blue data-[state=active]:text-white flex items-center gap-2"
                  data-testid={`tab-${tab.value}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <Badge variant="outline" className="ml-1 text-xs">{count}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          {categoryTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-6">
              {/* Results Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tab.label}
                    {selectedSubcategory !== "All" && ` - ${selectedSubcategory}`}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                    {searchTerm && ` for "${searchTerm}"`}
                  </p>
                </div>
                <Badge variant="outline" className="text-finance-blue border-finance-blue">
                  {filteredProducts.length} Results
                </Badge>
              </div>

              {/* Card View with Subcategory Grouping */}
              {viewMode === "card" && (
                <>
                  {showSubcategoryGrouping ? (
                    // Organized by subcategory
                    <div className="space-y-8">
                      {Object.entries(productsBySubcategory).map(([subcategory, products]) => (
                        <div key={subcategory}>
                          <div className="flex items-center gap-3 mb-4">
                            <Package className="h-5 w-5 text-finance-blue" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{subcategory}</h3>
                            <Badge variant="outline">{products.length} products</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {products.map(renderProductCard)}
                          </div>
                          <Separator className="mt-8" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Regular grid view
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProducts.map(renderProductCard)}
                    </div>
                  )}
                </>
              )}

              {/* Table View */}
              {viewMode === "table" && (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort("name")}
                            className="font-semibold"
                          >
                            Product Name
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort("returns")}
                            className="font-semibold"
                          >
                            Returns
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort("investment")}
                            className="font-semibold"
                          >
                            Min Investment
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort("risk")}
                            className="font-semibold"
                          >
                            Risk
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map(product => (
                        <TableRow key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`product-row-${product.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {product.isFeatured && <Star className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <div className="font-semibold">{product.name}</div>
                                <div className="text-xs text-gray-500 line-clamp-1">{product.shortDescription}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product.subcategory || product.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{product.provider}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">{product.expectedReturns}%</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRiskColor(product.riskLevel)}>
                              {product.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleWishlist(product.id)}
                                data-testid={`table-wishlist-${product.id}`}
                              >
                                <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openProductDetails(product)}
                                data-testid={`table-details-${product.id}`}
                              >
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddToCart(product)}
                                disabled={isAddingToCart}
                                data-testid={`table-cart-${product.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {/* No Results */}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12" data-testid="no-products">
                  <div className="text-gray-400 mb-4">
                    <ShoppingCart className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No products found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Try adjusting your search criteria or filters</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedSubcategory("All");
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      <ProductDetailsModal 
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWishlistToggle={toggleWishlist}
        isWishlisted={selectedProduct ? wishlist.includes(selectedProduct.id) : false}
      />
    </div>
  );
}
