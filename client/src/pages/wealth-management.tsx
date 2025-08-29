import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2,
  Building, 
  TrendingUp, 
  Users, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  LineChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Star,
  Clock,
  Shield,
  Target,
  Briefcase,
  CreditCard,
  Home,
  Landmark,
  Zap,
  Eye,
  Plus,
  Search,
  Filter,
  Download,
  Info,
  Factory,
  Calculator,
  FileSearch,
  History,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Gem,
  CheckCircle,
  BarChart
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MarketNewsletter } from "@/components/wealth/market-newsletter";

// Define the mutual fund interface
interface MutualFund {
  schemeCode: string;
  schemeName: string;
  category: string;
  fundHouse: string;
  nav: string;
  lastUpdated?: string;
  returns1Y?: string;
  aum?: string;
  expenseRatio?: string;
  rating?: number;
  riskLevel?: string;
}

export default function WealthManagement() {
  const [activeTab, setActiveTab] = useState("overview");

  // Real-time mutual funds data with auto-refresh every 30 seconds
  const { data: mutualFunds = [], isLoading: isMutualFundsLoading, error: mutualFundsError } = useQuery<MutualFund[]>({
    queryKey: ["/api/mutual-funds"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to enable frequent updates
  });

  // Popular funds data with auto-refresh
  const { data: popularFunds = [], isLoading: isPopularLoading } = useQuery<MutualFund[]>({
    queryKey: ["/api/mutual-funds/popular"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Status updates for real-time data
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update timestamp every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Enhanced fund data with performance metrics
  const enhancedFunds = [
    {
      schemeCode: "120503",
      schemeName: "Axis Small Cap Fund",
      category: "Small Cap - Equity",
      fundHouse: "Axis Mutual Fund",
      nav: "68.45",
      returns1Y: "+35.78%",
      aum: "₹28,456 Cr",
      expenseRatio: "1.25%",
      rating: 5,
      riskLevel: "High Risk"
    },
    {
      schemeCode: "120504",
      schemeName: "DSP Mid Cap Fund",
      category: "Mid Cap - Equity", 
      fundHouse: "DSP Mutual Fund",
      nav: "89.23",
      returns1Y: "+31.23%",
      aum: "₹19,832 Cr",
      expenseRatio: "1.15%",
      rating: 4,
      riskLevel: "High Risk"
    },
    {
      schemeCode: "120505",
      schemeName: "ICICI Tech Fund",
      category: "Sectoral - Technology",
      fundHouse: "ICICI Prudential Mutual Fund", 
      nav: "145.67",
      returns1Y: "+28.92%",
      aum: "₹15,234 Cr",
      expenseRatio: "1.35%",
      rating: 4,
      riskLevel: "Very High Risk"
    },
    {
      schemeCode: "120506", 
      schemeName: "Mirae Large Cap Fund",
      category: "Large Cap - Equity",
      fundHouse: "Mirae Asset Mutual Fund",
      nav: "78.91",
      returns1Y: "+21.67%",
      aum: "₹32,145 Cr",
      expenseRatio: "0.95%",
      rating: 5,
      riskLevel: "Moderate Risk"
    },
    {
      schemeCode: "120507",
      schemeName: "HDFC Top 100 Fund", 
      category: "Large Cap - Equity",
      fundHouse: "HDFC Mutual Fund",
      nav: "567.34",
      returns1Y: "+19.56%",
      aum: "₹45,678 Cr",
      expenseRatio: "1.05%",
      rating: 4,
      riskLevel: "Moderate Risk"
    },
    {
      schemeCode: "120508",
      schemeName: "SBI Bluechip Fund",
      category: "Large Cap - Equity", 
      fundHouse: "SBI Mutual Fund",
      nav: "62.78",
      returns1Y: "+18.45%",
      aum: "₹38,234 Cr",
      expenseRatio: "0.89%",
      rating: 4,
      riskLevel: "Moderate Risk"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-wealth-title">
                <Building2 className="w-8 h-8 text-primary" />
                Wealth Management
              </h1>
              <p className="text-muted-foreground mt-1">Comprehensive wealth management and trading platform</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" data-testid="button-download-app">
                <Download className="w-4 h-4 mr-2" />
                Download App
              </Button>
              <Button data-testid="button-start-investing">
                <TrendingUp className="w-4 h-4 mr-2" />
                Start Investing
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="overview" data-testid="tab-overview">Dashboard</TabsTrigger>
            <TabsTrigger value="broking" data-testid="tab-broking">FintekPro Broking</TabsTrigger>
            <TabsTrigger value="portfolios" data-testid="tab-portfolios">FintekPro Portfolios</TabsTrigger>
            <TabsTrigger value="ideas" data-testid="tab-ideas">FintekPro Ideas</TabsTrigger>
            <TabsTrigger value="family" data-testid="tab-family">Family Account</TabsTrigger>
            <TabsTrigger value="pms" data-testid="tab-pms">PMS</TabsTrigger>
            <TabsTrigger value="pre-ipo" data-testid="tab-pre-ipo">Pre-IPO</TabsTrigger>
            <TabsTrigger value="aif" data-testid="tab-aif">AIF Funds</TabsTrigger>
            <TabsTrigger value="unlisted" data-testid="tab-unlisted">Unlisted</TabsTrigger>
            <TabsTrigger value="bonds" data-testid="tab-bonds">Bonds</TabsTrigger>
            <TabsTrigger value="mutual-funds" data-testid="tab-mutual-funds">Mutual Funds</TabsTrigger>
            <TabsTrigger value="newsletter" data-testid="tab-newsletter">Newsletter</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="card-total-investments">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Investments</p>
                      <p className="text-2xl font-bold" data-testid="text-total-investments">₹4,91,00,000</p>
                      <p className="text-xs text-green-600 flex items-center mt-1">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        +12.5% from last month
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-app-downloads">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">App Downloads</p>
                      <p className="text-2xl font-bold" data-testid="text-app-downloads">10,901+</p>
                      <p className="text-xs text-blue-600 flex items-center mt-1">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        Growing daily
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-wealth-partners">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">FintekPro Partners</p>
                      <p className="text-2xl font-bold" data-testid="text-wealth-partners">545+</p>
                      <p className="text-xs text-purple-600 flex items-center mt-1">
                        <Users className="w-3 h-3 mr-1" />
                        Expert advisors
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-portfolio-performance">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Portfolio Performance</p>
                      <p className="text-2xl font-bold" data-testid="text-portfolio-performance">+18.7%</p>
                      <p className="text-xs text-green-600 flex items-center mt-1">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        YTD Returns
                      </p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Featured Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Broking Highlights */}
              <Card data-testid="card-broking-highlights">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-primary" />
                    FintekPro Broking
                  </CardTitle>
                  <CardDescription>India's minimal broking charges platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="font-medium">Equity Trading</span>
                    <Badge className="bg-green-100 text-green-800">₹0 Brokerage*</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium">F&O Trading</span>
                    <Badge className="bg-blue-100 text-blue-800">Flat ₹20</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="font-medium">Family Account</span>
                    <Badge className="bg-purple-100 text-purple-800">Available</Badge>
                  </div>
                  <Button className="w-full" data-testid="button-start-trading">
                    <Zap className="w-4 h-4 mr-2" />
                    Start Trading
                  </Button>
                </CardContent>
              </Card>

              {/* Portfolio Solutions */}
              <Card data-testid="card-portfolio-solutions">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    FintekPro Portfolios
                  </CardTitle>
                  <CardDescription>Curated portfolios by investment experts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Diversified Portfolio</span>
                      <span className="text-sm text-green-600">+15.2%</span>
                    </div>
                    <Progress value={68} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Target: ₹10L</span>
                      <span>Current: ₹6.8L</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Tax Saver Portfolio</span>
                      <span className="text-sm text-green-600">+12.8%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Target: ₹1.5L</span>
                      <span>Current: ₹67K</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" data-testid="button-view-portfolios">
                    View All Portfolios
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Investment Products Grid */}
            <Card data-testid="card-investment-products">
              <CardHeader>
                <CardTitle>Investment Products</CardTitle>
                <CardDescription>Wide range of investment options</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-mutual-funds">
                    <PieChart className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <h3 className="font-medium text-sm">Mutual Funds</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-fixed-deposits">
                    <Landmark className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <h3 className="font-medium text-sm">Fixed Deposits</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-debentures">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <h3 className="font-medium text-sm">Debentures</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-pms">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                    <h3 className="font-medium text-sm">PMS</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-insurance">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <h3 className="font-medium text-sm">Insurance</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-pre-ipo">
                    <Star className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                    <h3 className="font-medium text-sm">Pre-IPO</h3>
                  </div>
                  <div className="text-center p-4 border rounded-lg hover:bg-accent cursor-pointer" data-testid="product-aif">
                    <Target className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                    <h3 className="font-medium text-sm">AIF</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FintekPro Broking Tab */}
          <TabsContent value="broking" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trading Features */}
              <Card data-testid="card-trading-features">
                <CardHeader>
                  <CardTitle>Trading Features</CardTitle>
                  <CardDescription>Unbeatable pricing in the market</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="font-medium">Equity Delivery</div>
                      <div className="text-sm text-muted-foreground">Zero brokerage</div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Free</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium">Equity Intraday</div>
                      <div className="text-sm text-muted-foreground">0.03% or ₹20</div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Low Cost</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <div className="font-medium">F&O Trading</div>
                      <div className="text-sm text-muted-foreground">Flat rate per order</div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">₹20</Badge>
                  </div>
                  <Button className="w-full" data-testid="button-open-trading-account">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Open Trading Account
                  </Button>
                </CardContent>
              </Card>

              {/* Curated Watchlists */}
              <Card data-testid="card-curated-watchlists">
                <CardHeader>
                  <CardTitle>Curated Watchlists</CardTitle>
                  <CardDescription>Expert-curated investment ideas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium">Top Performers</span>
                    </div>
                    <Badge variant="outline">12 stocks</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">Dividend Champions</span>
                    </div>
                    <Badge variant="outline">8 stocks</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="font-medium">Growth Stocks</span>
                    </div>
                    <Badge variant="outline">15 stocks</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="font-medium">Value Picks</span>
                    </div>
                    <Badge variant="outline">10 stocks</Badge>
                  </div>
                  <Button variant="outline" className="w-full" data-testid="button-view-all-watchlists">
                    <Eye className="w-4 h-4 mr-2" />
                    View All Watchlists
                  </Button>
                </CardContent>
              </Card>

              {/* Family Account */}
              <Card data-testid="card-family-account">
                <CardHeader>
                  <CardTitle>Family Account</CardTitle>
                  <CardDescription>Track & invest via family account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Primary Account</span>
                      <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Spouse Account</span>
                      <Badge variant="outline">Linked</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Child Account 1</span>
                      <Badge variant="outline">Linked</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Child Account 2</span>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-accent/50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total Family Portfolio</span>
                      <span className="text-lg font-bold">₹12,45,000</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Combined investment across all accounts
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" data-testid="button-manage-family-account">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Family Account
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Live Market Data */}
            <Card data-testid="card-live-market-data">
              <CardHeader>
                <CardTitle>Live Market Data</CardTitle>
                <CardDescription>Real-time market information and trading opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Input placeholder="Search stocks..." className="flex-1" data-testid="input-search-stocks" />
                  <Button variant="outline" data-testid="button-search-stocks">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  <Button variant="outline" data-testid="button-filter-stocks">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stock</TableHead>
                      <TableHead>LTP</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>% Change</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow data-testid="stock-row-1">
                      <TableCell>
                        <div className="font-medium">Reliance Industries</div>
                        <div className="text-sm text-muted-foreground">RELIANCE</div>
                      </TableCell>
                      <TableCell className="font-medium">₹2,456.75</TableCell>
                      <TableCell className="text-green-600">+34.50</TableCell>
                      <TableCell className="text-green-600">+1.42%</TableCell>
                      <TableCell>1.2M</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" data-testid="button-buy-stock-1">Buy</Button>
                          <Button size="sm" variant="outline" data-testid="button-sell-stock-1">Sell</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="stock-row-2">
                      <TableCell>
                        <div className="font-medium">Tata Consultancy Services</div>
                        <div className="text-sm text-muted-foreground">TCS</div>
                      </TableCell>
                      <TableCell className="font-medium">₹3,789.20</TableCell>
                      <TableCell className="text-red-600">-45.30</TableCell>
                      <TableCell className="text-red-600">-1.18%</TableCell>
                      <TableCell>856K</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" data-testid="button-buy-stock-2">Buy</Button>
                          <Button size="sm" variant="outline" data-testid="button-sell-stock-2">Sell</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other tabs content will be added in subsequent updates */}
          <TabsContent value="portfolios" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">FintekPro Portfolios</h3>
                <p className="text-muted-foreground">Curated portfolios feature coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">FintekPro Ideas</h3>
                <p className="text-muted-foreground">Investment ideas and recommendations coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="family" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Family Account Management</h3>
                <p className="text-muted-foreground">Comprehensive family account features coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pms" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Portfolio Management Services</h3>
                <p className="text-muted-foreground">Professional portfolio management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bonds Tab Content */}
          <TabsContent value="bonds" className="space-y-6">
            {/* Bonds Market Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card data-testid="card-bonds-stats">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Listed Bonds</p>
                      <p className="text-2xl font-bold">847</p>
                    </div>
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">NSE & BSE</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-bond-yield">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Yield</p>
                      <p className="text-2xl font-bold">7.54%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <Plus className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">+0.12% today</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-govt-bonds">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Govt Bonds</p>
                      <p className="text-2xl font-bold">6.89%</p>
                    </div>
                    <Shield className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <Clock className="w-4 h-4 text-purple-600 mr-1" />
                    <span className="text-sm text-purple-600">Risk-free</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-corporate-bonds">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Corporate</p>
                      <p className="text-2xl font-bold">8.12%</p>
                    </div>
                    <Gem className="w-8 h-8 text-orange-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <Target className="w-4 h-4 text-orange-600 mr-1" />
                    <span className="text-sm text-orange-600">Higher yield</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bonds Categories Tabs */}
            <Tabs defaultValue="government" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="government" data-testid="tab-government-bonds">Government</TabsTrigger>
                <TabsTrigger value="corporate" data-testid="tab-corporate-bonds">Corporate</TabsTrigger>
                <TabsTrigger value="municipal" data-testid="tab-municipal-bonds">Municipal</TabsTrigger>
                <TabsTrigger value="bond-analytics" data-testid="tab-bond-analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Government Bonds */}
              <TabsContent value="government" className="space-y-4">
                <Card data-testid="card-government-bonds-list">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      Government Bonds
                    </CardTitle>
                    <CardDescription>Risk-free government securities with guaranteed returns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">10-Year G-Sec</h4>
                              <p className="text-sm text-muted-foreground">Government of India</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Yield</p>
                              <p className="font-medium">6.89%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Maturity</p>
                              <p className="font-medium">2034</p>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3" data-testid="button-buy-gsec">
                            Invest Now
                          </Button>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">5-Year State Bond</h4>
                              <p className="text-sm text-muted-foreground">State Development Loan</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">Available</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Yield</p>
                              <p className="font-medium">7.12%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Maturity</p>
                              <p className="font-medium">2029</p>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3" data-testid="button-buy-state-bond">
                            Invest Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Corporate Bonds */}
              <TabsContent value="corporate" className="space-y-4">
                <Card data-testid="card-corporate-bonds-list">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      Corporate Bonds
                    </CardTitle>
                    <CardDescription>Higher yield bonds from top-rated corporations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">HDFC Bank NCD</h4>
                              <p className="text-sm text-muted-foreground">AAA Rated</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Hot</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Yield</p>
                              <p className="font-medium">8.25%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Maturity</p>
                              <p className="font-medium">3 Years</p>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3" data-testid="button-buy-hdfc-ncd">
                            Invest Now
                          </Button>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">Bajaj Finance FD</h4>
                              <p className="text-sm text-muted-foreground">AA+ Rated</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">Popular</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Yield</p>
                              <p className="font-medium">8.60%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Maturity</p>
                              <p className="font-medium">5 Years</p>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3" data-testid="button-buy-bajaj-fd">
                            Invest Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Municipal Bonds */}
              <TabsContent value="municipal" className="space-y-4">
                <Card data-testid="card-municipal-bonds">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-green-600" />
                      Municipal Bonds
                    </CardTitle>
                    <CardDescription>Tax-free bonds from municipal corporations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Building className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">Municipal Bonds</h3>
                      <p className="text-muted-foreground">Tax-efficient municipal bond investments coming soon...</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bond Analytics */}
              <TabsContent value="bond-analytics" className="space-y-4">
                <Card data-testid="card-bond-analytics">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart className="w-5 h-5 text-indigo-600" />
                      Bond Market Analytics
                    </CardTitle>
                    <CardDescription>Comprehensive bond market analysis and trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <BarChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">Bond Analytics</h3>
                      <p className="text-muted-foreground">Advanced bond market analytics coming soon...</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* AIF Funds Tab Content */}
          <TabsContent value="aif" className="space-y-6">
            <AIFFundsSection />
          </TabsContent>

          <TabsContent value="pre-ipo" className="space-y-6">
            {/* Pre-IPO Market Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card data-testid="card-ipo-stats">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Upcoming IPOs</p>
                      <p className="text-2xl font-bold">15</p>
                    </div>
                    <Star className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">+3 this month</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-current-ipos">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current IPOs</p>
                      <p className="text-2xl font-bold">2</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <Clock className="w-4 h-4 text-orange-600 mr-1" />
                    <span className="text-sm text-orange-600">Closing soon</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-total-amount">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                      <p className="text-2xl font-bold">₹45,680 Cr</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">+12% YTD</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-avg-listing-gains">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Listing Gains</p>
                      <p className="text-2xl font-bold">14.8%</p>
                    </div>
                    <Target className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">Strong performance</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* IPO Tabs */}
            <Tabs defaultValue="current" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="current" data-testid="tab-current-ipos">Current IPOs</TabsTrigger>
                <TabsTrigger value="upcoming" data-testid="tab-upcoming-ipos">Upcoming</TabsTrigger>
                <TabsTrigger value="recent" data-testid="tab-recent-listings">Recent Listings</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-ipo-analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Current IPOs */}
              <TabsContent value="current" className="space-y-4">
                <Card data-testid="card-current-ipo-vishal">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Vishal Mega Mart Ltd</CardTitle>
                          <CardDescription>Retail • NSE</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-800">Closing Soon</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Issue Size</p>
                        <p className="font-semibold">₹8,000 Cr</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price Range</p>
                        <p className="font-semibold">₹74-78</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Min Investment</p>
                        <p className="font-semibold">₹14,976</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">GMP</p>
                        <p className="font-semibold text-green-600">+₹12 (16.2%)</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subscription Status: 6.2x</span>
                        <span className="font-medium">1 day remaining</span>
                      </div>
                      <Progress value={85} className="h-2" />
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>Retail: <span className="font-medium">8.5x</span></div>
                        <div>HNI: <span className="font-medium">4.2x</span></div>
                        <div>Institutional: <span className="font-medium">2.1x</span></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" data-testid="button-apply-ipo">
                        <Star className="w-4 h-4 mr-2" />
                        Apply Now
                      </Button>
                      <Button variant="outline" size="icon">
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-current-ipo-blackstone">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Blackstone Secured Credit Fund</CardTitle>
                          <CardDescription>Financial Services • BSE</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">Open</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Issue Size</p>
                        <p className="font-semibold">₹1,000 Cr</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price Range</p>
                        <p className="font-semibold">₹24-25</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Min Investment</p>
                        <p className="font-semibold">₹15,000</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">GMP</p>
                        <p className="font-semibold text-green-600">+₹3 (12.5%)</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subscription Status: 1.8x</span>
                        <span className="font-medium">2 days remaining</span>
                      </div>
                      <Progress value={45} className="h-2" />
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>Retail: <span className="font-medium">2.1x</span></div>
                        <div>HNI: <span className="font-medium">1.4x</span></div>
                        <div>Institutional: <span className="font-medium">1.9x</span></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" data-testid="button-apply-blackstone">
                        <Star className="w-4 h-4 mr-2" />
                        Apply Now
                      </Button>
                      <Button variant="outline" size="icon">
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Upcoming IPOs */}
              <TabsContent value="upcoming" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card data-testid="card-upcoming-purva">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Purva Bharti Power</CardTitle>
                          <CardDescription>Infrastructure • NSE</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Issue Size:</span>
                          <span className="font-medium">₹1,200 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price Range:</span>
                          <span className="font-medium">₹280-320</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Opens:</span>
                          <span className="font-medium">Feb 15, 2025</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GMP:</span>
                          <span className="font-medium text-green-600">+₹45 (15.8%)</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full">Set Reminder</Button>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-upcoming-abans">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Abans Holdings</CardTitle>
                          <CardDescription>Financial Services • BSE</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Issue Size:</span>
                          <span className="font-medium">₹540 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price Range:</span>
                          <span className="font-medium">₹256-270</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Opens:</span>
                          <span className="font-medium">Feb 12, 2025</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GMP:</span>
                          <span className="font-medium text-green-600">+₹28 (10.4%)</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full">Set Reminder</Button>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-upcoming-standard-glass">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Factory className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Standard Glass Lining</CardTitle>
                          <CardDescription>Manufacturing • NSE</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Issue Size:</span>
                          <span className="font-medium">₹410 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Price Range:</span>
                          <span className="font-medium">₹540-567</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Opens:</span>
                          <span className="font-medium">Feb 10, 2025</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GMP:</span>
                          <span className="font-medium text-green-600">+₹85 (15.2%)</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full">Set Reminder</Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Recent Listings */}
              <TabsContent value="recent" className="space-y-4">
                <Card data-testid="card-recent-listings">
                  <CardHeader>
                    <CardTitle>Recent IPO Listings Performance</CardTitle>
                    <CardDescription>Track how recently listed IPOs are performing in the market</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Mahindra Logistics</h3>
                            <Badge className="bg-green-100 text-green-800">Strong</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Issue Price:</span>
                              <span className="font-medium">₹432</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Price:</span>
                              <span className="font-medium">₹524</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Listing Gains:</span>
                              <span className="font-medium text-green-600">+12.5%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Gains:</span>
                              <span className="font-medium text-green-600">+21.3%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Sagility India</h3>
                            <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Issue Price:</span>
                              <span className="font-medium">₹30</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Price:</span>
                              <span className="font-medium">₹36</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Listing Gains:</span>
                              <span className="font-medium text-green-600">+13.3%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Gains:</span>
                              <span className="font-medium text-green-600">+20.0%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Swiggy Ltd</h3>
                            <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Issue Price:</span>
                              <span className="font-medium">₹390</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Price:</span>
                              <span className="font-medium">₹445</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Listing Gains:</span>
                              <span className="font-medium text-green-600">+5.6%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Gains:</span>
                              <span className="font-medium text-green-600">+14.1%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* IPO Analytics */}
              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-market-trends">
                    <CardHeader>
                      <CardTitle>IPO Market Trends</CardTitle>
                      <CardDescription>Monthly IPO activity and amount raised</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium">Sep</div>
                            <div className="text-muted-foreground">8 IPOs</div>
                            <div className="text-xs">₹12.5k Cr</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Oct</div>
                            <div className="text-muted-foreground">12 IPOs</div>
                            <div className="text-xs">₹18.8k Cr</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Nov</div>
                            <div className="text-muted-foreground">15 IPOs</div>
                            <div className="text-xs">₹22.3k Cr</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Dec</div>
                            <div className="text-muted-foreground">18 IPOs</div>
                            <div className="text-xs">₹28.9k Cr</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Jan</div>
                            <div className="text-muted-foreground">6 IPOs</div>
                            <div className="text-xs">₹15.3k Cr</div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Retail Participation</span>
                            <span className="text-lg font-bold">68%</span>
                          </div>
                          <Progress value={68} className="h-2" />
                          
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Institutional Interest</span>
                            <span className="text-lg font-bold text-green-600">Strong</span>
                          </div>
                          <Progress value={85} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-sector-analysis">
                    <CardHeader>
                      <CardTitle>Sector-wise Analysis</CardTitle>
                      <CardDescription>IPO performance by sectors</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Technology</span>
                            </div>
                            <span className="font-medium text-green-600">+18.5%</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Healthcare</span>
                            </div>
                            <span className="font-medium text-green-600">+16.2%</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                              <span>Financial Services</span>
                            </div>
                            <span className="font-medium text-green-600">+14.8%</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                              <span>Manufacturing</span>
                            </div>
                            <span className="font-medium text-green-600">+12.3%</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <span>Infrastructure</span>
                            </div>
                            <span className="font-medium text-green-600">+11.5%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="unlisted" className="space-y-6">
            {/* Unlisted Securities Market Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card data-testid="card-unlisted-market-size">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Market Size</p>
                      <p className="text-2xl font-bold">₹75.40 L Cr</p>
                    </div>
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">+18.2% YoY</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-pre-ipo-deals">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                      <p className="text-2xl font-bold">245</p>
                    </div>
                    <Star className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">Growing rapidly</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-average-returns">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg. Returns</p>
                      <p className="text-2xl font-bold">25.8%</p>
                    </div>
                    <Target className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600">High potential</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-unicorn-count">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unicorns</p>
                      <p className="text-2xl font-bold">108</p>
                    </div>
                    <Gem className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div className="flex items-center mt-2">
                    <Plus className="w-4 h-4 text-blue-600 mr-1" />
                    <span className="text-sm text-blue-600">Premium access</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Unlisted Categories Tabs */}
            <Tabs defaultValue="pre-ipo" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pre-ipo" data-testid="tab-pre-ipo">Pre-IPO</TabsTrigger>
                <TabsTrigger value="startup-equity" data-testid="tab-startup-equity">Startup Equity</TabsTrigger>
                <TabsTrigger value="unicorn-stakes" data-testid="tab-unicorn-stakes">Unicorn Stakes</TabsTrigger>
                <TabsTrigger value="esop-buybacks" data-testid="tab-esop-buybacks">ESOP Buybacks</TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-unlisted-analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Pre-IPO Securities */}
              <TabsContent value="pre-ipo" className="space-y-4">
                <Card data-testid="card-pre-ipo-companies">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-blue-600" />
                          Pre-IPO Companies
                        </CardTitle>
                        <CardDescription>Exclusive access to companies before they go public</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select defaultValue="all">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Exchanges</SelectItem>
                            <SelectItem value="nse">NSE</SelectItem>
                            <SelectItem value="bse">BSE</SelectItem>
                            <SelectItem value="mcx">MCX</SelectItem>
                            <SelectItem value="ncdex">NCDEX</SelectItem>
                            <SelectItem value="msei">MSEI</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select defaultValue="all">
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="government">Government</SelectItem>
                            <SelectItem value="corporate">Corporate</SelectItem>
                            <SelectItem value="banking">Banking</SelectItem>
                            <SelectItem value="infrastructure">Infrastructure</SelectItem>
                            <SelectItem value="commodity">Commodity-Linked</SelectItem>
                            <SelectItem value="agricultural">Agricultural</SelectItem>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="green">Green Bonds</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Exchange Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">16</div>
                          <div className="text-sm text-muted-foreground">Total Listed (5 Exchanges)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">₹12,895 Cr</div>
                          <div className="text-sm text-muted-foreground">Total Volume</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">7.54%</div>
                          <div className="text-sm text-muted-foreground">Avg Yield (All Exchanges)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">0.42%</div>
                          <div className="text-sm text-muted-foreground">Top Gainer</div>
                        </div>
                      </div>

                      {/* NSE Listed Bonds */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800">NSE</Badge>
                          <h4 className="font-semibold">National Stock Exchange Bonds</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* NSE Government Security */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">7.17% GoI 2028</h3>
                                <p className="text-sm text-muted-foreground">IN0020240200 • NSE</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-blue-100 text-blue-800">SOV</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.20%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹101.45</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.12%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹2,850 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Last Trade:</span>
                                <span className="font-medium">15:30:00</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Bid: ₹101.42 | Ask: ₹101.48
                              </div>
                              <Button size="sm">Trade Now</Button>
                            </div>
                          </div>

                          {/* NSE Corporate Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">HDFC Bank 8.25% NCD</h3>
                                <p className="text-sm text-muted-foreground">INE040A08469 • NSE</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-purple-100 text-purple-800">AAA</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.32%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹1,028.75</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">8.15%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹1,245 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Duration:</span>
                                <span className="font-medium">2.8 years</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Bid: ₹1,028.50 | Ask: ₹1,029.00
                              </div>
                              <Button size="sm">Trade Now</Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BSE Listed Bonds */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-800">BSE</Badge>
                          <h4 className="font-semibold">Bombay Stock Exchange Bonds</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* BSE Government Security */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">7.17% GoI Security</h3>
                                <p className="text-sm text-muted-foreground">970GS2028 • BSE</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-blue-100 text-blue-800">SOV</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.13%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹101.38</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.14%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹1,850 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Last Trade:</span>
                                <span className="font-medium">15:29:00</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Bid: ₹101.35 | Ask: ₹101.41
                              </div>
                              <Button size="sm">Trade Now</Button>
                            </div>
                          </div>

                          {/* BSE Tax-Free Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">NHAI 7.35% Tax-Free</h3>
                                <p className="text-sm text-muted-foreground">973612 • BSE</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-green-100 text-green-800">Tax-Free</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.32%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹1,018.45</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.28%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹480 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Duration:</span>
                                <span className="font-medium">9.8 years</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Bid: ₹1,018.00 | Ask: ₹1,019.00
                              </div>
                              <Button size="sm">Trade Now</Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* MCX Commodity-Linked Bonds */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-100 text-yellow-800">MCX</Badge>
                          <h4 className="font-semibold">Multi Commodity Exchange Bonds</h4>
                          <Badge variant="outline" className="text-xs">Commodity-Linked</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* MCX Gold-Linked Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">MCX Gold-Linked Bond 2030</h3>
                                <p className="text-sm text-muted-foreground">MCXAGRI001 • MCX</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-yellow-100 text-yellow-800">AA+</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.20%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹10,245.80</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">6.75%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹450 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Gold Price:</span>
                                <span className="font-medium">₹72,450/10g</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Linkage Ratio: 1:1.2 | Bid: ₹10,240 | Ask: ₹10,250
                              </div>
                            </div>
                          </div>

                          {/* MCX Silver-Linked Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">MCX Silver-Linked NCD 2028</h3>
                                <p className="text-sm text-muted-foreground">MCXAGRI002 • MCX</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-gray-100 text-gray-800">AA</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.30%</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>Current Price:</span>
                                <span className="font-medium">₹5,180.45</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.08%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹285 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Silver Price:</span>
                                <span className="font-medium">₹94,250/kg</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div className="text-xs text-muted-foreground">
                                Linkage Ratio: 1:1.5 | Bid: ₹5,175 | Ask: ₹5,185
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* NCDEX Agricultural Bonds */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">NCDEX</Badge>
                          <h4 className="font-semibold">National Commodity & Derivatives Exchange Bonds</h4>
                          <Badge variant="outline" className="text-xs">Agricultural</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* NCDEX Wheat-Linked Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">NCDEX Wheat-Linked Bond</h3>
                                <p className="text-sm text-muted-foreground">NCDXAGRI001 • NCDEX</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-amber-100 text-amber-800">AA+</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.24%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹25,680.50</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.32%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹320 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Wheat Price:</span>
                                <span className="font-medium">₹2,580/qt</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Seasonality:</span>
                                <span className="text-blue-600">Rabi Crop</span>
                              </div>
                            </div>
                          </div>

                          {/* NCDEX Cotton-Linked Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">NCDEX Cotton-Linked NCD</h3>
                                <p className="text-sm text-muted-foreground">NCDXAGRI002 • NCDEX</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-white-100 text-white-800 border">AA</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.20%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹51,450.75</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.65%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹195 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Cotton Price:</span>
                                <span className="font-medium">₹58,400/candy</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Seasonality:</span>
                                <span className="text-orange-600">Kharif Crop</span>
                              </div>
                            </div>
                          </div>

                          {/* NCDEX Soybean-Linked Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">NCDEX Soybean-Linked</h3>
                                <p className="text-sm text-muted-foreground">NCDXAGRI003 • NCDEX</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-green-100 text-green-800">AA+</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.15%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹1,03,250.90</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">7.95%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹275 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Soybean Price:</span>
                                <span className="font-medium">₹4,850/qt</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Seasonality:</span>
                                <span className="text-orange-600">Kharif Crop</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* MSEI Specialized Bonds */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-800">MSEI</Badge>
                          <h4 className="font-semibold">Metropolitan Stock Exchange Bonds</h4>
                          <Badge variant="outline" className="text-xs">SME & Specialized</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* MSEI Green Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">MSEI SME Green Bond</h3>
                                <p className="text-sm text-muted-foreground">MSEI001 • MSEI</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-green-100 text-green-800">Green</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.34%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹10,425.60</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">8.68%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹125 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Green Category:</span>
                                <span className="text-green-600">Renewable Energy</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Carbon Credits:</span>
                                <span className="text-xs">500 tonnes CO2/year</span>
                              </div>
                            </div>
                          </div>

                          {/* MSEI Technology Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">MSEI Technology NCD</h3>
                                <p className="text-sm text-muted-foreground">MSEI002 • MSEI</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-blue-100 text-blue-800">Tech</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.19%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹51,850.40</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">9.02%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹85 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Sector:</span>
                                <span className="text-blue-600">Fintech & AI</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Index:</span>
                                <span className="text-xs">Tech250</span>
                              </div>
                            </div>
                          </div>

                          {/* MSEI Healthcare Bond */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">MSEI Healthcare Bond</h3>
                                <p className="text-sm text-muted-foreground">MSEI003 • MSEI</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-red-100 text-red-800">Healthcare</Badge>
                                <div className="text-sm text-green-600 mt-1">+0.22%</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Price:</span>
                                <span className="font-medium">₹25,975.80</span>
                              </div>
                              <div className="flex justify-between">
                                <span>YTM:</span>
                                <span className="font-medium text-green-600">8.42%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-medium">₹95 Cr</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Sector:</span>
                                <span className="text-red-600">Pharmaceuticals</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span className="text-xs">SEBI Approved</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Market Activity Table */}
                      <div className="border rounded-lg">
                        <div className="p-4 border-b">
                          <h4 className="font-semibold">Live Bond Market Activity - All Exchanges</h4>
                          <p className="text-sm text-muted-foreground">Real-time trading data from NSE, BSE, MCX, NCDEX & MSEI</p>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Exchange</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Change</TableHead>
                                <TableHead>YTM</TableHead>
                                <TableHead>Volume</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">7.17% GoI 2028</div>
                                    <div className="text-xs text-muted-foreground">IN0020240200</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-blue-100 text-blue-800">NSE</Badge></TableCell>
                                <TableCell className="font-medium">₹101.45</TableCell>
                                <TableCell className="text-green-600">+0.20%</TableCell>
                                <TableCell>7.12%</TableCell>
                                <TableCell>₹2,850 Cr</TableCell>
                                <TableCell><Badge>SOV</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">HDFC 8.25% NCD</div>
                                    <div className="text-xs text-muted-foreground">INE040A08469</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-blue-100 text-blue-800">NSE</Badge></TableCell>
                                <TableCell className="font-medium">₹1,028.75</TableCell>
                                <TableCell className="text-green-600">+0.32%</TableCell>
                                <TableCell>8.15%</TableCell>
                                <TableCell>₹1,245 Cr</TableCell>
                                <TableCell><Badge>AAA</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">NHAI Tax-Free</div>
                                    <div className="text-xs text-muted-foreground">973612</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-orange-100 text-orange-800">BSE</Badge></TableCell>
                                <TableCell className="font-medium">₹1,018.45</TableCell>
                                <TableCell className="text-green-600">+0.32%</TableCell>
                                <TableCell>7.28%</TableCell>
                                <TableCell>₹480 Cr</TableCell>
                                <TableCell><Badge>AAA</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">MCX Gold-Linked</div>
                                    <div className="text-xs text-muted-foreground">MCXAGRI001</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-yellow-100 text-yellow-800">MCX</Badge></TableCell>
                                <TableCell className="font-medium">₹10,245.80</TableCell>
                                <TableCell className="text-green-600">+0.20%</TableCell>
                                <TableCell>6.75%</TableCell>
                                <TableCell>₹450 Cr</TableCell>
                                <TableCell><Badge>AA+</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">NCDEX Wheat-Linked</div>
                                    <div className="text-xs text-muted-foreground">NCDXAGRI001</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-green-100 text-green-800">NCDEX</Badge></TableCell>
                                <TableCell className="font-medium">₹25,680.50</TableCell>
                                <TableCell className="text-green-600">+0.24%</TableCell>
                                <TableCell>7.32%</TableCell>
                                <TableCell>₹320 Cr</TableCell>
                                <TableCell><Badge>AA+</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">MSEI Green Bond</div>
                                    <div className="text-xs text-muted-foreground">MSEI001</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-purple-100 text-purple-800">MSEI</Badge></TableCell>
                                <TableCell className="font-medium">₹10,425.60</TableCell>
                                <TableCell className="text-green-600">+0.34%</TableCell>
                                <TableCell>8.68%</TableCell>
                                <TableCell>₹125 Cr</TableCell>
                                <TableCell><Badge>A+</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">NCDEX Soybean</div>
                                    <div className="text-xs text-muted-foreground">NCDXAGRI003</div>
                                  </div>
                                </TableCell>
                                <TableCell><Badge className="bg-green-100 text-green-800">NCDEX</Badge></TableCell>
                                <TableCell className="font-medium">₹1,03,250.90</TableCell>
                                <TableCell className="text-green-600">+0.15%</TableCell>
                                <TableCell>7.95%</TableCell>
                                <TableCell>₹275 Cr</TableCell>
                                <TableCell><Badge>AA+</Badge></TableCell>
                                <TableCell><Button size="sm">Trade</Button></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Additional Features */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Multi-Exchange Bond Features</h4>
                            <p className="text-sm text-muted-foreground">
                              Complete coverage: NSE/BSE (Traditional), MCX (Commodity), NCDEX (Agricultural), MSEI (SME & Specialized)
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline">
                              <Download className="w-4 h-4 mr-2" />
                              Export All Exchange Data
                            </Button>
                            <Button>
                              <Eye className="w-4 h-4 mr-2" />
                              View Complete Portfolio
                            </Button>
                          </div>
                        </div>
                        
                        {/* Exchange Specialization Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 p-3 bg-muted/30 rounded-lg">
                          <div className="text-center">
                            <Badge className="bg-blue-100 text-blue-800 mb-1">NSE</Badge>
                            <div className="text-xs text-muted-foreground">Government & Large Corp</div>
                          </div>
                          <div className="text-center">
                            <Badge className="bg-orange-100 text-orange-800 mb-1">BSE</Badge>
                            <div className="text-xs text-muted-foreground">Tax-Free & Corporate</div>
                          </div>
                          <div className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-800 mb-1">MCX</Badge>
                            <div className="text-xs text-muted-foreground">Commodity-Linked</div>
                          </div>
                          <div className="text-center">
                            <Badge className="bg-green-100 text-green-800 mb-1">NCDEX</Badge>
                            <div className="text-xs text-muted-foreground">Agricultural Bonds</div>
                          </div>
                          <div className="text-center">
                            <Badge className="bg-purple-100 text-purple-800 mb-1">MSEI</Badge>
                            <div className="text-xs text-muted-foreground">Green & Tech Bonds</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Government Bonds */}
              <TabsContent value="government" className="space-y-4">
                <Card data-testid="card-government-bonds">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      Government Securities & Treasury Bills
                    </CardTitle>
                    <CardDescription>Risk-free government-backed bonds with guaranteed returns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">7.17% GS 2028</h3>
                            <Badge className="bg-blue-100 text-blue-800">AAA</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Coupon Rate:</span>
                              <span className="font-medium">7.17%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Yield:</span>
                              <span className="font-medium text-green-600">7.05%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>YTM:</span>
                              <span className="font-medium">7.12%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Maturity:</span>
                              <span className="font-medium">Jan 2028</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹10,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>

                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">6.54% GS 2032</h3>
                            <Badge className="bg-blue-100 text-blue-800">AAA</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Coupon Rate:</span>
                              <span className="font-medium">6.54%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Yield:</span>
                              <span className="font-medium text-green-600">6.48%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>YTM:</span>
                              <span className="font-medium">6.52%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Maturity:</span>
                              <span className="font-medium">Jan 2032</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹10,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>

                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">91 Day T-Bill</h3>
                            <Badge className="bg-green-100 text-green-800">Treasury</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Discount Rate:</span>
                              <span className="font-medium">6.95%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Current Price:</span>
                              <span className="font-medium">₹98.23</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Face Value:</span>
                              <span className="font-medium">₹100</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Maturity:</span>
                              <span className="font-medium">Apr 2025</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹25,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Why Government Bonds?</h4>
                            <p className="text-sm text-muted-foreground">Sovereign guarantee, zero credit risk, and stable returns</p>
                          </div>
                          <Button variant="outline">
                            <Shield className="w-4 h-4 mr-2" />
                            Learn More
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Corporate Bonds */}
              <TabsContent value="corporate" className="space-y-4">
                <Card data-testid="card-corporate-bonds">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      Corporate Bonds & Debentures
                    </CardTitle>
                    <CardDescription>Higher yields from creditworthy corporations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">HDFC Bank 8.25% 2027</h3>
                            <Badge className="bg-purple-100 text-purple-800">AAA</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Sector:</span>
                              <span className="font-medium">Banking</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coupon Rate:</span>
                              <span className="font-medium">8.25%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>YTM:</span>
                              <span className="font-medium text-green-600">8.18%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Duration:</span>
                              <span className="font-medium">2.8 years</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹1,00,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>

                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Reliance 7.95% 2030</h3>
                            <Badge className="bg-purple-100 text-purple-800">AAA</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Sector:</span>
                              <span className="font-medium">Energy</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coupon Rate:</span>
                              <span className="font-medium">7.95%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>YTM:</span>
                              <span className="font-medium text-green-600">7.91%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Duration:</span>
                              <span className="font-medium">5.1 years</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹1,00,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>

                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">TCS 7.50% 2029</h3>
                            <Badge className="bg-purple-100 text-purple-800">AAA</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Sector:</span>
                              <span className="font-medium">IT Services</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Coupon Rate:</span>
                              <span className="font-medium">7.50%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>YTM:</span>
                              <span className="font-medium text-green-600">7.46%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Duration:</span>
                              <span className="font-medium">4.6 years</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹1,00,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Corporate Bond Benefits</h4>
                            <p className="text-sm text-muted-foreground">Higher yields, diversification, and quality credit ratings</p>
                          </div>
                          <Button variant="outline">
                            <Building2 className="w-4 h-4 mr-2" />
                            View All Bonds
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tax-Free Bonds */}
              <TabsContent value="tax-free" className="space-y-4">
                <Card data-testid="card-tax-free-bonds">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-600" />
                      Tax-Free Bonds
                    </CardTitle>
                    <CardDescription>Tax-exempt interest income with long-term stability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-5 h-5 text-green-600" />
                          <h4 className="font-semibold text-green-900">Tax Benefits</h4>
                        </div>
                        <p className="text-sm text-green-700">
                          Interest earned from tax-free bonds is completely exempt from income tax under Section 10(15)(iv) of the Income Tax Act.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">NHAI 7.35% 2035</h3>
                            <Badge className="bg-green-100 text-green-800">Tax-Free</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Sector:</span>
                              <span className="font-medium">Infrastructure</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax-Free Yield:</span>
                              <span className="font-medium text-green-600">7.35%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Equivalent Taxable:</span>
                              <span className="font-medium">10.21%*</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Maturity:</span>
                              <span className="font-medium">Feb 2035</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹1,00,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>

                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">IRFC 7.30% 2034</h3>
                            <Badge className="bg-green-100 text-green-800">Tax-Free</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Sector:</span>
                              <span className="font-medium">Railways</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax-Free Yield:</span>
                              <span className="font-medium text-green-600">7.30%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Equivalent Taxable:</span>
                              <span className="font-medium">10.14%*</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Maturity:</span>
                              <span className="font-medium">Dec 2034</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Min Investment:</span>
                              <span className="font-medium">₹1,00,000</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full mt-3">Invest Now</Button>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2">Tax-Free Bond Calculator</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium">Investment Amount</label>
                            <Input placeholder="₹1,00,000" className="mt-1" />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Tax Bracket</label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="30%" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="20">20%</SelectItem>
                                <SelectItem value="30">30%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Calculate</label>
                            <Button className="w-full mt-1">
                              <Calculator className="w-4 h-4 mr-2" />
                              Calculate
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-blue-700 mt-2">
                          * Equivalent taxable yield calculated at 28% tax bracket
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bond Analytics */}
              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-yield-curve">
                    <CardHeader>
                      <CardTitle>Government Bond Yield Curve</CardTitle>
                      <CardDescription>Interest rates across different maturities</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-6 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium">1Y</div>
                            <div className="text-green-600">6.85%</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">3Y</div>
                            <div className="text-green-600">7.12%</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">5Y</div>
                            <div className="text-green-600">7.35%</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">10Y</div>
                            <div className="text-green-600">7.58%</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">15Y</div>
                            <div className="text-green-600">7.72%</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">20Y</div>
                            <div className="text-green-600">7.85%</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Curve Shape</span>
                            <span className="text-green-600">Normal (Upward)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Steepness</span>
                            <span className="text-blue-600">Moderate</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-sector-allocation">
                    <CardHeader>
                      <CardTitle>Bond Market Allocation</CardTitle>
                      <CardDescription>Distribution by bond categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Government</span>
                            </div>
                            <span className="font-medium">45% (₹20.56L Cr)</span>
                          </div>
                          <Progress value={45} className="h-2" />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                              <span>Banking</span>
                            </div>
                            <span className="font-medium">25% (₹11.42L Cr)</span>
                          </div>
                          <Progress value={25} className="h-2" />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Infrastructure</span>
                            </div>
                            <span className="font-medium">15% (₹6.85L Cr)</span>
                          </div>
                          <Progress value={15} className="h-2" />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                              <span>Corporate</span>
                            </div>
                            <span className="font-medium">15% (₹6.85L Cr)</span>
                          </div>
                          <Progress value={15} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>


          <TabsContent value="aif" className="space-y-6">
            {/* AIF Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card data-testid="card-aif-overview">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" />
                    Alternative Investment Funds
                  </CardTitle>
                  <CardDescription>SEBI regulated high-return investment vehicles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Category I AIF</span>
                      <Badge className="bg-green-100 text-green-800">Available</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Category II AIF</span>
                      <Badge className="bg-blue-100 text-blue-800">Available</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Category III AIF</span>
                      <Badge className="bg-purple-100 text-purple-800">Available</Badge>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total AIF Portfolio</span>
                      <span className="text-lg font-bold text-indigo-600">₹10,000 Cr</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Across 10 funds in 5 exchanges
                    </div>
                  </div>
                  <Button className="w-full" data-testid="button-explore-aif">
                    <Target className="w-4 h-4 mr-2" />
                    Explore AIF Options
                  </Button>
                </CardContent>
              </Card>

              {/* AIF Categories */}
              <Card data-testid="card-aif-categories">
                <CardHeader>
                  <CardTitle>AIF Categories</CardTitle>
                  <CardDescription>Different types for diverse strategies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Category I - Social Venture
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Infrastructure, SME, social venture funds
                    </div>
                    <div className="text-xs text-green-600 mt-1">Tax benefits available</div>
                  </div>
                  <div className="p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Category II - Private Equity
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      PE, VC, debt funds, funds of funds
                    </div>
                    <div className="text-xs text-blue-600 mt-1">No specific incentives</div>
                  </div>
                  <div className="p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      Category III - Hedge Funds
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Complex strategies, derivatives trading
                    </div>
                    <div className="text-xs text-purple-600 mt-1">Higher risk, higher returns</div>
                  </div>
                </CardContent>
              </Card>

              {/* Investment Performance */}
              <Card data-testid="card-aif-performance">
                <CardHeader>
                  <CardTitle>Performance Highlights</CardTitle>
                  <CardDescription>Track record of AIF investments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Average 1Y Return</span>
                      <span className="text-lg font-bold text-green-600">17.2%</span>
                    </div>
                    <Progress value={85} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      Across 10 multi-exchange funds
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total AUM</span>
                      <span className="text-lg font-bold text-blue-600">₹10,000 Cr</span>
                    </div>
                    <Progress value={90} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      Combined portfolio across 5 exchanges
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Top Performer</span>
                      <span className="text-lg font-bold text-purple-600">25.8%</span>
                    </div>
                    <Progress value={95} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      BSE SME Growth Fund (1Y)
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="font-medium text-yellow-900">Key Benefits</div>
                    <div className="text-sm text-yellow-700 mt-1">
                      • Portfolio diversification<br/>
                      • Professional fund management<br/>
                      • Access to unique strategies<br/>
                      • Potential for higher returns
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* NSDL/CDSL Depository Services */}
            <Card data-testid="card-depository-services">
              <CardHeader>
                <CardTitle>NSDL & CDSL Depository Services</CardTitle>
                <CardDescription>Comprehensive capital gains reports and holdings data from both depositories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Search Interface */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Capital Gains Search</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">PAN Number</label>
                          <input 
                            type="text" 
                            placeholder="Enter PAN Number"
                            className="w-full p-2 border rounded-md"
                            data-testid="input-pan-number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm font-medium">From Date</label>
                            <input 
                              type="date" 
                              className="w-full p-2 border rounded-md"
                              data-testid="input-from-date"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">To Date</label>
                            <input 
                              type="date" 
                              className="w-full p-2 border rounded-md"
                              data-testid="input-to-date"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">ISIN (Optional)</label>
                          <input 
                            type="text" 
                            placeholder="Enter ISIN code"
                            className="w-full p-2 border rounded-md"
                            data-testid="input-isin-code"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" data-testid="button-search-nsdl">
                            <Search className="w-4 h-4 mr-2" />
                            Search NSDL
                          </Button>
                          <Button variant="outline" className="flex-1" data-testid="button-search-cdsl">
                            <Search className="w-4 h-4 mr-2" />
                            Search CDSL
                          </Button>
                        </div>
                        <Button variant="secondary" className="w-full" data-testid="button-combined-search">
                          <FileSearch className="w-4 h-4 mr-2" />
                          Combined NSDL + CDSL Search
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Holdings Overview</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600 font-medium">NSDL Holdings</div>
                          <div className="text-xl font-bold text-blue-800">₹20,45,000</div>
                          <div className="text-xs text-blue-600">3 Securities</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <div className="text-sm text-orange-600 font-medium">CDSL Holdings</div>
                          <div className="text-xl font-bold text-orange-800">₹15,63,600</div>
                          <div className="text-xs text-orange-600">3 Securities</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-600 font-medium">Total Unrealized</div>
                          <div className="text-xl font-bold text-green-800">₹80,822</div>
                          <div className="text-xs text-green-600">4.14% Gain</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <div className="text-sm text-purple-600 font-medium">Realized Gains</div>
                          <div className="text-xl font-bold text-purple-800">₹81,255</div>
                          <div className="text-xs text-purple-600">FY 2024-25</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Tax Liability (LTCG)</span>
                          <span className="font-bold text-red-600">₹11,289</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Tax Liability (STCG)</span>
                          <span className="font-bold text-red-600">₹7,937</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Net Gain After Tax</span>
                          <span className="font-bold text-green-600">₹62,029</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Access Features */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Quick Access Features</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button variant="outline" size="sm" className="flex flex-col h-16" data-testid="button-holdings-statement">
                        <FileText className="w-4 h-4 mb-1" />
                        <span className="text-xs">Holdings Statement</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-16" data-testid="button-transaction-history">
                        <History className="w-4 h-4 mb-1" />
                        <span className="text-xs">Transaction History</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-16" data-testid="button-capital-gains-report">
                        <TrendingUp className="w-4 h-4 mb-1" />
                        <span className="text-xs">Capital Gains Report</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-16" data-testid="button-tax-summary">
                        <Calculator className="w-4 h-4 mb-1" />
                        <span className="text-xs">Tax Summary</span>
                      </Button>
                    </div>
                  </div>

                  {/* Recent Transactions Preview */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Recent Capital Gains Transactions</h3>
                      <Button variant="ghost" size="sm" data-testid="button-view-all-transactions">
                        View All <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-100 text-blue-800">NSDL</Badge>
                          <div>
                            <div className="font-medium">RELIANCE</div>
                            <div className="text-sm text-muted-foreground">Sold 100 shares • Aug 20, 2024</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">₹15,837</div>
                          <div className="text-xs text-muted-foreground">LTCG</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-orange-100 text-orange-800">CDSL</Badge>
                          <div>
                            <div className="font-medium">ASIANPAINT</div>
                            <div className="text-sm text-muted-foreground">Sold 150 shares • Jul 15, 2024</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">₹28,278</div>
                          <div className="text-xs text-muted-foreground">LTCG</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-100 text-blue-800">NSDL</Badge>
                          <div>
                            <div className="font-medium">INFY</div>
                            <div className="text-sm text-muted-foreground">Sold 200 shares • Sep 25, 2024</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">₹26,744</div>
                          <div className="text-xs text-muted-foreground">STCG</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export & Compliance Features */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Export & Compliance</h4>
                        <p className="text-sm text-muted-foreground">
                          Download reports for tax filing and regulatory compliance
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" data-testid="button-export-excel">
                          <Download className="w-4 h-4 mr-2" />
                          Export Excel
                        </Button>
                        <Button data-testid="button-generate-itr-report">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          ITR Report
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Multi-Exchange AIF Funds */}
            <Card data-testid="card-available-aif-funds">
              <CardHeader>
                <CardTitle>Multi-Exchange AIF Portfolio</CardTitle>
                <CardDescription>Complete AIF coverage across NSE, BSE, MCX, NCDEX & MSEI exchanges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Exchange & Category Filters */}
                  <div className="flex flex-wrap gap-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-100 text-blue-800">NSE - Multi Sector & Infrastructure</Badge>
                      <Badge className="bg-orange-100 text-orange-800">BSE - SME Growth & Debt</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800">MCX - Commodity & Energy</Badge>
                      <Badge className="bg-green-100 text-green-800">NCDEX - AgriTech & Rural</Badge>
                      <Badge className="bg-purple-100 text-purple-800">MSEI - Innovation & Healthcare</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total AUM: <span className="font-semibold">₹10,000 Cr</span> • Average Return: <span className="font-semibold text-green-600">17.2%</span>
                    </div>
                  </div>

                  {/* Top Multi-Exchange AIF Funds Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* NSE Funds */}
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">NSE Large Cap AIF</h3>
                          <div className="text-xs text-muted-foreground">Private Equity Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-blue-100 text-blue-800 mb-1">NSE</Badge>
                          <div className="text-xs">Cat II</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹125.45</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹2,450 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">18.5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">3 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">NSE Infrastructure</h3>
                          <div className="text-xs text-muted-foreground">Infrastructure Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-blue-100 text-blue-800 mb-1">NSE</Badge>
                          <div className="text-xs">Cat I</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹98.75</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹1,850 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">15.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">5 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    {/* BSE Funds */}
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">BSE SME Growth</h3>
                          <div className="text-xs text-muted-foreground">Private Equity Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-orange-100 text-orange-800 mb-1">BSE</Badge>
                          <div className="text-xs">Cat II</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹142.30</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹1,650 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">25.8%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">4 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">BSE Debt Plus</h3>
                          <div className="text-xs text-muted-foreground">Hedge Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-orange-100 text-orange-800 mb-1">BSE</Badge>
                          <div className="text-xs">Cat III</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹111.85</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹980 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">12.4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">1 Year</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    {/* MCX Funds */}
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">MCX Commodity Alpha</h3>
                          <div className="text-xs text-muted-foreground">Hedge Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-yellow-100 text-yellow-800 mb-1">MCX</Badge>
                          <div className="text-xs">Cat III</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹108.92</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹750 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">16.8%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">2 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">MCX Energy Transition</h3>
                          <div className="text-xs text-muted-foreground">Social Venture Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-yellow-100 text-yellow-800 mb-1">MCX</Badge>
                          <div className="text-xs">Cat I</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹95.67</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹420 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">11.3%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">7 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    {/* NCDEX Funds */}
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">NCDEX AgriTech</h3>
                          <div className="text-xs text-muted-foreground">Venture Capital Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-800 mb-1">NCDEX</Badge>
                          <div className="text-xs">Cat I</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹118.45</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹580 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">14.7%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">5 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">NCDEX Rural Dev</h3>
                          <div className="text-xs text-muted-foreground">Social Venture Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-800 mb-1">NCDEX</Badge>
                          <div className="text-xs">Cat I</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹106.23</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹390 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">9.8%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">6 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    {/* MSEI Funds */}
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">MSEI Startup</h3>
                          <div className="text-xs text-muted-foreground">Venture Capital Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-purple-100 text-purple-800 mb-1">MSEI</Badge>
                          <div className="text-xs">Cat I</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹89.34</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹280 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">8.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">8 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">MSEI Healthcare</h3>
                          <div className="text-xs text-muted-foreground">Private Equity Fund</div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-purple-100 text-purple-800 mb-1">MSEI</Badge>
                          <div className="text-xs">Cat II</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>NAV:</span>
                          <span className="font-medium">₹134.78</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AUM:</span>
                          <span className="font-medium">₹650 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1Y Return:</span>
                          <span className="font-medium text-green-600">22.1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in:</span>
                          <span className="font-medium">4 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Multi-Exchange AIF Investment Platform</h4>
                        <p className="text-sm text-muted-foreground">
                          Complete coverage across NSE, BSE, MCX, NCDEX & MSEI with SEBI-regulated professional management
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" data-testid="button-export-aif">
                          <Download className="w-4 h-4 mr-2" />
                          Export Portfolio
                        </Button>
                        <Button data-testid="button-schedule-consultation">
                          <Users className="w-4 h-4 mr-2" />
                          Schedule Consultation
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mutual Funds Tab */}
          <TabsContent value="mutual-funds" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Overview Cards */}
              <div className="lg:col-span-3 space-y-6">
                {/* Top Performing Funds */}
                <Card data-testid="card-top-mutual-funds">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-primary" />
                      Top Performing Mutual Funds
                      {(isMutualFundsLoading || isPopularLoading) && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      )}
                    </CardTitle>
                    <CardDescription>
                      AMFI-integrated mutual fund platform with real-time NAV tracking
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <span className="animate-pulse">●</span>
                          Live updates every 30s
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Last updated: {lastUpdate.toLocaleTimeString()}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {mutualFunds.length} live funds
                        </span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Render real-time fund data */}
                      {enhancedFunds.map((fund) => {
                        // Merge with live API data if available
                        const liveData = mutualFunds.find(mf => mf.schemeCode === fund.schemeCode);
                        const displayFund = liveData ? { ...fund, nav: liveData.nav, lastUpdated: liveData.lastUpdated } : fund;
                        
                        return (
                          <div key={fund.schemeCode} className="border rounded-lg p-4 hover:bg-accent cursor-pointer" data-testid={`fund-${fund.schemeCode}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">{displayFund.schemeName}</h3>
                                <div className="text-xs text-muted-foreground">{displayFund.category}</div>
                              </div>
                              <div className="text-right">
                                <Badge className={
                                  displayFund.rating === 5 ? "bg-green-100 text-green-800 mb-1" : 
                                  displayFund.rating === 4 ? "bg-blue-100 text-blue-800 mb-1" : 
                                  "bg-gray-100 text-gray-800 mb-1"
                                }>
                                  {"★".repeat(displayFund.rating || 4)}
                                </Badge>
                                <div className="text-xs">{displayFund.riskLevel}</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>NAV:</span>
                                <span className="font-medium">
                                  ₹{displayFund.nav}
                                  {liveData && (
                                    <span className="ml-1 text-xs text-green-600 animate-pulse">●</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>1Y Return:</span>
                                <span className="font-medium text-green-600">{displayFund.returns1Y}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>AUM:</span>
                                <span className="font-medium">{displayFund.aum}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Expense Ratio:</span>
                                <span className="font-medium">{displayFund.expenseRatio}</span>
                              </div>
                              {displayFund.lastUpdated && (
                                <div className="flex justify-between">
                                  <span>Updated:</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(displayFund.lastUpdated).toLocaleTimeString()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button size="sm" className="w-full mt-3" data-testid={`button-invest-${fund.schemeCode}`}>
                              <Plus className="w-4 h-4 mr-2" />
                              Start SIP
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Loading state when no funds are available */}
                    {isMutualFundsLoading && enhancedFunds.length === 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="border rounded-lg p-4 animate-pulse">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-24"></div>
                              </div>
                              <div className="h-6 bg-gray-200 rounded w-12"></div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-gray-200 rounded"></div>
                              <div className="h-3 bg-gray-200 rounded"></div>
                              <div className="h-3 bg-gray-200 rounded"></div>
                            </div>
                            <div className="h-8 bg-gray-200 rounded mt-3"></div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error state */}
                    {mutualFundsError && (
                      <div className="border rounded-lg p-6 text-center">
                        <div className="text-muted-foreground mb-2">
                          Unable to fetch live data. Showing cached information.
                        </div>
                        <div className="text-xs text-orange-600">
                          Next update attempt in 30 seconds...
                        </div>
                      </div>
                    )}

                    {/* Fund Categories */}
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-semibold">Fund Categories</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-3 border rounded-lg hover:bg-accent cursor-pointer" data-testid="category-large-cap">
                          <PieChart className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                          <div className="font-medium text-sm">Large Cap</div>
                          <div className="text-xs text-muted-foreground">45 funds</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg hover:bg-accent cursor-pointer" data-testid="category-mid-cap">
                          <BarChart3 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                          <div className="font-medium text-sm">Mid Cap</div>
                          <div className="text-xs text-muted-foreground">32 funds</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg hover:bg-accent cursor-pointer" data-testid="category-small-cap">
                          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                          <div className="font-medium text-sm">Small Cap</div>
                          <div className="text-xs text-muted-foreground">28 funds</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg hover:bg-accent cursor-pointer" data-testid="category-sectoral">
                          <Factory className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                          <div className="font-medium text-sm">Sectoral</div>
                          <div className="text-xs text-muted-foreground">24 funds</div>
                        </div>
                      </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="border-t pt-4">
                      <div className="flex gap-4 mb-4">
                        <Input 
                          placeholder="Search mutual funds..." 
                          className="flex-1" 
                          data-testid="input-search-mutual-funds" 
                        />
                        <Select>
                          <SelectTrigger className="w-40" data-testid="select-fund-category">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="large-cap">Large Cap</SelectItem>
                            <SelectItem value="mid-cap">Mid Cap</SelectItem>
                            <SelectItem value="small-cap">Small Cap</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                            <SelectItem value="debt">Debt</SelectItem>
                            <SelectItem value="sectoral">Sectoral</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select>
                          <SelectTrigger className="w-32" data-testid="select-fund-amc">
                            <SelectValue placeholder="AMC" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sbi">SBI MF</SelectItem>
                            <SelectItem value="hdfc">HDFC MF</SelectItem>
                            <SelectItem value="icici">ICICI MF</SelectItem>
                            <SelectItem value="axis">Axis MF</SelectItem>
                            <SelectItem value="mirae">Mirae Asset</SelectItem>
                            <SelectItem value="dsp">DSP MF</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" data-testid="button-search-funds">
                          <Search className="w-4 h-4 mr-2" />
                          Search
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SIP Calculator & Quick Actions */}
              <div className="space-y-6">
                {/* SIP Calculator */}
                <Card data-testid="card-sip-calculator">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      SIP Calculator
                    </CardTitle>
                    <CardDescription>Plan your investments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Monthly Investment</label>
                      <Input 
                        type="number" 
                        placeholder="₹5,000" 
                        defaultValue="5000"
                        data-testid="input-sip-amount" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Investment Period</label>
                      <Select>
                        <SelectTrigger data-testid="select-sip-period">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Year</SelectItem>
                          <SelectItem value="3">3 Years</SelectItem>
                          <SelectItem value="5">5 Years</SelectItem>
                          <SelectItem value="10">10 Years</SelectItem>
                          <SelectItem value="15">15 Years</SelectItem>
                          <SelectItem value="20">20 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Expected Return (%)</label>
                      <Input 
                        type="number" 
                        placeholder="12" 
                        defaultValue="12"
                        data-testid="input-expected-return" 
                      />
                    </div>
                    <Button className="w-full" data-testid="button-calculate-sip">
                      <Calculator className="w-4 h-4 mr-2" />
                      Calculate
                    </Button>
                    <div className="border rounded-lg p-3 bg-accent/50">
                      <div className="text-sm text-muted-foreground">Expected Maturity Value</div>
                      <div className="text-xl font-bold text-green-600" data-testid="text-maturity-value">₹11,61,695</div>
                      <div className="text-xs text-muted-foreground">Total Investment: ₹6,00,000</div>
                      <div className="text-xs text-muted-foreground">Capital Gain: ₹5,61,695</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card data-testid="card-mutual-fund-actions">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full" variant="outline" data-testid="button-portfolio-xray">
                      <FileSearch className="w-4 h-4 mr-2" />
                      Portfolio X-Ray
                    </Button>
                    <Button className="w-full" variant="outline" data-testid="button-compare-funds">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Compare Funds
                    </Button>
                    <Button className="w-full" variant="outline" data-testid="button-tax-planning">
                      <FileText className="w-4 h-4 mr-2" />
                      Tax Planning
                    </Button>
                    <Button className="w-full" variant="outline" data-testid="button-view-holdings">
                      <History className="w-4 h-4 mr-2" />
                      View Holdings
                    </Button>
                    <Button className="w-full" data-testid="button-explore-all-funds">
                      <ChevronRight className="w-4 h-4 mr-2" />
                      Explore All Funds
                    </Button>
                  </CardContent>
                </Card>

                {/* AMFI Integration Info */}
                <Card data-testid="card-amfi-integration">
                  <CardHeader>
                    <CardTitle className="text-sm">AMFI Integration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Total Funds:</span>
                        <span className="font-medium">6 flagship funds</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg. 1Y Returns:</span>
                        <span className="font-medium text-green-600">+22.32%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Combined AUM:</span>
                        <span className="font-medium">₹1,87,979 Cr</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Updated:</span>
                        <span className="font-medium">Jan 27, 2025</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Newsletter Tab */}
          <TabsContent value="newsletter" className="space-y-6">
            <MarketNewsletter />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// AIF Funds Section Component
function AIFFundsSection() {
  const [selectedAMC, setSelectedAMC] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRiskRating, setSelectedRiskRating] = useState("all");

  const { data: aifData, isLoading } = useQuery({
    queryKey: ["/api/aif/comprehensive", selectedAMC, selectedCategory, selectedRiskRating],
    queryFn: async () => {
      const params = new URLSearchParams({
        amc: selectedAMC,
        category: selectedCategory,
        riskRating: selectedRiskRating
      });
      const response = await fetch(`/api/aif/comprehensive?${params}`);
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Loading AIF Funds Data...</h3>
          <p className="text-muted-foreground">Fetching comprehensive fund details from all AMCs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AIF Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-aif-total-funds">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total AIF Funds</p>
                <p className="text-2xl font-bold">{aifData?.statistics?.totalFunds || 0}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex items-center mt-2">
              <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">Across all AMCs</span>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-aif-total-aum">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total AUM</p>
                <p className="text-2xl font-bold">₹{((aifData?.statistics?.totalAUM || 0) / 10000000000).toFixed(0)} Cr</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">Growing steadily</span>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-aif-avg-returns">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg 1Y Returns</p>
                <p className="text-2xl font-bold">{aifData?.statistics?.averageReturns?.["1Y"] || 0}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="flex items-center mt-2">
              <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">Strong performance</span>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-aif-amcs">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active AMCs</p>
                <p className="text-2xl font-bold">6</p>
              </div>
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
            <div className="flex items-center mt-2">
              <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">SEBI Registered</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card data-testid="card-aif-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter AIF Funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset Management Company</label>
              <Select value={selectedAMC} onValueChange={setSelectedAMC}>
                <SelectTrigger data-testid="select-aif-amc">
                  <SelectValue placeholder="Select AMC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AMCs</SelectItem>
                  <SelectItem value="kotak">Kotak Mahindra</SelectItem>
                  <SelectItem value="icici">ICICI Prudential</SelectItem>
                  <SelectItem value="aditya">Aditya Birla Sun Life</SelectItem>
                  <SelectItem value="dsp">DSP Asset Managers</SelectItem>
                  <SelectItem value="nippon">Nippon India</SelectItem>
                  <SelectItem value="uti">UTI Asset Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">AIF Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-aif-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Category I">Category I</SelectItem>
                  <SelectItem value="Category II">Category II</SelectItem>
                  <SelectItem value="Category III">Category III</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Risk Rating</label>
              <Select value={selectedRiskRating} onValueChange={setSelectedRiskRating}>
                <SelectTrigger data-testid="select-aif-risk-rating">
                  <SelectValue placeholder="Select Risk Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Very High">Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AIF Funds Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aifData?.data?.map((fund: any) => (
          <Card key={fund.id} data-testid={`card-aif-fund-${fund.id}`} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{fund.fundName}</CardTitle>
                  <CardDescription className="mt-1">
                    {fund.amcName} • {fund.exchange}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{fund.category}</Badge>
                    <Badge variant="secondary">{fund.subCategory}</Badge>
                    <Badge variant={fund.riskRating.includes('High') ? 'destructive' : 'default'}>
                      {fund.riskRating}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">ISIN</div>
                  <div className="text-sm font-mono">{fund.isinNumber}</div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">NAV</div>
                  <div className="text-lg font-semibold">₹{fund.nav?.toLocaleString() || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">AUM</div>
                  <div className="text-lg font-semibold">₹{fund.aum ? (fund.aum / 10000000000).toFixed(0) + ' Cr' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Min Investment</div>
                  <div className="text-lg font-semibold">₹{fund.minimumInvestment ? (fund.minimumInvestment / 10000000).toFixed(0) + ' Cr' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Lock-in Period</div>
                  <div className="text-lg font-semibold">{fund.lockInPeriod || 'N/A'}</div>
                </div>
              </div>

              {/* Performance Returns */}
              {(fund.returns1y || fund.returns3y || fund.returns5y) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Performance Returns</div>
                  <div className="grid grid-cols-3 gap-2">
                    {fund.returns1y && (
                      <div className="text-center p-2 bg-accent/50 rounded">
                        <div className="text-xs text-muted-foreground">1Y</div>
                        <div className="font-semibold text-green-600">+{fund.returns1y}%</div>
                      </div>
                    )}
                    {fund.returns3y && (
                      <div className="text-center p-2 bg-accent/50 rounded">
                        <div className="text-xs text-muted-foreground">3Y</div>
                        <div className="font-semibold text-green-600">+{fund.returns3y}%</div>
                      </div>
                    )}
                    {fund.returns5y && (
                      <div className="text-center p-2 bg-accent/50 rounded">
                        <div className="text-xs text-muted-foreground">5Y</div>
                        <div className="font-semibold text-green-600">+{fund.returns5y}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fund Manager Details */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Fund Manager</div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{fund.fundManager}</span>
                  <span className="text-sm text-muted-foreground">({fund.fundManagerExperience}Y exp)</span>
                </div>
                <div className="text-xs text-muted-foreground">{fund.fundManagerQualification}</div>
              </div>

              {/* Investment Strategy */}
              {fund.investmentStrategy && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Investment Strategy</div>
                  <div className="text-sm bg-accent/30 p-3 rounded">
                    {fund.investmentStrategy}
                  </div>
                </div>
              )}

              {/* Stock Selection Process */}
              {fund.stockSelectionProcess && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Stock Selection Process</div>
                  <div className="text-xs bg-blue-50 dark:bg-blue-950/30 p-3 rounded">
                    {fund.stockSelectionProcess}
                  </div>
                </div>
              )}

              {/* Fees Structure */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Management Fee</div>
                  <div className="font-medium">{fund.managementFee}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Performance Fee</div>
                  <div className="font-medium">{fund.performanceFee}%</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" data-testid={`button-invest-${fund.id}`}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Invest Now
                </Button>
                <Button variant="outline" data-testid={`button-details-${fund.id}`}>
                  <Info className="w-4 h-4 mr-2" />
                  Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Statistics */}
      {aifData?.statistics && (
        <Card data-testid="card-aif-summary-stats">
          <CardHeader>
            <CardTitle>Market Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-2">Category Distribution</h4>
                <div className="space-y-1">
                  {Object.entries(aifData.statistics.categoryBreakdown).map(([category, count]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span>{category}:</span>
                      <span className="font-medium">{count as number} funds</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">AMC Distribution</h4>
                <div className="space-y-1">
                  {Object.entries(aifData.statistics.amcBreakdown).map(([amc, count]) => (
                    <div key={amc} className="flex justify-between text-sm">
                      <span>{amc}:</span>
                      <span className="font-medium">{count as number} funds</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Average Returns</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>1 Year:</span>
                    <span className="font-medium text-green-600">+{aifData.statistics.averageReturns["1Y"]}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>3 Years:</span>
                    <span className="font-medium text-green-600">+{aifData.statistics.averageReturns["3Y"]}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>5 Years:</span>
                    <span className="font-medium text-green-600">+{aifData.statistics.averageReturns["5Y"]}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}