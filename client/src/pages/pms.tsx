import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  IndianRupee, 
  TrendingUp, 
  ArrowUpRight, 
  Search, 
  BarChart3,
  PieChart,
  Clock,
  Shield,
  Award,
  Target,
  Zap,
  Star,
  ChevronRight,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface PmsScheme {
  id: string;
  name: string;
  registrationNo: string | null;
  strategy: string | null;
  style: string | null;
  fundHouseName: string | null;
  minInvestment: string | null;
  minSIPInvestment: string | null;
  lockIn: string | null;
  benchmark: string | null;
  fundStatus: string | null;
  aum: string | null;
  return1M: string | null;
  return3M: string | null;
  return6M: string | null;
  return1Y: string | null;
  return3Y: string | null;
  return5Y: string | null;
  volatility: string | null;
  maxDrawdown: string | null;
  sharpeRatio: string | null;
  riskScore: number | null;
  isPublished: boolean;
  manager?: {
    name: string;
    experienceYears: number | null;
  } | null;
}

const PMS_STRATEGIES = [
  { value: "all", label: "All Strategies" },
  { value: "Multicap", label: "Multicap" },
  { value: "Large Cap", label: "Large Cap" },
  { value: "Mid Cap", label: "Mid Cap" },
  { value: "Small Cap", label: "Small Cap" },
  { value: "Flexi Cap", label: "Flexi Cap" },
  { value: "Value", label: "Value" },
  { value: "Growth", label: "Growth" },
  { value: "Thematic", label: "Thematic" },
  { value: "Momentum", label: "Momentum" },
  { value: "Quality", label: "Quality" },
];

const PMS_STYLES = [
  { value: "all", label: "All Styles" },
  { value: "Discretionary", label: "Discretionary" },
  { value: "Non-discretionary", label: "Non-discretionary" },
  { value: "Advisory", label: "Advisory" },
];

function formatCurrency(value: string | number | null): string {
  if (!value) return "N/A";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatPercent(value: string | null): string {
  if (!value) return "N/A";
  const num = parseFloat(value);
  if (isNaN(num)) return "N/A";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function getReturnColor(value: string | null): string {
  if (!value) return "text-gray-500";
  const num = parseFloat(value);
  if (isNaN(num)) return "text-gray-500";
  return num >= 0 ? "text-green-600" : "text-red-600";
}

function getRiskBadge(score: number | null) {
  if (!score) return <Badge variant="outline">N/A</Badge>;
  if (score <= 3) return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
  if (score <= 6) return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
  return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500 text-white">Active</Badge>;
    case "soft_close":
      return <Badge className="bg-yellow-500 text-white">Soft Close</Badge>;
    case "hard_close":
      return <Badge className="bg-red-500 text-white">Hard Close</Badge>;
    case "existing_only":
      return <Badge className="bg-blue-500 text-white">Existing Investors</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

export default function PMS() {
  const [, navigate] = useLocation();
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);

  const [selectedStrategy, setSelectedStrategy] = useState("all");
  const [selectedStyle, setSelectedStyle] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const { data: pmsResponse, isLoading } = useQuery<{ schemes: PmsScheme[]; pagination: any }>({
    queryKey: ["/api/store/pms", { 
      status: selectedStatus,
      strategy: selectedStrategy !== "all" ? selectedStrategy : undefined,
      style: selectedStyle !== "all" ? selectedStyle : undefined,
      search: searchQuery || undefined,
      sortBy
    }],
    refetchInterval: 300000,
  });

  const displayData = pmsResponse?.schemes || [];
  const pagination = pmsResponse?.pagination;
  
  const statistics = {
    totalFunds: pagination?.total || displayData.length,
    totalAUM: displayData.reduce((sum: number, fund) => sum + (parseFloat(fund.aum || "0") || 0), 0),
    averageReturns: {
      "1Y": displayData.length > 0 ? displayData.reduce((sum: number, f) => sum + (parseFloat(f.return1Y || "0") || 0), 0) / displayData.length : 0,
      "3Y": displayData.length > 0 ? displayData.reduce((sum: number, f) => sum + (parseFloat(f.return3Y || "0") || 0), 0) / displayData.length : 0,
      "5Y": displayData.length > 0 ? displayData.reduce((sum: number, f) => sum + (parseFloat(f.return5Y || "0") || 0), 0) / displayData.length : 0,
    },
    activeProviders: new Set(displayData.map(f => f.fundHouseName).filter(Boolean)).size
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="pms-page">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold mb-3">Loading PMS Data...</h3>
              <p className="text-gray-600">Fetching Portfolio Management Services details</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-finance-light" data-testid="pms-page">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8" data-testid="pms-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Briefcase className="w-10 h-10 text-indigo-600" />
                Portfolio Management Services
              </h1>
              <p className="text-gray-600 text-lg max-w-3xl">
                Professionally managed equity portfolios with personalized investment strategies, suitable for HNIs and sophisticated investors.
              </p>
            </div>
            <Badge className="bg-indigo-100 text-indigo-800 px-4 py-2 text-sm">
              Min Investment: ₹50 Lakhs
            </Badge>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="font-medium text-indigo-800">SEBI Registered PMS</p>
                <p className="text-sm text-indigo-700">
                  All listed PMS providers are registered with SEBI. Minimum investment is ₹50 Lakhs as per regulatory requirements.
                  Performance data is audited and verified.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-total-pms-funds">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total PMS Schemes</p>
                  <p className="text-3xl font-bold text-indigo-600">{statistics.totalFunds}</p>
                </div>
                <Briefcase className="w-10 h-10 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-aum">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total AUM</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(statistics.totalAUM)}</p>
                </div>
                <IndianRupee className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-avg-returns">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg 1Y Return</p>
                  <p className={`text-3xl font-bold ${statistics.averageReturns["1Y"] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(statistics.averageReturns["1Y"].toString())}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-active-providers">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Providers</p>
                  <p className="text-3xl font-bold text-purple-600">{statistics.activeProviders}</p>
                </div>
                <Building2 className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search PMS schemes..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-pms"
            />
          </div>
          <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
            <SelectTrigger className="w-[180px]" data-testid="filter-strategy">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent>
              {PMS_STRATEGIES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="w-[180px]" data-testid="filter-style">
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent>
              {PMS_STYLES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="all">All Status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]" data-testid="sort-by">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="return1Y">1Y Return</SelectItem>
              <SelectItem value="return3Y">3Y Return</SelectItem>
              <SelectItem value="aum">AUM</SelectItem>
              <SelectItem value="riskScore">Risk Score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {displayData.length === 0 ? (
          <Card className="p-8 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800">No PMS Schemes Found</h3>
            <p className="text-gray-600">
              {searchQuery ? "Try adjusting your search or filters." : "PMS schemes will appear here once published by admin."}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Showing {displayData.length} scheme{displayData.length !== 1 ? "s" : ""}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/pms/compare")} data-testid="compare-pms">
                <BarChart3 className="w-4 h-4 mr-2" />
                Compare Schemes
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayData.map((scheme) => (
                <Card 
                  key={scheme.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer" 
                  onClick={() => navigate(`/pms/${scheme.id}`)}
                  data-testid={`pms-card-${scheme.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold line-clamp-2">{scheme.name}</CardTitle>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {scheme.fundHouseName || "Unknown Provider"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(scheme.fundStatus)}
                        <Badge variant="outline" className="text-xs">{scheme.strategy || "PMS"}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">1Y Return</p>
                        <p className={`font-semibold ${getReturnColor(scheme.return1Y)}`}>
                          {formatPercent(scheme.return1Y)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">3Y Return</p>
                        <p className={`font-semibold ${getReturnColor(scheme.return3Y)}`}>
                          {formatPercent(scheme.return3Y)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">5Y Return</p>
                        <p className={`font-semibold ${getReturnColor(scheme.return5Y)}`}>
                          {formatPercent(scheme.return5Y)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-500 text-xs">Min Investment</p>
                          <p className="font-medium">{formatCurrency(scheme.minInvestment)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-500 text-xs">AUM</p>
                          <p className="font-medium">{formatCurrency(scheme.aum)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        {getRiskBadge(scheme.riskScore)}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Sharpe:</span>
                        <span className="font-medium">{scheme.sharpeRatio ? parseFloat(scheme.sharpeRatio).toFixed(2) : "N/A"}</span>
                      </div>
                    </div>

                    {scheme.manager && (
                      <div className="flex items-center justify-between text-sm border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-indigo-500" />
                          <span className="text-gray-600">{scheme.manager.name}</span>
                        </div>
                        {scheme.manager.experienceYears && (
                          <span className="text-xs text-gray-500">{scheme.manager.experienceYears}+ yrs exp</span>
                        )}
                      </div>
                    )}

                    <Button variant="outline" className="w-full mt-2" data-testid={`view-pms-${scheme.id}`}>
                      View Details <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
