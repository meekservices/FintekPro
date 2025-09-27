import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Heart, ShoppingCart, Filter, Search, Star, TrendingUp, Shield, Clock, Grid, List, 
  SortAsc, SortDesc, X, Building2, Award, Plus, Globe, CreditCard, FileText, Users, 
  Briefcase, Banknote, Target, Crown, Landmark, Store as StoreIcon, ArrowRight, Sparkles, 
  Zap, ChevronRight, Check
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

const categories = [
  "All",
  "Investment Products",
  "Global Products", 
  "Insurance",
  "Banking Products",
  "Professional Services"
];

const subcategories = {
  "Investment Products": ["Mutual Funds", "IPO & Pre-IPO", "Debentures & Bonds", "ETFs", "Unlisted Securities"],
  "Global Products": ["International Stocks", "International Funds", "Multi-Currency Deposits", "Global ETFs"],
  "Insurance": ["Life Insurance", "Health Insurance", "Motor Insurance", "Travel Insurance"],
  "Banking Products": ["Fixed Deposits", "Credit Cards", "Savings Accounts", "Current Accounts"],
  "Professional Services": ["Advisory Services", "Tax Services", "Legal Services", "Research Services"]
};

const categoryInfo = {
  "Investment Products": {
    description: "Mutual funds, bonds, IPOs and structured products",
    icon: TrendingUp,
    color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
    textColor: "text-blue-700 dark:text-blue-300",
    gradient: "from-blue-500 to-indigo-600"
  },
  "Global Products": {
    description: "International investment opportunities and global exposure",
    icon: Globe,
    color: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200",
    textColor: "text-cyan-700 dark:text-cyan-300",
    gradient: "from-cyan-500 to-blue-600"
  },
  "Insurance": {
    description: "Life, health and general insurance plans",
    icon: Shield,
    color: "bg-green-50 dark:bg-green-900/20 border-green-200",
    textColor: "text-green-700 dark:text-green-300",
    gradient: "from-green-500 to-emerald-600"
  },
  "Banking Products": {
    description: "Accounts, deposits and banking services",
    icon: CreditCard,
    color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200",
    textColor: "text-purple-700 dark:text-purple-300",
    gradient: "from-purple-500 to-violet-600"
  },
  "Professional Services": {
    description: "Advisory, tax and professional consultation",
    icon: Users,
    color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200",
    textColor: "text-orange-700 dark:text-orange-300",
    gradient: "from-orange-500 to-red-600"
  }
};

export default function StorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { addToCart, isAddingToCart } = useCart();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

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

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === "All" || product.subcategory === selectedSubcategory;
    
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

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
      case "low": return "bg-green-100 text-green-700 border-green-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "high": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
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
        
        {/* Category Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(categoryInfo).map(([category, info]) => {
            const Icon = info.icon;
            const count = mockProducts.filter(p => p.category === category).length;
            return (
              <Card 
                key={category} 
                className={`${info.color} border cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-200 group`}
                onClick={() => setSelectedCategory(category)}
                data-testid={`category-card-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 bg-gradient-to-r ${info.gradient} rounded-xl shadow-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className={`font-semibold text-sm ${info.textColor} mb-1`}>{category}</h3>
                  <p className={`text-xs ${info.textColor} opacity-75`}>{count} products</p>
                  <ChevronRight className={`h-4 w-4 ${info.textColor} mx-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity`} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Search and Filters */}
        <Card className="mb-8 shadow-lg">
          <CardContent className="p-6">
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
              
              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full lg:w-48" data-testid="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subcategory Filter */}
              {selectedCategory !== "All" && subcategories[selectedCategory as keyof typeof subcategories] && (
                <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                  <SelectTrigger className="w-full lg:w-48" data-testid="subcategory-filter">
                    <SelectValue placeholder="All Subcategories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Subcategories</SelectItem>
                    {subcategories[selectedCategory as keyof typeof subcategories].map(sub => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="view-grid"
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="view-list"
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Products Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Star className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Featured Products</h2>
            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
              Trending
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProducts.filter(p => p.isFeatured).slice(0, 6).map(product => (
              <Card key={product.id} className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden" data-testid={`featured-product-${product.id}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-gradient-to-r from-finance-blue to-blue-600 text-white text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
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
            ))}
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedCategory !== "All" ? `${selectedCategory}` : "All Products"}
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

          {/* Product Grid/List */}
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredProducts.map(product => (
              <Card key={product.id} className={`hover:shadow-lg transition-all duration-200 ${viewMode === "list" ? "" : "hover:scale-[1.02]"}`} data-testid={`product-${product.id}`}>
                {viewMode === "list" ? (
                  <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{product.category}</Badge>
                          {product.subcategory && (
                            <Badge variant="outline" className="text-xs">{product.subcategory}</Badge>
                          )}
                          {product.badge && (
                            <Badge className={getBadgeColor(product.badge)}>
                              {product.badge}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{product.shortDescription}</p>
                        <p className="text-xs text-gray-500">by {product.provider}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 font-semibold text-lg">{product.expectedReturns}%</div>
                        <div className="text-sm text-gray-500">Returns</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Min Investment</div>
                      </div>
                      <div>
                        <Badge className={getRiskColor(product.riskLevel)}>
                          {product.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => openProductDetails(product)}
                          data-testid={`details-${product.id}`}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddToCart(product)}
                          disabled={isAddingToCart}
                          data-testid={`cart-${product.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <CardHeader>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{product.subcategory || product.category}</Badge>
                          {product.badge && (
                            <Badge className={getBadgeColor(product.badge)}>
                              {product.badge}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWishlist(product.id)}
                          data-testid={`wishlist-${product.id}`}
                        >
                          <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <p className="text-sm text-gray-600">{product.shortDescription}</p>
                      <p className="text-xs text-gray-500">by {product.provider}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block">Returns</span>
                          <span className="font-semibold text-green-600">{product.expectedReturns}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Min Investment</span>
                          <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge className={getRiskColor(product.riskLevel)}>
                        {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)} Risk
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => openProductDetails(product)}
                          data-testid={`details-${product.id}`}
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleAddToCart(product)}
                          disabled={isAddingToCart}
                          data-testid={`cart-${product.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>

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
                  setSelectedCategory("All");
                  setSelectedSubcategory("All");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}
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