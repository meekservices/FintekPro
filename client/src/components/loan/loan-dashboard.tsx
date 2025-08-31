import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { 
  CreditCard, 
  Plus, 
  Calculator, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  FileText,
  TrendingUp
} from "lucide-react";
import { LoanApplicationForm } from "./loan-application-form";
import { LoanEligibilityCalculator } from "./loan-eligibility-calculator";

interface LoanApplication {
  id: string;
  applicationNumber: string;
  userId: string;
  portfolioId: string;
  requestedAmount: number;
  approvedAmount?: number;
  purpose: string;
  tenure: string;
  status: string;
  applicantName: string;
  email: string;
  phone: string;
  interestRate?: string;
  createdAt: string;
  approvalDate?: string;
  disbursalDate?: string;
}

export function LoanDashboard() {
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Fetch user loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ["/api/loans/user", "demo-user-1"], // This would come from auth context
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "disbursed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4" />;
      case "disbursed":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const activeLoan = Array.isArray(loans?.data) ? loans.data.find((loan: LoanApplication) => 
    loan.status === 'disbursed' || loan.status === 'approved'
  ) : null;

  const pendingApplications = Array.isArray(loans?.data) ? loans.data.filter((loan: LoanApplication) => 
    loan.status === 'pending'
  ) : [];

  const completedApplications = Array.isArray(loans?.data) ? loans.data.filter((loan: LoanApplication) => 
    loan.status === 'approved' || loan.status === 'rejected' || loan.status === 'disbursed'
  ) : [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading loan information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Loan Against Securities</h2>
        <div className="flex gap-2">
          <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-open-calculator">
                <Calculator className="h-4 w-4 mr-2" />
                Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <LoanEligibilityCalculator />
            </DialogContent>
          </Dialog>

          <Dialog open={showApplicationForm} onOpenChange={setShowApplicationForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-apply-loan">
                <Plus className="h-4 w-4 mr-2" />
                Apply for Loan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <LoanApplicationForm onClose={() => setShowApplicationForm(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Active Loan Summary */}
      {activeLoan && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Active Loan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Application Number</p>
                <p className="font-semibold">{activeLoan.applicationNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Loan Amount</p>
                <p className="font-semibold text-lg">₹{(activeLoan.approvedAmount || activeLoan.requestedAmount).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Interest Rate</p>
                <p className="font-semibold">{activeLoan.interestRate || '10.25'}% p.a.</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className={getStatusColor(activeLoan.status)}>
                  {getStatusIcon(activeLoan.status)}
                  <span className="ml-1 capitalize">{activeLoan.status}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loan Applications Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Applications ({pendingApplications.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            Application History ({completedApplications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingApplications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Applications</h3>
                <p className="text-gray-600 mb-4">You don't have any loan applications pending review.</p>
                <Dialog open={showApplicationForm} onOpenChange={setShowApplicationForm}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-apply-first-loan">
                      <Plus className="h-4 w-4 mr-2" />
                      Apply for Your First Loan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <LoanApplicationForm onClose={() => setShowApplicationForm(false)} />
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingApplications.map((loan: LoanApplication) => (
                <Card key={loan.id} className="border-yellow-200">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{loan.applicationNumber}</h3>
                        <p className="text-sm text-gray-600">Applied on {formatDate(loan.createdAt)}</p>
                      </div>
                      <Badge className={getStatusColor(loan.status)}>
                        {getStatusIcon(loan.status)}
                        <span className="ml-1 capitalize">{loan.status}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Loan Amount</p>
                        <p className="font-semibold">₹{loan.requestedAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Purpose</p>
                        <p className="font-semibold capitalize">{loan.purpose}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tenure</p>
                        <p className="font-semibold">{loan.tenure} months</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Applicant</p>
                        <p className="font-semibold">{loan.applicantName}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {completedApplications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Application History</h3>
                <p className="text-gray-600">Your completed loan applications will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedApplications.map((loan: LoanApplication) => (
                <Card key={loan.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{loan.applicationNumber}</h3>
                        <p className="text-sm text-gray-600">Applied on {formatDate(loan.createdAt)}</p>
                        {loan.approvalDate && (
                          <p className="text-sm text-green-600">Approved on {formatDate(loan.approvalDate)}</p>
                        )}
                        {loan.disbursalDate && (
                          <p className="text-sm text-blue-600">Disbursed on {formatDate(loan.disbursalDate)}</p>
                        )}
                      </div>
                      <Badge className={getStatusColor(loan.status)}>
                        {getStatusIcon(loan.status)}
                        <span className="ml-1 capitalize">{loan.status}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Requested Amount</p>
                        <p className="font-semibold">₹{loan.requestedAmount.toLocaleString()}</p>
                      </div>
                      {loan.approvedAmount && (
                        <div>
                          <p className="text-gray-600">Approved Amount</p>
                          <p className="font-semibold text-green-600">₹{loan.approvedAmount.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600">Purpose</p>
                        <p className="font-semibold capitalize">{loan.purpose}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tenure</p>
                        <p className="font-semibold">{loan.tenure} months</p>
                      </div>
                    </div>

                    {loan.status === 'disbursed' && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Interest Rate</p>
                            <p className="font-semibold">{loan.interestRate || '10.25'}% p.a.</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Next EMI Due</p>
                            <p className="font-semibold">15th Next Month</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Outstanding Balance</p>
                            <p className="font-semibold text-red-600">₹{(loan.approvedAmount || loan.requestedAmount).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      {Array.isArray(loans?.data) && loans.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Applications</p>
                  <p className="text-2xl font-bold">{loans.data.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Loans</p>
                  <p className="text-2xl font-bold">
                    {loans.data.filter((loan: LoanApplication) => loan.status === 'disbursed').length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Borrowed</p>
                  <p className="text-2xl font-bold">
                    ₹{loans.data
                      .filter((loan: LoanApplication) => loan.status === 'disbursed')
                      .reduce((sum: number, loan: LoanApplication) => sum + (loan.approvedAmount || loan.requestedAmount), 0)
                      .toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}