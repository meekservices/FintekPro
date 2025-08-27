import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
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
  Factory
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MarketNewsletter } from "@/components/wealth/market-newsletter";

export default function WealthManagement() {
  const [activeTab, setActiveTab] = useState("overview");

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
            <TabsTrigger value="aif" data-testid="tab-aif">AIF</TabsTrigger>
            <TabsTrigger value="debentures" data-testid="tab-debentures">Debentures</TabsTrigger>
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

          <TabsContent value="debentures" className="space-y-6">
            <Card>
              <CardContent className="p-12 text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Market Linked Debentures</h3>
                <p className="text-muted-foreground">Debenture investments coming soon...</p>
              </CardContent>
            </Card>
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
                  <div className="border rounded-lg p-3 bg-indigo-50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Minimum Investment</span>
                      <span className="text-lg font-bold">₹1 Crore</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      For qualified investors only
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
                      <span className="font-medium">Average IRR</span>
                      <span className="text-lg font-bold text-green-600">18.5%</span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      Based on 3-year average returns
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Fund Size</span>
                      <span className="text-lg font-bold text-blue-600">₹2,456 Cr</span>
                    </div>
                    <Progress value={60} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      Total AUM across all categories
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

            {/* Available AIF Funds */}
            <Card data-testid="card-available-aif-funds">
              <CardHeader>
                <CardTitle>Available AIF Funds</CardTitle>
                <CardDescription>Curated selection of top-performing Alternative Investment Funds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">IndiaCorp Growth Fund</h3>
                        <Badge className="bg-green-100 text-green-800">Cat II</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Fund Size:</span>
                          <span className="font-medium">₹450 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Investment:</span>
                          <span className="font-medium">₹1 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>3Y IRR:</span>
                          <span className="font-medium text-green-600">22.4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in Period:</span>
                          <span className="font-medium">3 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Tech Innovation Fund</h3>
                        <Badge className="bg-blue-100 text-blue-800">Cat II</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Fund Size:</span>
                          <span className="font-medium">₹275 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Investment:</span>
                          <span className="font-medium">₹1 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>3Y IRR:</span>
                          <span className="font-medium text-green-600">19.8%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in Period:</span>
                          <span className="font-medium">5 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>

                    <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Infrastructure Debt Fund</h3>
                        <Badge className="bg-green-100 text-green-800">Cat I</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Fund Size:</span>
                          <span className="font-medium">₹680 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Investment:</span>
                          <span className="font-medium">₹1 Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span>3Y IRR:</span>
                          <span className="font-medium text-green-600">16.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lock-in Period:</span>
                          <span className="font-medium">7 Years</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full mt-3">View Details</Button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Ready to invest in AIF?</h4>
                        <p className="text-sm text-muted-foreground">Schedule a consultation with our investment advisors</p>
                      </div>
                      <Button data-testid="button-schedule-consultation">
                        <Users className="w-4 h-4 mr-2" />
                        Schedule Consultation
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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