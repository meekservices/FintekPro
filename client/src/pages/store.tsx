import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Heart, ShoppingCart, Search, Star, TrendingUp, Shield, Globe, CreditCard, FileText, 
  Briefcase, Banknote, Target, Crown, Landmark, Store as StoreIcon, ArrowRight, Sparkles, 
  Zap, ChevronRight, Plus, Building2, Award, Package, Flame
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

// Category quick links for navigation
const categoryLinks = [
  { name: "Mutual Funds", icon: TrendingUp, path: "/mutual-funds", color: "from-blue-500 to-blue-600" },
  { name: "IPO & Unlisted", icon: Sparkles, path: "/ipo", color: "from-purple-500 to-purple-600" },
  { name: "Bonds & NCDs", icon: FileText, path: "/bonds", color: "from-green-500 to-green-600" },
  { name: "Global Investing", icon: Globe, path: "/global-trading", color: "from-indigo-500 to-indigo-600" },
  { name: "Insurance", icon: Shield, path: "/policybazaar", color: "from-red-500 to-red-600" },
  { name: "Banking Products", icon: CreditCard, path: "/hdfc-banking", color: "from-yellow-500 to-yellow-600" },
  { name: "Tax Services", icon: FileText, path: "/itr-tax-services", color: "from-orange-500 to-orange-600" },
  { name: "Wealth Advisory", icon: Target, path: "/wealth-management", color: "from-teal-500 to-teal-600" },
];

type SortField = "name" | "returns" | "investment" | "risk";
type SortDirection = "asc" | "desc";

export default function StorePage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("All");
  const [sortField, setSortField] = useState<SortField>("returns");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const { addToCart, isAddingToCart } = useCart();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  
  // Get unique categories from products
  const categories = ["all", ...Array.from(new Set(mockProducts.map(p => p.category)))];

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

  // Get featured products
  const featuredProducts = mockProducts.filter(p => p.isFeatured);

  // Get top performing products (sorted by returns)
  const topPerformingProducts = [...mockProducts]
    .sort((a, b) => b.expectedReturns - a.expectedReturns)
    .slice(0, 6);

  // Get hot deals (products with HOT badge or new products)
  const hotDealsProducts = mockProducts.filter(p => p.badge === "HOT" || p.isNew || p.badge === "PREMIUM");

  // Search filtering
  const getFilteredProducts = (products: Product[]) => {
    let filtered = products;

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.provider.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by risk level
    if (selectedRisk !== "All") {
      filtered = filtered.filter(p => p.riskLevel === selectedRisk.toLowerCase());
    }

    // Sort products
    filtered.sort((a, b) => {
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

    return filtered;
  };

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
              Curated financial products • Expert recommendations • Trusted providers
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

      <div className="max-w-7xl mx-auto space-y-10">
        {/* Search and Filters */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search products, providers, categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                  data-testid="search-input"
                />
              </div>
              <div className="flex gap-3">
                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-40 h-12" data-testid="filter-risk">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Risks</SelectItem>
                    <SelectItem value="Low">Low Risk</SelectItem>
                    <SelectItem value="Medium">Medium Risk</SelectItem>
                    <SelectItem value="High">High Risk</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                  <SelectTrigger className="w-48 h-12" data-testid="sort-select">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="returns">Highest Returns</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="investment">Min Investment</SelectItem>
                    <SelectItem value="risk">Risk Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Products Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-finance-blue to-blue-600 rounded-lg flex items-center justify-center">
                <Star className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Featured Products</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Handpicked by our experts</p>
              </div>
            </div>
            <Badge variant="outline" className="text-finance-blue border-finance-blue">
              {getFilteredProducts(featuredProducts).length} Products
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredProducts(featuredProducts).map(renderProductCard)}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Top Performing Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Top Performing</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Highest returns in the market</p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              {getFilteredProducts(topPerformingProducts).length} Products
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredProducts(topPerformingProducts).map(renderProductCard)}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Hot Deals Section */}
        {hotDealsProducts.length > 0 && (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hot Deals & New Launches</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Limited time offers and latest products</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-red-600 border-red-600">
                  {getFilteredProducts(hotDealsProducts).length} Products
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getFilteredProducts(hotDealsProducts).map(renderProductCard)}
              </div>
            </div>
            <Separator className="my-8" />
          </>
        )}

        {/* Browse by Category Section with Tabs */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Browse by Category</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Explore our complete product range</p>
            </div>
          </div>
          
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <div className="overflow-x-auto pb-2">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="all" className="flex-shrink-0" data-testid="category-all">
                  All Products
                </TabsTrigger>
                {categories.filter(c => c !== "all").map((category) => (
                  <TabsTrigger key={category} value={category} className="flex-shrink-0" data-testid={`category-${category}`}>
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <TabsContent value={selectedCategory} className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-purple-600 border-purple-600">
                    {getFilteredProducts(
                      selectedCategory === "all" 
                        ? mockProducts 
                        : mockProducts.filter(p => p.category === selectedCategory)
                    ).length} Products
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredProducts(
                    selectedCategory === "all" 
                      ? mockProducts 
                      : mockProducts.filter(p => p.category === selectedCategory)
                  ).map(renderProductCard)}
                </div>
                {getFilteredProducts(
                  selectedCategory === "all" 
                    ? mockProducts 
                    : mockProducts.filter(p => p.category === selectedCategory)
                ).length === 0 && (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-2 font-medium">No products found</p>
                    <p className="text-sm text-gray-400">Try adjusting your filters or search term</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
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
