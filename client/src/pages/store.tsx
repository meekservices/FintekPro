import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { LoanOffersCard } from "@/components/LoanOffersCard";
import { 
  Heart, ShoppingCart, Search, Star, TrendingUp, Shield, Globe, CreditCard, FileText, 
  Briefcase, Banknote, Target, Crown, Landmark, Store as StoreIcon, ArrowRight, Sparkles, 
  Zap, ChevronRight, Plus, Building2, Award, Package, Flame, RefreshCw, Lock, AlertCircle,
  MessageSquare, CheckCircle, XCircle, Info
} from "lucide-react";
import { ProductInquiryForm } from "@/components/store/ProductInquiryForm";
import { AIRecommendations } from "@/components/store/AIRecommendations";
import { ComingSoonCategory } from "@/components/store/ComingSoonCategory";
import { ClientTransactionHistory } from "@/components/store/ClientTransactionHistory";

interface Product {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  subcategory?: string;
  productType: string;
  kycProductCode?: string;
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

// Category quick links for navigation (SEBI/IFSCA/RBI compliant)
const categoryLinks = [
  { name: "Mutual Funds", icon: TrendingUp, path: "/mutual-funds", color: "from-blue-500 to-blue-600" },
  { name: "Listed Securities", icon: Banknote, path: "/stocks", color: "from-emerald-500 to-emerald-600" },
  { name: "Fixed Income", icon: FileText, path: "/bonds", color: "from-green-500 to-green-600" },
  { name: "Pre-IPO & Unlisted", icon: Sparkles, path: "/ipo", color: "from-purple-500 to-purple-600" },
  { name: "Loans & Credit", icon: CreditCard, path: "/store?category=Loans+%26+Credit", color: "from-yellow-500 to-yellow-600" },
  { name: "GIFT City / IFSC", icon: Globe, path: "/global-trading", color: "from-indigo-500 to-indigo-600" },
  { name: "Insurance", icon: Shield, path: "/policybazaar", color: "from-red-500 to-red-600" },
  { name: "Services", icon: Briefcase, path: "/itr-tax-services", color: "from-orange-500 to-orange-600" },
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
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedLockedProduct, setSelectedLockedProduct] = useState<Product | null>(null);
  const [requiredTier, setRequiredTier] = useState<string>("");
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryProduct, setInquiryProduct] = useState<Product | null>(null);
  
  const { addToCart, isAddingToCart } = useCart();
  const { addItem: addToUnifiedCart } = useUnifiedCart();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  
  const { data: productAccess, isLoading: isLoadingAccess } = useQuery<{
    tier: string;
    unlockedProducts: string[];
    tierProducts: Record<string, string[]>;
  }>({
    queryKey: ["/api/user/product-access"],
    enabled: isAuthenticated,
  });
  
  // Fetch categories from Store Management API (includes isEnabled for Coming Soon)
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<{
    success: boolean;
    categories: Array<{
      id: string;
      name: string;
      slug?: string;
      description?: string;
      icon?: string;
      displayOrder?: number;
      isActive?: boolean;
      isEnabled?: boolean;
      comingSoonMessage?: string;
      comingSoonExpectedDate?: string;
      subcategories: Array<{
        id: string;
        name: string;
        description?: string;
      }>;
    }>;
  }>({
    queryKey: ["/api/store/categories"],
  });

  // Fetch products from Store Management API
  const { data: storeProductsData, isLoading: isLoadingStoreProducts } = useQuery<{
    success: boolean;
    products: any[];
    count: number;
  }>({
    queryKey: ["/api/store/products"],
  });

  // Fallback: Fetch from legacy products API
  const { data: legacyProductsData, isLoading: isLoadingLegacyProducts } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: !storeProductsData?.products?.length,
  });

  const isLoadingProducts = isLoadingStoreProducts || isLoadingLegacyProducts;
  
  // Normalize Store Management product to match Product interface
  const normalizeStoreProduct = (storeProduct: any): Product => {
    return {
      id: storeProduct.id,
      name: storeProduct.name,
      shortDescription: storeProduct.shortDescription || storeProduct.description || '',
      category: storeProduct.categoryName || storeProduct.categoryId,
      subcategory: storeProduct.subcategoryName || storeProduct.subcategoryId,
      productType: storeProduct.productType || storeProduct.planType || 'product',
      kycProductCode: storeProduct.productKey,
      price: storeProduct.basePrice,
      minimumInvestment: storeProduct.minimumInvestment || 0,
      riskLevel: storeProduct.riskLevel || 'medium',
      expectedReturns: storeProduct.expectedReturns || storeProduct.returns1y || 0,
      provider: storeProduct.provider || '',
      features: storeProduct.features || [],
      isFeatured: storeProduct.isFeatured || false,
      isPremium: storeProduct.isPremium || false,
      isNew: storeProduct.isNew || false,
      badge: storeProduct.badge
    };
  };

  // Legacy normalize function for old API
  const normalizeLegacyProduct = (apiProduct: any): Product => {
    const categoryMap: Record<string, string> = {
      'mutual_fund': 'Investment Products',
      'bond': 'Investment Products',
      'mld': 'Investment Products',
      'insurance': 'Insurance & Protection',
      'banking': 'Banking Products'
    };
    
    return {
      id: apiProduct.id,
      name: apiProduct.name,
      shortDescription: apiProduct.description || '',
      category: categoryMap[apiProduct.category] || apiProduct.category,
      subcategory: apiProduct.subcategory || apiProduct.subCategory,
      productType: apiProduct.category,
      price: apiProduct.basePrice,
      minimumInvestment: apiProduct.minimumInvestment || apiProduct.minInvestment || 0,
      riskLevel: apiProduct.riskLevel || 'medium',
      expectedReturns: apiProduct.returns1y || apiProduct.returns1Y || 0,
      provider: apiProduct.provider || '',
      features: apiProduct.features || [],
      isFeatured: apiProduct.isFeatured || false,
      isPremium: apiProduct.isPremium || false,
      isNew: apiProduct.isNew || false,
      badge: apiProduct.badge
    };
  };
  
  // Use Store Management products first, then legacy API, then empty array
  const products = storeProductsData?.products?.length 
    ? storeProductsData.products.map(normalizeStoreProduct)
    : legacyProductsData 
      ? legacyProductsData.map(normalizeLegacyProduct) 
      : [];
  
  // Get categories from Store Management API or derive from products
  const storeCategories = categoriesData?.categories || [];
  const categories = storeCategories.length > 0
    ? ["all", ...storeCategories.map(c => c.name)]
    : ["all", ...Array.from(new Set(products.map(p => p.category)))];
  
  // Helper to get category info including Coming Soon status
  const getCategoryInfo = (categoryName: string) => {
    return storeCategories.find(c => c.name === categoryName);
  };
  
  const isCategoryDisabled = (categoryName: string): boolean => {
    const catInfo = getCategoryInfo(categoryName);
    return catInfo ? catInfo.isEnabled === false : false;
  };

  const isProductLocked = (product: Product): boolean => {
    if (!isAuthenticated) return false;
    if (!product.kycProductCode) return false;
    if (!productAccess) return false;
    return !productAccess.unlockedProducts.includes(product.kycProductCode);
  };

  const getRequiredTierForProduct = (productCode: string): string => {
    if (!productAccess) return "enhanced";
    const { tierProducts } = productAccess;
    
    if (tierProducts.basic?.includes(productCode)) return "basic";
    if (tierProducts.enhanced?.includes(productCode)) return "enhanced";
    if (tierProducts.accredited_investor?.includes(productCode)) return "accredited_investor";
    
    return "enhanced";
  };

  const getTierDisplayName = (tier: string): string => {
    switch(tier) {
      case "basic": return "Basic KYC";
      case "enhanced": return "Enhanced KYC";
      case "accredited_investor": return "Accredited Investor";
      default: return tier;
    }
  };

  const getKycRequirementsForTier = (tier: string) => {
    const requirements: Record<string, { 
      regulator: string; 
      requirements: string[]; 
      reason: string;
    }> = {
      basic: {
        regulator: "SEBI/RBI",
        requirements: [
          "PAN Card verification"
        ],
        reason: "Basic KYC with PAN verification is required for accessing mutual funds, limited equity trading, and IPO retail subscriptions as per SEBI regulations."
      },
      enhanced: {
        regulator: "SEBI/RBI",
        requirements: [
          "PAN Card verified",
          "Aadhaar Card verified",
          "Video KYC (In-Person Verification) completed",
          "Income proof documentation submitted",
          "Risk assessment profile completed",
          "FATCA/CRS declaration completed",
          "Bank account linked and verified"
        ],
        reason: "Enhanced KYC is mandated by SEBI for trading in derivatives (F&O), unlisted securities, margin trading, and higher value transactions."
      },
      accredited_investor: {
        regulator: "SEBI",
        requirements: [
          "Enhanced KYC completed (all above requirements)",
          "AML (Anti-Money Laundering) status cleared",
          "PEP (Politically Exposed Person) status cleared",
          "Qualification via one of the following routes:",
          "  • Annual income ≥ ₹2 Crore with proof documents, OR",
          "  • Net worth ≥ ₹7.5 Crore (excluding primary residence) with CA certificate, OR",
          "  • Securities portfolio ≥ ₹5 Crore with depository statement, OR",
          "  • Professional qualification (CA/CFA/MBA Finance/CPA/FRM/ACCA) with 3+ years experience"
        ],
        reason: "SEBI Accredited Investor status is required under SEBI (AIF) Regulations 2012 for investing in AIFs, PMS, Pre-IPO, private equity, and other sophisticated investment products."
      }
    };
    return requirements[tier] || requirements.enhanced;
  };

  const getProductTypeRegulation = (productCode: string): string => {
    const regulations: Record<string, string> = {
      mutual_funds_direct: "SEBI (Mutual Funds) Regulations, 1996",
      derivatives_fo: "SEBI (Securities Contracts) Rules - F&O Segment",
      unlisted_securities: "SEBI Unlisted Securities Trading Guidelines",
      aif_cat1: "SEBI (Alternative Investment Funds) Regulations, 2012 - Category I",
      aif_cat2: "SEBI (Alternative Investment Funds) Regulations, 2012 - Category II",
      aif_cat3: "SEBI (Alternative Investment Funds) Regulations, 2012 - Category III",
      pms: "SEBI (Portfolio Managers) Regulations, 2020",
      pre_ipo_investments: "SEBI (Issue of Capital and Disclosure Requirements) Regulations",
      bonds_ncds: "SEBI (Issue and Listing of Non-Convertible Securities) Regulations, 2021",
      margin_trading: "SEBI Margin Trading Facility Guidelines",
    };
    return regulations[productCode] || "SEBI/RBI Regulatory Compliance";
  };

  const openInquiryModal = (product: Product) => {
    setInquiryProduct(product);
    setInquiryModalOpen(true);
  };

  const showUpgradeModal = (product: Product) => {
    if (!product.kycProductCode) return;
    const tier = getRequiredTierForProduct(product.kycProductCode);
    setSelectedLockedProduct(product);
    setRequiredTier(tier);
    setUpgradeModalOpen(true);
  };

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

    if (isProductLocked(product)) {
      showUpgradeModal(product);
      return;
    }

    addToCart({
      productId: product.id,
      quantity: 1,
      investmentAmount: product.minimumInvestment.toString()
    }, {
      onSuccess: async () => {
        try {
          const cartItem = {
            productCategory: 'store' as const,
            storeProductId: product.id,
            displayName: product.name,
            amount: product.minimumInvestment.toString(),
            quantity: 1,
            source: 'client' as const,
            status: 'active' as const,
          };
          await addToUnifiedCart(cartItem);
          queryClient.invalidateQueries({ queryKey: ['/api/unified-cart'] });
          queryClient.invalidateQueries({ queryKey: ['/api/unified-cart/count'] });
          toast({
            title: "Added to Cart",
            description: `${product.name} has been added to your cart.`,
          });
        } catch (error) {
          console.error('Failed to add to unified cart:', error);
          toast({
            title: "Partially Added",
            description: `${product.name} added to cart, but unified tracking failed.`,
          });
        }
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
  const featuredProducts = products.filter(p => p.isFeatured);

  // Get top performing products (sorted by returns)
  const topPerformingProducts = [...products]
    .sort((a, b) => (b.expectedReturns || 0) - (a.expectedReturns || 0))
    .slice(0, 6);

  // Get hot deals (products with HOT badge or new products)
  const hotDealsProducts = products.filter(p => p.badge === "HOT" || p.isNew || p.badge === "PREMIUM");

  // Get subcategories for current category (for Loans filtering)
  const getCurrentCategorySubcategories = () => {
    if (selectedCategory === "all") return [];
    const currentCat = storeCategories.find(c => c.name === selectedCategory);
    return currentCat?.subcategories || [];
  };

  // Get unique providers for current category products
  const getCurrentCategoryProviders = () => {
    const categoryProducts = selectedCategory === "all" 
      ? products 
      : products.filter(p => p.categoryName === selectedCategory);
    const providers = [...new Set(categoryProducts.map(p => p.provider).filter(Boolean))];
    return providers.sort();
  };

  // Reset subcategory and provider when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory("all");
    setSelectedProvider("all");
  };

  // Search filtering
  const getFilteredProducts = (products: Product[]) => {
    let filtered = products;

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(product =>
        (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.shortDescription || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.provider || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by subcategory (for Loans and other categories with subcategories)
    if (selectedSubcategory !== "all") {
      filtered = filtered.filter(p => p.subcategoryName === selectedSubcategory);
    }

    // Filter by provider/financier
    if (selectedProvider !== "all") {
      filtered = filtered.filter(p => p.provider === selectedProvider);
    }

    // Filter by risk level
    if (selectedRisk !== "All") {
      filtered = filtered.filter(p => (p.riskLevel || '').toLowerCase() === selectedRisk.toLowerCase());
    }

    // Sort products
    filtered.sort((a, b) => {
      let comparison = 0;
      switch(sortField) {
        case "name":
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case "returns":
          comparison = (a.expectedReturns || 0) - (b.expectedReturns || 0);
          break;
        case "investment":
          comparison = (a.minimumInvestment || 0) - (b.minimumInvestment || 0);
          break;
        case "risk":
          const riskOrder = { low: 1, medium: 2, high: 3 };
          comparison = riskOrder[(a.riskLevel || 'medium') as keyof typeof riskOrder] - riskOrder[(b.riskLevel || 'medium') as keyof typeof riskOrder];
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
    if (isAuthenticated && isProductLocked(product)) {
      showUpgradeModal(product);
      return;
    }
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case "low": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "high": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getBadgeColor = (badge: string) => {
    switch(badge) {
      case "NEW": return "bg-green-500 text-white";
      case "HOT": return "bg-red-500 text-white";
      case "PREMIUM": return "bg-gradient-to-r from-yellow-400 to-orange-500 text-foreground";
      default: return "bg-blue-500 text-white";
    }
  };

  const renderProductCard = (product: Product) => {
    const isLocked = isProductLocked(product);
    
    return (
      <Card 
        key={product.id} 
        className={`group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-background overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
        data-testid={`product-card-${product.id}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {isLocked && (
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-card/90 text-foreground px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium">
              <Lock className="h-3 w-3" />
              Locked
            </div>
          </div>
        )}
        <CardHeader className="relative pb-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex gap-2 flex-wrap">
              {isLocked && (
                <Badge className="bg-orange-500 text-white">
                  <Lock className="h-3 w-3 mr-1" />
                  Upgrade KYC
                </Badge>
              )}
              {product.isFeatured && (
                <Badge className="bg-gradient-to-r from-finance-blue to-blue-600 text-foreground text-xs">
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
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-foreground">
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
              <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
            </Button>
          </div>
          <CardTitle className="text-lg group-hover:text-finance-blue transition-colors">
            {product.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.shortDescription}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{product.provider || 'FintekPro'}</span>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Expected Returns</span>
              <span className="font-semibold text-green-600">{product.expectedReturns || 0}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Min Investment</span>
              <span className="font-semibold">₹{(product.minimumInvestment || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Badge className={getRiskColor(product.riskLevel || 'medium')}>
              {(product.riskLevel || 'medium').charAt(0).toUpperCase() + (product.riskLevel || 'medium').slice(1)} Risk
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-finance-blue hover:bg-finance-blue/90 group-hover:scale-105 transition-transform"
              onClick={() => openProductDetails(product)}
              data-testid={`view-details-${product.id}`}
            >
              {isLocked ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Upgrade to View
                </>
              ) : (
                <>
                  View Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddToCart(product)}
              disabled={isAddingToCart || isLocked}
              data-testid={`add-cart-${product.id}`}
              className="group-hover:scale-105 transition-transform"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-background dark:to-blue-900 p-6">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-finance-blue to-blue-600 rounded-2xl shadow-lg">
            <StoreIcon className="h-8 w-8 text-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              FintekPro Marketplace
            </h1>
            <p className="text-lg text-muted-foreground">
              Curated financial products • Expert recommendations • Trusted providers
            </p>
          </div>
          <div className="ml-auto">
            {isLoadingProducts ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-foreground px-4 py-2 text-sm">
                <Sparkles className="h-4 w-4 mr-2" />
                {products.length} Products Available
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-10">
        {/* Search and Filters */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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

        {/* AI-Powered Recommendations Section */}
        {isAuthenticated && (
          <>
            <AIRecommendations
              riskLevel={selectedRisk === "Low" ? "conservative" : selectedRisk === "High" ? "aggressive" : "moderate"}
              limit={6}
              onAddToCart={(product) => {
                toast({
                  title: "Added to cart",
                  description: `${product.name} has been added to your cart.`,
                });
              }}
              onViewDetails={(product) => {
                toast({
                  title: product.name,
                  description: `${product.product_type} - Suitability Score: ${product.suitability_score}`,
                });
              }}
              className="mb-8"
            />
            <Separator className="my-8" />
          </>
        )}

        {/* Featured Products Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-finance-blue to-blue-600 rounded-lg flex items-center justify-center">
                <Star className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Featured Products</h2>
                <p className="text-sm text-muted-foreground">Handpicked by our experts</p>
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
                <TrendingUp className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top Performing</h2>
                <p className="text-sm text-muted-foreground">Highest returns in the market</p>
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
                    <Flame className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Hot Deals & New Launches</h2>
                    <p className="text-sm text-muted-foreground">Limited time offers and latest products</p>
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
              <Package className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Browse by Category</h2>
              <p className="text-sm text-muted-foreground">Explore our complete product range</p>
            </div>
          </div>
          
          <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="w-full">
            <ScrollableTabsList>
              <TabsTrigger value="all" className="flex-shrink-0" data-testid="category-all">
                All Products
              </TabsTrigger>
              {categories.filter(c => c !== "all").map((category) => (
                <TabsTrigger key={category} value={category} className="flex-shrink-0" data-testid={`category-${category}`}>
                  {category}
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
            
            <TabsContent value={selectedCategory} className="mt-6">
              {/* Show Coming Soon for disabled categories */}
              {selectedCategory !== "all" && isCategoryDisabled(selectedCategory) ? (
                <ComingSoonCategory
                  categoryId={getCategoryInfo(selectedCategory)?.id || selectedCategory}
                  categoryName={selectedCategory}
                  message={getCategoryInfo(selectedCategory)?.comingSoonMessage}
                  expectedDate={getCategoryInfo(selectedCategory)?.comingSoonExpectedDate}
                />
              ) : (
                <div className="space-y-4">
                  {/* Pre-Approved Loan Offers for Loans & Credit */}
                  {selectedCategory === "Loans & Credit" && (
                    <div className="mb-6">
                      <LoanOffersCard />
                    </div>
                  )}

                  {/* Subcategory and Provider filters for categories with subcategories */}
                  {getCurrentCategorySubcategories().length > 0 && (
                    <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Loan Type</label>
                        <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Loan Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Loan Types</SelectItem>
                            {getCurrentCategorySubcategories().map((sub) => (
                              <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Bank / Financier</label>
                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Financiers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Financiers</SelectItem>
                            {getCurrentCategoryProviders().map((provider) => (
                              <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-purple-600 border-purple-600">
                      {getFilteredProducts(
                        selectedCategory === "all" 
                          ? products 
                          : products.filter(p => p.categoryName === selectedCategory)
                      ).length} Products
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredProducts(
                      selectedCategory === "all" 
                        ? products 
                        : products.filter(p => p.categoryName === selectedCategory)
                    ).map(renderProductCard)}
                  </div>
                  {getFilteredProducts(
                    selectedCategory === "all" 
                      ? products 
                      : products.filter(p => p.categoryName === selectedCategory)
                  ).length === 0 && !isCategoryDisabled(selectedCategory) && (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-2 font-medium">No products found</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters or search term</p>
                    </div>
                  )}
                </div>
              )}
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

      {/* KYC Upgrade Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-amber-500" />
              KYC Upgrade Required
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                {selectedLockedProduct && (
                  <p className="mt-1">
                    <strong className="text-foreground">{selectedLockedProduct.name}</strong> requires{" "}
                    <Badge variant="outline" className="ml-1 text-amber-600 border-amber-600">
                      {getTierDisplayName(requiredTier)}
                    </Badge>
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Regulatory Information */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Regulatory Requirement ({getKycRequirementsForTier(requiredTier).regulator})
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    {getKycRequirementsForTier(requiredTier).reason}
                  </p>
                  {selectedLockedProduct?.kycProductCode && (
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                      Reference: {getProductTypeRegulation(selectedLockedProduct.kycProductCode)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Requirements List */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Required Documents/Verification:
              </p>
              <ul className="space-y-2">
                {getKycRequirementsForTier(requiredTier).requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setUpgradeModalOpen(false)}
              className="dark:border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setUpgradeModalOpen(false);
                window.location.href = '/kyc-dashboard';
              }}
              className="bg-finance-blue hover:bg-finance-blue/90"
            >
              <Shield className="h-4 w-4 mr-2" />
              Complete KYC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Inquiry Modal (for disabled/unavailable products) */}
      <Dialog open={inquiryModalOpen} onOpenChange={setInquiryModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 bg-transparent border-0">
          {inquiryProduct && (
            <ProductInquiryForm
              type="product"
              itemId={inquiryProduct.id}
              itemName={inquiryProduct.name}
              categoryName={inquiryProduct.category}
              subcategoryName={inquiryProduct.subcategory}
              description="This product is currently not available for direct purchase. Please submit your requirement and our team will contact you within 24-48 hours."
              onClose={() => {
                setInquiryModalOpen(false);
                setInquiryProduct(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
