import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState";
import { 
  Home, 
  Car, 
  User, 
  Building2, 
  GraduationCap,
  IndianRupee,
  Percent,
  Clock,
  CheckCircle,
  Search,
  ArrowRight,
  TrendingUp,
  Shield,
  Star,
  Coins
} from "lucide-react";
import { Link } from "wouter";

interface Bank {
  bankCode: string;
  bankName: string;
  connectorType: string;
  priority: number;
  supportedLoanTypes: string[];
  minAmount: number;
  maxAmount: number;
  minTenure: number;
  maxTenure: number;
  interestRateMin: number;
  interestRateMax: number;
  processingFeePercent: number;
  isActive: boolean;
}

const loanTypeConfig: Record<string, { label: string; icon: any; color: string; description: string }> = {
  personal: { label: "Personal Loan", icon: User, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", description: "Quick funds for personal needs" },
  home: { label: "Home Loan", icon: Home, color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300", description: "Finance your dream home" },
  car: { label: "Car Loan", icon: Car, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300", description: "Drive your new vehicle" },
  business: { label: "Business Loan", icon: Building2, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300", description: "Grow your business" },
  education: { label: "Education Loan", icon: GraduationCap, color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300", description: "Invest in education" },
  gold: { label: "Gold Loan", icon: Coins, color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300", description: "Leverage your gold assets" },
  lap: { label: "Loan Against Property", icon: Building2, color: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300", description: "Unlock property value" },
  las: { label: "Loan Against Shares", icon: TrendingUp, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300", description: "Leverage your stock portfolio" },
};

export default function AgentLoanMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: banksData, isLoading } = useQuery<{ success: boolean; data: Bank[] }>({
    queryKey: ["/api/dsa-loans/banks"],
  });

  const banks = banksData?.data || [];
  
  const filteredBanks = banks.filter(bank => {
    const matchesSearch = bank.bankName?.toLowerCase().includes(searchQuery.toLowerCase());
    const bankLoanTypes = bank.supportedLoanTypes || [];
    const matchesType = selectedType === "all" || bankLoanTypes.includes(selectedType);
    return matchesSearch && matchesType && bank.isActive;
  });

  const loanTypes = Object.keys(loanTypeConfig);

  if (isLoading) {
    return <LoadingState variant="agent-dashboard" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Marketplace</h1>
          <p className="text-muted-foreground">Browse and recommend loan products to your clients</p>
        </div>
        <Link href="/agent/loan-apply">
          <Button>
            <ArrowRight className="h-4 w-4 mr-2" />
            Submit New Lead
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {loanTypes.map(type => {
          const config = loanTypeConfig[type];
          const Icon = config.icon;
          const count = banks.filter(b => (b.supportedLoanTypes || []).includes(type) && b.isActive).length;
          return (
            <Card 
              key={type}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedType === type ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedType(selectedType === type ? "all" : type)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${config.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium mt-2">{config.label}</p>
                <p className="text-xs text-muted-foreground">{count} lenders</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search banks..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {selectedType !== "all" && (
          <Button variant="outline" onClick={() => setSelectedType("all")}>
            Clear Filter
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBanks.map(bank => (
          <Card key={bank.bankCode} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{bank.bankName}</CardTitle>
                <Badge variant="outline" className="capitalize">
                  {bank.connectorType}
                </Badge>
              </div>
              <CardDescription>Priority: {bank.priority}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {(bank.supportedLoanTypes || []).map(type => {
                  const config = loanTypeConfig[type];
                  return config ? (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {config.label}
                    </Badge>
                  ) : null;
                })}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">
                      ₹{(bank.minAmount / 100000).toFixed(0)}L - ₹{(bank.maxAmount / 10000000).toFixed(0)}Cr
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Interest</p>
                    <p className="font-medium">
                      {bank.interestRateMin}% - {bank.interestRateMax}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">
                      {bank.minTenure} - {bank.maxTenure} months
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Processing</p>
                    <p className="font-medium">{bank.processingFeePercent}%</p>
                  </div>
                </div>
              </div>

              <Link href="/agent/loan-apply">
                <Button className="w-full" variant="outline">
                  Submit Lead for {bank.bankName}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBanks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No banks found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try a different search term" : "No banks available for this loan type"}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            DSA Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Multi-Bank Routing</p>
                <p className="text-sm text-muted-foreground">Submit to multiple banks simultaneously</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium">Competitive Commission</p>
                <p className="text-sm text-muted-foreground">Earn up to 2% on disbursed loans</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">Real-time Tracking</p>
                <p className="text-sm text-muted-foreground">Monitor all applications in one place</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
