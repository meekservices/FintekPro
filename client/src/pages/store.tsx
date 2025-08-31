import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductDetailsModal } from "@/components/product-details-modal";
import { Heart, ShoppingCart, Filter, Search, Star, TrendingUp, Shield, Clock } from "lucide-react";

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

// Mock product data
const mockProducts: Product[] = [
  {
    id: "1",
    name: "HDFC Top 100 Fund",
    shortDescription: "Large cap equity fund with consistent performance",
    category: "Mutual Funds",
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "medium",
    expectedReturns: 12.5,
    provider: "HDFC Asset Management",
    features: ["SIP Available", "Tax Saving", "Online Investment"],
    isFeatured: true,
  },
  {
    id: "2", 
    name: "SBI Life Smart Wealth Builder",
    shortDescription: "Unit-linked insurance plan with market growth potential",
    category: "Insurance",
    productType: "insurance",
    price: 25000,
    minimumInvestment: 12000,
    riskLevel: "medium",
    expectedReturns: 10.8,
    provider: "SBI Life Insurance",
    features: ["Life Cover", "Wealth Creation", "Tax Benefits"],
    isFeatured: false,
  },
  {
    id: "3",
    name: "ICICI Bank Fixed Deposit", 
    shortDescription: "Secure fixed deposit with guaranteed returns",
    category: "Fixed Deposits",
    productType: "fixed_deposit",
    minimumInvestment: 1000,
    riskLevel: "low",
    expectedReturns: 7.2,
    provider: "ICICI Bank",
    features: ["Capital Protection", "Guaranteed Returns", "Flexible Tenure"],
    isFeatured: true,
  },
  {
    id: "4",
    name: "Axis Small Cap Fund",
    shortDescription: "High growth potential small cap equity fund",
    category: "Mutual Funds", 
    productType: "mutual_fund",
    minimumInvestment: 500,
    riskLevel: "high",
    expectedReturns: 15.8,
    provider: "Axis Asset Management",
    features: ["High Growth", "SIP Available", "Professional Management"],
    isFeatured: false,
  },
  {
    id: "5",
    name: "Kotak Mahindra Home Loan",
    shortDescription: "Attractive home loan rates with quick processing",
    category: "Loans",
    productType: "loan",
    minimumInvestment: 100000,
    riskLevel: "low",
    expectedReturns: 8.5,
    provider: "Kotak Mahindra Bank",
    features: ["Quick Approval", "Flexible EMI", "No Hidden Charges"],
    isFeatured: true,
  },
  {
    id: "6",
    name: "Reliance Gold Savings Fund",
    shortDescription: "Gold ETF for portfolio diversification",
    category: "ETFs",
    productType: "etf", 
    minimumInvestment: 1000,
    riskLevel: "medium",
    expectedReturns: 8.9,
    provider: "Reliance Asset Management",
    features: ["Gold Exposure", "Liquidity", "Lower Expense Ratio"],
    isFeatured: false,
  }
];

const categories = ["All", "Mutual Funds", "Insurance", "Fixed Deposits", "Loans", "ETFs"];
const riskLevels = ["All", "low", "medium", "high"];

export default function Store() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("All");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesRisk = selectedRiskLevel === "All" || product.riskLevel === selectedRiskLevel;
    
    return matchesSearch && matchesCategory && matchesRisk;
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

  return (
    <div className="min-h-screen bg-finance-light" data-testid="store-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Store</h1>
          <p className="text-gray-600">Choose from our curated selection of financial products</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8" data-testid="filters-section">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
              <SelectTrigger data-testid="select-risk">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                {riskLevels.map(risk => (
                  <SelectItem key={risk} value={risk}>
                    {risk === "All" ? "All Risk Levels" : `${risk.charAt(0).toUpperCase()}${risk.slice(1)} Risk`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>

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

        {/* All Products */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">All Products</h2>
            <Badge variant="outline" className="text-finance-blue border-finance-blue">
              {filteredProducts.length} Products
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow" data-testid={`product-${product.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                      {product.isFeatured && (
                        <Badge className="bg-finance-blue text-white text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                    </div>
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
                  <p className="text-xs text-gray-500">by {product.provider}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        Returns
                      </span>
                      <span className="text-green-600 font-semibold">{product.expectedReturns}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Min Investment</span>
                      <span className="font-semibold">₹{product.minimumInvestment.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium flex items-center">
                        <Shield className="h-4 w-4 mr-1" />
                        Risk
                      </span>
                      <Badge className={getRiskColor(product.riskLevel)}>
                        {product.riskLevel.charAt(0).toUpperCase() + product.riskLevel.slice(1)}
                      </Badge>
                    </div>
                    
                    <div className="pt-2">
                      <div className="flex gap-2 flex-wrap mb-3">
                        {product.features.slice(0, 2).map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {product.features.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{product.features.length - 2} more
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1" 
                          onClick={() => openProductDetails(product)}
                          data-testid={`button-details-${product.id}`}
                        >
                          View Details
                        </Button>
                        <Button className="flex-1 bg-finance-blue hover:bg-finance-blue/90" size="sm" data-testid={`button-invest-${product.id}`}>
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Invest
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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