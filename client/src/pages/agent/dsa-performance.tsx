import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState";
import { 
  TrendingUp,
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Target,
  Award,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  Percent
} from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  overview: {
    totalApplications: number;
    totalAmount: number;
    approvedAmount: number;
    disbursedAmount: number;
    approvalRate: number;
    activeBanks: number;
  };
  funnel: Record<string, number>;
  byLoanType: Record<string, number>;
  bankWiseStats: Array<{
    bankCode: string;
    bankName: string;
    connectorType: string;
    priority: number;
    interestRange: string;
    submitted: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: string;
  }>;
}

const loanTypeLabels: Record<string, string> = {
  personal: "Personal Loan",
  home: "Home Loan",
  car: "Car Loan",
  business: "Business Loan",
  education: "Education Loan",
  gold: "Gold Loan",
  lap: "Loan Against Property",
};

export default function AgentDSAPerformance() {
  const { data: response, isLoading, refetch } = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ["/api/dsa-loans/dashboard/stats"],
  });

  const stats = response?.data;

  if (isLoading) {
    return <LoadingState variant="agent-dashboard" />;
  }

  if (!stats || !stats.overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">DSA Performance</h1>
          <p className="text-muted-foreground">Your loan distribution metrics</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p className="text-muted-foreground">Start submitting loan leads to see your performance</p>
            <Link href="/agent/loan-apply">
              <Button className="mt-4">Submit First Lead</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatAmount = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString()}`;
  };

  const estimatedCommission = (stats.overview.disbursedAmount || 0) * 0.015;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DSA Performance</h1>
          <p className="text-muted-foreground">Your loan distribution metrics and earnings</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Applications</p>
                <p className="text-2xl font-bold">{stats.overview.totalApplications}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatAmount(stats.overview.totalAmount)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disbursed</p>
                <p className="text-2xl font-bold text-green-600">{formatAmount(stats.overview.disbursedAmount)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700">Est. Commission</p>
                <p className="text-2xl font-bold text-emerald-700">{formatAmount(estimatedCommission)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-200 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>Application status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(stats.funnel).map(([status, count]) => {
              const total = stats.overview.totalApplications || 1;
              const percentage = (count / total) * 100;
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="font-medium">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Key success indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Approval Rate</p>
                  <p className="text-sm text-muted-foreground">Approved / Total</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {stats.overview.approvalRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Active Banks</p>
                  <p className="text-sm text-muted-foreground">Partner lenders</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {stats.overview.activeBanks}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Avg. Ticket Size</p>
                  <p className="text-sm text-muted-foreground">Per application</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-purple-600">
                {formatAmount(stats.overview.totalAmount / (stats.overview.totalApplications || 1))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Loan Type Distribution
          </CardTitle>
          <CardDescription>Applications by loan category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(stats.byLoanType).map(([type, count]) => (
              <div key={type} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{loanTypeLabels[type] || type}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {stats.bankWiseStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank-wise Performance
            </CardTitle>
            <CardDescription>Your success rate with each lender</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.bankWiseStats.map(bank => (
                <div key={bank.bankCode} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{bank.bankName}</p>
                      <p className="text-sm text-muted-foreground">
                        Interest: {bank.interestRange}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{bank.submitted}</p>
                      <p className="text-muted-foreground">Submitted</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-green-600">{bank.approved}</p>
                      <p className="text-muted-foreground">Approved</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-red-600">{bank.rejected}</p>
                      <p className="text-muted-foreground">Rejected</p>
                    </div>
                    <Badge variant={parseFloat(bank.approvalRate) > 50 ? "default" : "secondary"}>
                      {bank.approvalRate} approval
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
