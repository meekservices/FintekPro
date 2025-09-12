import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { Heart, ShoppingCart, Filter, Search, Star, TrendingUp, Shield, Clock, Grid, List, SortAsc, SortDesc, X, Building2, Award, Plus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  productType: string;
  price?: number;
  minimumInvestment: number;
  riskLevel: string;
  expectedReturns: number;
  provider: string;
  features: string[];
  isFeatured: boolean;
  isWishlisted?: boolean;
}

// Enhanced product data with exactly 5 products from each category (25 total)
const mockProducts: Product[] = [
  // MUTUAL FUNDS (5 products)
  {
    id: "1",
    name: "HDFC Top 100 Fund",
    shortDescription: "Large cap equity fund with consistent performance and strong dividend history",
    category: "Mutual Funds",
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
    category: "Mutual Funds", 
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "high",
    expectedReturns: 15.8,
    provider: "Axis Asset Management",
    features: ["High Growth Potential", "SIP Available", "Research Driven", "Long Term Wealth"],
    isFeatured: false,
  },
  {
    id: "3",
    name: "SBI Bluechip Fund",
    shortDescription: "Large cap equity fund with steady growth and portfolio stability",
    category: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 1000,
    riskLevel: "medium",
    expectedReturns: 11.8,
    provider: "SBI Asset Management",
    features: ["Bluechip Stocks", "SIP Available", "Low Volatility", "Steady Returns"],
    isFeatured: false,
  },
  {
    id: "4",
    name: "Aditya Birla Sun Life Tax Relief 96",
    shortDescription: "ELSS fund with tax saving benefits and equity exposure",
    category: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "high",
    expectedReturns: 13.2,
    provider: "Aditya Birla Asset Management",
    features: ["Tax Saving", "ELSS Category", "3 Year Lock-in", "80C Benefits"],
    isFeatured: true,
  },
  {
    id: "5",
    name: "Mirae Asset Large Cap Fund",
    shortDescription: "Diversified large cap fund focusing on quality companies with strong fundamentals",
    category: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 1000,
    riskLevel: "medium",
    expectedReturns: 12.1,
    provider: "Mirae Asset Management",
    features: ["Quality Focus", "SIP Available", "Diversified Portfolio", "Strong Track Record"],
    isFeatured: false,
  },

  // INSURANCE (5 products)
  {
    id: "6", 
    name: "SBI Life Smart Wealth Builder",
    shortDescription: "Unit-linked insurance plan combining life cover with investment growth",
    category: "Insurance",
    productType: "insurance",
    price: 25000,
    minimumInvestment: 12000,
    riskLevel: "medium",
    expectedReturns: 10.8,
    provider: "SBI Life Insurance",
    features: ["Life Cover", "Wealth Creation", "Tax Benefits", "Fund Options"],
    isFeatured: false,
  },
  {
    id: "7",
    name: "HDFC Life Click 2 Protect",
    shortDescription: "Comprehensive term insurance with high cover and online convenience",
    category: "Insurance",
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
    id: "8",
    name: "LIC Jeevan Anand",
    shortDescription: "Traditional endowment plan providing life cover with guaranteed returns",
    category: "Insurance",
    productType: "insurance",
    price: 30000,
    minimumInvestment: 20000,
    riskLevel: "low",
    expectedReturns: 6.5,
    provider: "Life Insurance Corporation",
    features: ["Guaranteed Returns", "Life Cover", "Maturity Benefits", "Trusted Brand"],
    isFeatured: false,
  },
  {
    id: "9",
    name: "ICICI Prudential iProtect Smart",
    shortDescription: "Pure term insurance with flexible premium payment options",
    category: "Insurance",
    productType: "insurance",
    price: 16000,
    minimumInvestment: 12000,
    riskLevel: "low",
    expectedReturns: 0,
    provider: "ICICI Prudential Life",
    features: ["Flexible Premiums", "High Coverage", "Rider Benefits", "Online Claims"],
    isFeatured: true,
  },
  {
    id: "10",
    name: "Max Life Smart Secure Plus",
    shortDescription: "Term insurance with return of premium option and comprehensive coverage",
    category: "Insurance",
    productType: "insurance",
    price: 22000,
    minimumInvestment: 18000,
    riskLevel: "low",
    expectedReturns: 2.5,
    provider: "Max Life Insurance",
    features: ["Premium Return", "Term Coverage", "Accidental Benefits", "Health Riders"],
    isFeatured: false,
  },

  // FIXED DEPOSITS (5 products)
  {
    id: "11",
    name: "ICICI Bank Fixed Deposit", 
    shortDescription: "Secure fixed deposit with competitive interest rates and guaranteed returns",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 1000,
    riskLevel: "low",
    expectedReturns: 7.2,
    provider: "ICICI Bank",
    features: ["Capital Protection", "Guaranteed Returns", "Flexible Tenure", "Auto Renewal"],
    isFeatured: true,
  },
  {
    id: "12",
    name: "Yes Bank Fixed Deposit",
    shortDescription: "High interest fixed deposit with flexible tenure and premium rates",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 5000,
    riskLevel: "low",
    expectedReturns: 7.8,
    provider: "Yes Bank",
    features: ["High Interest Rates", "Flexible Tenure", "Auto Renewal", "Senior Citizen Benefits"],
    isFeatured: false,
  },
  {
    id: "13",
    name: "HDFC Bank Fixed Deposit",
    shortDescription: "Reliable fixed deposit with attractive rates and trusted banking experience",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 10000,
    riskLevel: "low",
    expectedReturns: 7.0,
    provider: "HDFC Bank",
    features: ["Trusted Brand", "Competitive Rates", "Easy Process", "Branch Support"],
    isFeatured: true,
  },
  {
    id: "14",
    name: "Axis Bank Fixed Deposit",
    shortDescription: "Digital fixed deposit with instant booking and attractive interest rates",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 2500,
    riskLevel: "low",
    expectedReturns: 7.4,
    provider: "Axis Bank",
    features: ["Digital Booking", "Instant Process", "Competitive Rates", "Multiple Tenure Options"],
    isFeatured: false,
  },
  {
    id: "15",
    name: "SBI Fixed Deposit",
    shortDescription: "Traditional fixed deposit from India's largest bank with stable returns",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 1000,
    riskLevel: "low",
    expectedReturns: 6.8,
    provider: "State Bank of India",
    features: ["Largest Bank", "Stable Returns", "Wide Network", "Government Backing"],
    isFeatured: false,
  },

  // LOANS (5 products)
  {
    id: "16",
    name: "Kotak Mahindra Home Loan",
    shortDescription: "Attractive home loan rates with quick processing and minimal documentation",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 100000,
    riskLevel: "low",
    expectedReturns: 8.5,
    provider: "Kotak Mahindra Bank",
    features: ["Quick Approval", "Flexible EMI", "No Hidden Charges", "Doorstep Service"],
    isFeatured: true,
  },
  {
    id: "17",
    name: "BAJAJ Personal Loan",
    shortDescription: "Instant personal loans with minimal documentation and flexible repayment",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 25000,
    riskLevel: "medium",
    expectedReturns: 14.5,
    provider: "Bajaj Finserv",
    features: ["Instant Approval", "Minimal Documents", "Flexible Repayment", "No Collateral"],
    isFeatured: true,
  },
  {
    id: "18",
    name: "HDFC Bank Business Loan",
    shortDescription: "Comprehensive business financing solutions for SMEs and enterprises",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 200000,
    riskLevel: "medium",
    expectedReturns: 10.2,
    provider: "HDFC Bank",
    features: ["Business Growth", "Flexible Terms", "Expert Advisory", "Quick Disbursement"],
    isFeatured: false,
  },
  {
    id: "19",
    name: "ICICI Bank Car Loan",
    shortDescription: "Attractive auto loans for new and used cars with competitive interest rates",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 150000,
    riskLevel: "low",
    expectedReturns: 9.5,
    provider: "ICICI Bank",
    features: ["New & Used Cars", "Quick Processing", "Flexible Tenure", "Easy Documentation"],
    isFeatured: false,
  },
  {
    id: "20",
    name: "Axis Bank Education Loan",
    shortDescription: "Education financing for higher studies in India and abroad with competitive rates",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 50000,
    riskLevel: "low",
    expectedReturns: 11.5,
    provider: "Axis Bank",
    features: ["Study Abroad", "Moratorium Period", "Tax Benefits", "Expert Guidance"],
    isFeatured: true,
  },

  // ETFs (5 products)
  {
    id: "21",
    name: "Reliance Gold Savings Fund",
    shortDescription: "Gold ETF providing exposure to gold prices with high liquidity",
    category: "ETFs",
    productType: "etf", 
    minimumInvestment: 1000,
    riskLevel: "medium",
    expectedReturns: 8.9,
    provider: "Reliance Asset Management",
    features: ["Gold Exposure", "High Liquidity", "Lower Expense Ratio", "Demat Form"],
    isFeatured: false,
  },
  {
    id: "22",
    name: "UTI Nifty Index Fund",
    shortDescription: "Low-cost index fund tracking Nifty 50 with broad market diversification",
    category: "ETFs",
    productType: "etf",
    minimumInvestment: 500,
    riskLevel: "medium",
    expectedReturns: 10.2,
    provider: "UTI Asset Management",
    features: ["Index Tracking", "Low Cost", "Broad Diversification", "Market Returns"],
    isFeatured: false,
  },
  {
    id: "23",
    name: "HDFC Bank ETF",
    shortDescription: "Banking sector ETF focusing on top banking stocks with growth potential",
    category: "ETFs",
    productType: "etf",
    minimumInvestment: 1000,
    riskLevel: "medium",
    expectedReturns: 11.5,
    provider: "HDFC Asset Management",
    features: ["Banking Sector", "Sectoral Focus", "Growth Potential", "Professional Management"],
    isFeatured: true,
  },
  {
    id: "24",
    name: "SBI ETF Sensex",
    shortDescription: "Sensex tracking ETF providing exposure to India's top 30 companies",
    category: "ETFs",
    productType: "etf",
    minimumInvestment: 500,
    riskLevel: "medium",
    expectedReturns: 9.8,
    provider: "SBI Asset Management",
    features: ["Sensex Tracking", "Blue Chip Exposure", "Low Fees", "Benchmark Returns"],
    isFeatured: false,
  },
  {
    id: "25",
    name: "Nippon India ETF Nifty IT",
    shortDescription: "Technology sector ETF capturing growth in India's IT industry",
    category: "ETFs",
    productType: "etf",
    minimumInvestment: 1000,
    riskLevel: "high",
    expectedReturns: 13.5,
    provider: "Nippon India Asset Management",
    features: ["IT Sector Focus", "High Growth", "Technology Exposure", "Export Oriented"],
    isFeatured: true,
  }
];

const categories = ["All", "Mutual Funds", "Insurance", "Fixed Deposits", "Loans", "ETFs"];
const riskLevels = ["All", "low", "medium", "high"];
const providers = ["All", ...Array.from(new Set(mockProducts.map(p => p.provider))).sort()];

// Category information for enhanced display
const categoryInfo = {
  "Mutual Funds": {
    description: "Professionally managed investment schemes",
    icon: TrendingUp,
    color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
    textColor: "text-blue-700 dark:text-blue-300"
  },
  "Insurance": {
    description: "Life and health protection plans",
    icon: Shield,
    color: "bg-green-50 dark:bg-green-900/20 border-green-200", 
    textColor: "text-green-700 dark:text-green-300"
  },
  "Fixed Deposits": {
    description: "Guaranteed returns with capital protection",
    icon: Clock,
    color: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200",
    textColor: "text-yellow-700 dark:text-yellow-300"
  },
  "Loans": {
    description: "Personal and business financing solutions",
    icon: ShoppingCart,
    color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200",
    textColor: "text-purple-700 dark:text-purple-300"
  },
  "ETFs": {
    description: "Exchange traded funds for diversification",
    icon: Star,
    color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200",
    textColor: "text-orange-700 dark:text-orange-300"
  }
};

export default function Store() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("All");
  const [selectedProvider, setSelectedProvider] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { addToCart, isAddingToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (product: Product, investmentAmount?: number) => {
    addToCart({
      productId: product.id,
      quantity: 1,
      investmentAmount: investmentAmount ? investmentAmount.toString() : product.minimumInvestment.toString()
    }, {
      onSuccess: () => {
        toast({
          title: "Added to Cart",
          description: `${product.name} has been added to your cart.`,
        });
      },
      onError: (error: any) => {
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
    const matchesProvider = selectedProvider === "All" || product.provider === selectedProvider;
    const matchesRisk = selectedRiskLevel === "All" || product.riskLevel === selectedRiskLevel;
    
    return matchesSearch && matchesCategory && matchesProvider && matchesRisk;
  }).sort((a, b) => {
    let aValue = a[sortBy as keyof Product];
    let bValue = b[sortBy as keyof Product];
    
    if (sortBy === "expectedReturns" || sortBy === "minimumInvestment") {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }
    
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  // Group products by category for enhanced display
  const productsByCategory = categories.slice(1).reduce((acc, category) => {
    acc[category] = filteredProducts.filter(p => p.category === category);
    return acc;
  }, {} as Record<string, Product[]>);
  
  // Group products by provider for supplier-wise display
  const productsByProvider = providers.slice(1).reduce((acc, provider) => {
    acc[provider] = filteredProducts.filter(p => p.provider === provider);
    return acc;
  }, {} as Record<string, Product[]>);

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedProvider("All");
    setSelectedRiskLevel("All");
    setSortBy("name");
    setSortOrder("asc");
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeProductDetails = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case "low": return "text-green-600 bg-green-50";
      case "medium": return "text-yellow-600 bg-yellow-50";
      case "high": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  // Product Card Component
  const ProductCard = ({ product, wishlist, toggleWishlist, openProductDetails, getRiskColor, viewMode = "grid" }: {
    product: Product;
    wishlist: string[];
    toggleWishlist: (id: string) => void;
    openProductDetails: (product: Product) => void;
    getRiskColor: (risk: string) => string;
    viewMode?: "grid" | "list";
  }) => {
    if (viewMode === "list") {
      return (
        <Card className="hover:shadow-lg transition-shadow" data-testid={`product-${product.id}`}>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="flex gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{product.category}</Badge>
                  {product.isFeatured && (
                    <Badge className="bg-finance-blue text-white text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-gray-600">{product.shortDescription}</p>
                <p className="text-xs text-gray-500">by {product.provider}</p>
              </div>
              <div className="text-center">
                <span className="text-green-600 font-semibold text-lg">{product.expectedReturns}%</span>
                <p className="text-xs text-gray-500">Returns</p>
              </div>
              <div className="text-center">
                <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                <p className="text-xs text-gray-500">Min Investment</p>
              </div>
              <div className="text-center">
                <Badge className={getRiskColor(product.riskLevel)}>
                  {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleWishlist(product.id)}
                  data-testid={`button-wishlist-${product.id}`}
                >
                  <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                </Button>
                <Button 
                  size="sm"
                  className="bg-finance-blue hover:bg-finance-blue/90"
                  onClick={() => openProductDetails(product)}
                  data-testid={`button-invest-${product.id}`}
                >
                  View Details
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddToCart(product)}
                  disabled={isAddingToCart}
                  data-testid={`button-add-to-cart-${product.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden" data-testid={`product-${product.id}`}>
        <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CardHeader className="relative pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-2">
              <Badge variant="outline" className={`text-xs font-medium ${categoryInfo[product.category as keyof typeof categoryInfo]?.textColor || 'text-gray-600'} ${categoryInfo[product.category as keyof typeof categoryInfo]?.color || 'border-gray-200'}`}>
                {product.category}
              </Badge>
              {product.isFeatured && (
                <Badge className="bg-gradient-to-r from-finance-blue to-blue-600 text-white text-xs shadow-lg">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleWishlist(product.id)}
              className="hover:bg-red-50 hover:text-red-500 transition-colors"
              data-testid={`button-wishlist-${product.id}`}
            >
              <Heart className={`h-4 w-4 transition-all duration-300 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-400 hover:text-red-500'}`} />
            </Button>
          </div>
          <CardTitle className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-finance-blue transition-colors duration-300 line-clamp-2">
            {product.name}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-2">{product.shortDescription}</p>
          <div className="flex items-center gap-2 mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-6 h-6 bg-finance-blue/10 rounded-full flex items-center justify-center">
              <Building2 className="h-3 w-3 text-finance-blue" />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">{product.provider}</p>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-600 mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="group-hover:scale-105 transition-transform">
                <div className="w-8 h-8 mx-auto mb-2 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">{product.expectedReturns}%</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Returns</p>
              </div>
              <div className="group-hover:scale-105 transition-transform">
                <div className="w-8 h-8 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-finance-blue" />
                </div>
                <span className="font-bold text-lg text-gray-900 dark:text-white">₹{(product.minimumInvestment / 1000).toFixed(0)}K</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Min Amount</p>
              </div>
              <div className="group-hover:scale-105 transition-transform">
                <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-gray-600" />
                </div>
                <Badge className={`${getRiskColor(product.riskLevel)} text-xs font-medium`}>
                  {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                </Badge>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Risk Level</p>
              </div>
            </div>
          </div>
            
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Key Features</h4>
              <div className="flex gap-1 flex-wrap">
                {product.features.slice(0, 3).map((feature, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-finance-blue/10 text-finance-blue border-finance-blue/20 hover:bg-finance-blue hover:text-white transition-colors">
                    {feature}
                  </Badge>
                ))}
                {product.features.length > 3 && (
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                    +{product.features.length - 3}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                className="flex-1 bg-gradient-to-r from-finance-blue to-blue-600 hover:from-blue-600 hover:to-finance-blue text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105" 
                onClick={() => openProductDetails(product)}
                data-testid={`button-invest-${product.id}`}
              >
                <Award className="h-4 w-4 mr-2" />
                View Details
              </Button>
              <Button 
                variant="outline"
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-finance-blue hover:text-white hover:border-finance-blue transition-all duration-300 group-hover:scale-105"
                onClick={() => handleAddToCart(product)}
                disabled={isAddingToCart}
                data-testid={`button-add-to-cart-${product.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isAddingToCart ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="store-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-10">
          <div className="relative overflow-hidden bg-gradient-to-r from-finance-blue to-purple-600 rounded-2xl p-8 shadow-2xl">
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <ShoppingCart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">Financial Products Store</h1>
                  <p className="text-blue-100 text-lg font-medium max-w-2xl">
                    Discover our comprehensive collection of 25 premium financial products across 5 categories
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
                {categories.slice(1).map((category, index) => {
                  const info = categoryInfo[category as keyof typeof categoryInfo];
                  const Icon = info?.icon || Star;
                  const productCount = filteredProducts.filter(p => p.category === category).length;
                  return (
                    <div key={category} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition-all duration-300 cursor-pointer" onClick={() => setSelectedCategory(category)}>
                      <Icon className="w-6 h-6 text-white mx-auto mb-2" />
                      <h3 className="text-white font-medium text-sm mb-1">{category}</h3>
                      <p className="text-blue-100 text-xs">{productCount} Products</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 mb-8" data-testid="filters-section">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Find Your Perfect Financial Product</h2>
            <p className="text-gray-600 dark:text-gray-300">Filter through our collection of {filteredProducts.length} carefully curated financial products</p>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Search className="absolute left-4 top-4 h-4 w-4 text-finance-blue z-10" />
                <Input
                  placeholder="Search products, providers, features..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 border-2 border-gray-200 dark:border-gray-600 focus:border-finance-blue transition-all duration-300 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm relative z-0"
                  data-testid="input-search"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger data-testid="select-provider">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
                <SelectTrigger data-testid="select-risk">
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  {riskLevels.map(risk => (
                    <SelectItem key={risk} value={risk}>
                      {risk === "All" ? "All Risk Levels" : `${risk.charAt(0).toUpperCase()}${risk.slice(1)} Risk`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={clearAllFilters}
                className="w-full"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>

            {/* Enhanced Sort and View Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sort by:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="expectedReturns">Returns</SelectItem>
                      <SelectItem value="minimumInvestment">Min Investment</SelectItem>
                      <SelectItem value="provider">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    data-testid="button-sort-order"
                  >
                    {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">View:</span>
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                    data-testid="button-view-grid"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none"
                    data-testid="button-view-list"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Quick Navigation */}
        {selectedCategory === "All" && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Browse by Category
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {categories.slice(1).map(category => {
                const info = categoryInfo[category as keyof typeof categoryInfo];
                const productCount = productsByCategory[category]?.length || 0;
                const IconComponent = info?.icon || TrendingUp;
                
                return (
                  <Card 
                    key={category}
                    className={`cursor-pointer transition-all hover:shadow-md ${info?.color || 'bg-gray-50'} border-2`}
                    onClick={() => setSelectedCategory(category)}
                    data-testid={`category-card-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CardContent className="p-4 text-center">
                      <IconComponent className={`h-8 w-8 mx-auto mb-2 ${info?.textColor || 'text-gray-600'}`} />
                      <h3 className="font-semibold mb-1">{category}</h3>
                      <p className={`text-xs mb-2 ${info?.textColor || 'text-gray-600'}`}>{info?.description}</p>
                      <Badge variant="secondary" className="text-xs">
                        {productCount} product{productCount !== 1 ? 's' : ''}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Featured Products */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProducts.filter(p => p.isFeatured).map(product => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-finance-blue" data-testid={`featured-product-${product.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge className="bg-finance-blue text-white text-xs mb-2">Featured</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleWishlist(product.id)}
                      data-testid={`button-wishlist-${product.id}`}
                    >
                      <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </Button>
                  </div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <p className="text-sm text-gray-600">{product.shortDescription}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Expected Returns</span>
                      <span className="text-green-600 font-semibold">{product.expectedReturns}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Min Investment</span>
                      <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Risk Level</span>
                      <Badge className={getRiskColor(product.riskLevel)}>
                        {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                      </Badge>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full bg-finance-blue hover:bg-finance-blue/90" data-testid={`button-invest-${product.id}`}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Invest Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory !== "All" ? `${selectedCategory} Products` : 
                 selectedProvider !== "All" ? `${selectedProvider} Products` : "All Products"}
              </h2>
              {(selectedCategory !== "All" || selectedProvider !== "All" || searchTerm) && (
                <p className="text-sm text-gray-600 mt-1">
                  {searchTerm && `Searching for "${searchTerm}" • `}
                  {selectedCategory !== "All" && `Category: ${selectedCategory} • `}
                  {selectedProvider !== "All" && `Supplier: ${selectedProvider} • `}
                  {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-finance-blue border-finance-blue self-start sm:self-center">
              {filteredProducts.length} Product{filteredProducts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          {/* Supplier Grouping (when viewing all categories) */}
          {selectedCategory === "All" && selectedProvider === "All" && !searchTerm ? (
            <div className="space-y-8">
              {providers.slice(1).map(provider => {
                const supplierProducts = productsByProvider[provider] || [];
                if (supplierProducts.length === 0) return null;
                
                return (
                  <div key={provider} className="border rounded-lg p-6 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{provider}</h3>
                          <p className="text-sm text-gray-600">{supplierProducts.length} product{supplierProducts.length !== 1 ? 's' : ''} available</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProvider(provider)}
                        data-testid={`button-view-supplier-${provider.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        View All
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {supplierProducts.slice(0, 3).map(product => (
                        <ProductCard key={product.id} product={product} wishlist={wishlist} toggleWishlist={toggleWishlist} openProductDetails={openProductDetails} getRiskColor={getRiskColor} />
                      ))}
                    </div>
                    {supplierProducts.length > 3 && (
                      <div className="mt-4 text-center">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedProvider(provider)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          +{supplierProducts.length - 3} more products from {provider}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} wishlist={wishlist} toggleWishlist={toggleWishlist} openProductDetails={openProductDetails} getRiskColor={getRiskColor} viewMode={viewMode} />
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12" data-testid="no-products">
              <div className="text-gray-400 mb-4">
                <ShoppingCart className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters</p>
            </div>
          )}
        </div>
      </main>
      
      <ProductDetailsModal 
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={closeProductDetails}
        onWishlistToggle={toggleWishlist}
        isWishlisted={selectedProduct ? wishlist.includes(selectedProduct.id) : false}
      />
      
      <Footer />
    </div>
  );
}