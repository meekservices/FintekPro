import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CreditCard,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  MinusCircle,
  Shield
} from "lucide-react";

interface CreditAccount {
  id: string;
  type: string;
  institution: string;
  accountNumber: string;
  status: "active" | "closed" | "defaulted";
  balance: number;
  creditLimit?: number;
  openDate: string;
  paymentHistory: "excellent" | "good" | "fair" | "poor";
}

export default function CreditReportPage() {
  const [creditScore] = useState(750);
  const [lastUpdated] = useState("2025-01-10");

  const creditAccounts: CreditAccount[] = [
    {
      id: "1",
      type: "Credit Card",
      institution: "HDFC Bank",
      accountNumber: "****1234",
      status: "active",
      balance: 25000,
      creditLimit: 200000,
      openDate: "2020-05-15",
      paymentHistory: "excellent"
    },
    {
      id: "2",
      type: "Personal Loan",
      institution: "ICICI Bank",
      accountNumber: "****5678",
      status: "active",
      balance: 150000,
      openDate: "2022-03-20",
      paymentHistory: "good"
    },
    {
      id: "3",
      type: "Home Loan",
      institution: "SBI",
      accountNumber: "****9012",
      status: "active",
      balance: 2500000,
      openDate: "2019-11-10",
      paymentHistory: "excellent"
    },
    {
      id: "4",
      type: "Credit Card",
      institution: "Axis Bank",
      accountNumber: "****3456",
      status: "closed",
      balance: 0,
      creditLimit: 100000,
      openDate: "2018-07-01",
      paymentHistory: "good"
    }
  ];

  const enquiries = [
    { date: "2025-01-05", institution: "HDFC Bank", type: "Credit Card Application", impact: "low" },
    { date: "2024-12-10", institution: "Bajaj Finance", type: "Loan Enquiry", impact: "medium" },
    { date: "2024-11-15", institution: "ICICI Bank", type: "Pre-approved Offer Check", impact: "low" },
  ];

  const getCreditScoreColor = (score: number) => {
    if (score >= 800) return "text-green-600";
    if (score >= 750) return "text-blue-600";
    if (score >= 700) return "text-yellow-600";
    if (score >= 650) return "text-orange-600";
    return "text-red-600";
  };

  const getCreditGrade = (score: number) => {
    if (score >= 800) return "Excellent";
    if (score >= 750) return "Very Good";
    if (score >= 700) return "Good";
    if (score >= 650) return "Fair";
    return "Poor";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "closed":
        return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
      case "defaulted":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getPaymentHistoryColor = (history: string) => {
    switch (history) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "fair":
        return "text-yellow-600";
      case "poor":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold" data-testid="credit-report-title">Credit Report</h1>
              <p className="text-muted-foreground">Detailed credit history and analysis</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button data-testid="button-download">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>
      </div>

      {/* Credit Score Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-5xl font-bold ${getCreditScoreColor(creditScore)}`} data-testid="credit-score">
                {creditScore}
              </div>
              <div className="text-muted-foreground mt-2">{getCreditGrade(creditScore)}</div>
              <Progress value={(creditScore / 900) * 100} className="mt-4" />
              <p className="text-xs text-muted-foreground mt-2">Out of 900</p>
              <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdated}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credit Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Used</span>
                  <span className="text-sm font-medium">₹25,000</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Limit</span>
                  <span className="text-sm font-medium">₹3,00,000</span>
                </div>
                <Progress value={(25000 / 300000) * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">8.3% utilized (Excellent)</p>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Low utilization is good for credit score</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On-time Payments</span>
                <Badge variant="outline" className="text-green-600">100%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Late Payments</span>
                <Badge variant="outline">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Defaults</span>
                <Badge variant="outline">0</Badge>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Perfect payment record</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="accounts" data-testid="tab-accounts">
            <CreditCard className="h-4 w-4 mr-2" />
            Credit Accounts
          </TabsTrigger>
          <TabsTrigger value="enquiries" data-testid="tab-enquiries">
            <AlertCircle className="h-4 w-4 mr-2" />
            Credit Enquiries
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <TrendingUp className="h-4 w-4 mr-2" />
            Score Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Shield className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Credit Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active & Closed Accounts</CardTitle>
              <CardDescription>Complete history of your credit accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creditAccounts.map((account) => (
                  <div key={account.id} className="border rounded-lg p-4" data-testid={`account-${account.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(account.status)}
                        <div>
                          <h4 className="font-semibold">{account.type}</h4>
                          <p className="text-sm text-muted-foreground">{account.institution} • {account.accountNumber}</p>
                        </div>
                      </div>
                      <Badge variant={account.status === "active" ? "default" : "secondary"}>
                        {account.status}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-medium">₹{account.balance.toLocaleString()}</p>
                      </div>
                      {account.creditLimit && (
                        <div>
                          <p className="text-xs text-muted-foreground">Credit Limit</p>
                          <p className="font-medium">₹{account.creditLimit.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Opened On</p>
                        <p className="font-medium">{new Date(account.openDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Payment History</p>
                        <p className={`font-medium capitalize ${getPaymentHistoryColor(account.paymentHistory)}`}>
                          {account.paymentHistory}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enquiries Tab */}
        <TabsContent value="enquiries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Credit Enquiries</CardTitle>
              <CardDescription>Track who has accessed your credit report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enquiries.map((enquiry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`enquiry-${index}`}>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{enquiry.institution}</p>
                        <p className="text-sm text-muted-foreground">{enquiry.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{new Date(enquiry.date).toLocaleDateString()}</p>
                      <Badge variant={enquiry.impact === "low" ? "secondary" : "outline"} className="mt-1">
                        {enquiry.impact} impact
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Hard Enquiries Impact</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Multiple hard enquiries in a short period can lower your credit score. Try to space out credit applications.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Score Factors</CardTitle>
              <CardDescription>What's affecting your credit score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Payment History (35%)</span>
                  <span className="text-sm text-green-600 font-medium">Excellent</span>
                </div>
                <Progress value={95} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">100% on-time payments</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Credit Utilization (30%)</span>
                  <span className="text-sm text-green-600 font-medium">Excellent</span>
                </div>
                <Progress value={92} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Only 8.3% of available credit used</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Credit History Length (15%)</span>
                  <span className="text-sm text-blue-600 font-medium">Good</span>
                </div>
                <Progress value={78} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Average age: 4.5 years</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Credit Mix (10%)</span>
                  <span className="text-sm text-blue-600 font-medium">Good</span>
                </div>
                <Progress value={75} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">3 types of credit</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">New Credit (10%)</span>
                  <span className="text-sm text-green-600 font-medium">Excellent</span>
                </div>
                <Progress value={88} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Only 3 enquiries in last 12 months</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalized Recommendations</CardTitle>
              <CardDescription>Actions to improve your credit score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Continue On-Time Payments</h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">Your perfect payment history is the strongest factor. Keep it up!</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">Maintain Low Credit Utilization</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Your 8.3% utilization is excellent. Try to keep it below 30% for optimal scores.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">Consider Credit Age</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Avoid closing your oldest credit card (Axis Bank). It helps your credit history length.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">Improve Credit Mix</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">Adding a small installment loan could diversify your credit mix and potentially boost your score.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
