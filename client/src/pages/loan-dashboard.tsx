import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  IndianRupee, 
  TrendingUp, 
  LucideShield as LucideShield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Building2, 
  User, 
  CreditCard,
  FileText,
  ArrowRight,
  Star,
  Percent,
  Calendar,
  Eye,
  Download,
  PhoneCall,
  Mail,
  MapPin,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LoanApplicationStatus {
  applicationId: string;
  lenderId: string;
  lenderName: string;
  status: string;
  stage: string;
  amount: number;
  emi: number;
  interestRate: number;
  tenure: number;
  appliedDate: string;
  lastUpdated: string;
  nextSteps: string[];
  documentsRequired?: { name: string; status: string; required: boolean; }[];
  estimatedDisbursementDate?: string;
}

interface LoanSummary {
  totalApplications: number;
  approved: number;
  pending: number;
  disbursed: number;
  totalLoanAmount: number;
  monthlyEMI: number;
}

export default function LoanDashboard() {
  const [selectedApplication, setSelectedApplication] = useState<LoanApplicationStatus | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [lenderId, setLenderId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: applicationsResponse, isLoading, refetch } = useQuery<{ applications: LoanApplicationStatus[] }>({
    queryKey: ['/api/loans/applications'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/loans/applications');
        return data;
      } catch {
        return { applications: [] };
      }
    },
  });
  
  const applications = applicationsResponse?.applications || [];
  
  const loanSummary: LoanSummary = {
    totalApplications: applications.length,
    approved: applications.filter(a => a.status === 'approved').length,
    pending: applications.filter(a => a.status === 'under_review' || a.status === 'pending').length,
    disbursed: applications.filter(a => a.status === 'disbursed').length,
    totalLoanAmount: applications.reduce((sum, a) => sum + a.amount, 0),
    monthlyEMI: applications.filter(a => a.status !== 'rejected').reduce((sum, a) => sum + a.emi, 0)
  };

  const checkStatusMutation = useMutation({
    mutationFn: async ({ applicationId, lenderId }: { applicationId: string; lenderId: string }) => {
      const response = await fetch(`/api/loans/${applicationId}/status?lenderId=${lenderId}`);
      return await response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Status Updated",
          description: `Application status: ${result.data.status}`,
        });
        // Update the selected application with fresh data
        setSelectedApplication(prev => prev ? { ...prev, ...result.data } : null);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to fetch application status",
        variant: "destructive",
      });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'disbursed': return 'secondary';
      case 'under_review': return 'outline';
      case 'pending': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'disbursed': return <IndianRupee className="w-4 h-4 text-blue-600" />;
      case 'under_review': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'rejected': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getLenderLogo = (lenderId: string) => {
    const logos = {
      icici: "🏦",
      hdfc: "🏛️", 
      tata_capital: "🏢",
      bajaj_finance: "⭐"
    };
    return logos[lenderId as keyof typeof logos] || "🏦";
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'submitted': return 20;
      case 'under_review': return 40;
      case 'approved': return 80;
      case 'disbursed': return 100;
      case 'rejected': return 0;
      default: return 20;
    }
  };

  const handleCheckStatus = () => {
    if (!applicationId || !lenderId) {
      toast({
        title: "Missing Information",
        description: "Please provide both application ID and lender ID",
        variant: "destructive",
      });
      return;
    }
    
    checkStatusMutation.mutate({ applicationId, lenderId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-indigo-100 dark:to-indigo-900/30 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Loan Dashboard
          </h1>
          <p className="text-xl text-muted-foreground">
            Track your loan applications and manage your borrowings
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold text-foreground">{loanSummary.totalApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-foreground">{loanSummary.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center">
                <IndianRupee className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Loan Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{(loanSummary.totalLoanAmount / 100000).toFixed(1)}L</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly EMI</p>
                  <p className="text-2xl font-bold text-foreground">₹{loanSummary.monthlyEMI.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="applications" className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="status">Check Status</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </ScrollableTabsList>
          
          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Loan Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {applications.map((application) => (
                    <Card key={application.applicationId} className="border-l-4 border-l-blue-500">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getLenderLogo(application.lenderId)}</span>
                            <div>
                              <h3 className="font-semibold text-lg">{application.lenderName}</h3>
                              <p className="text-sm text-muted-foreground">Application ID: {application.applicationId}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(application.status)}
                            <Badge variant={getStatusBadgeVariant(application.status)}>
                              {application.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Loan Amount</p>
                            <p className="font-semibold text-lg">₹{application.amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">EMI</p>
                            <p className="font-semibold text-lg">₹{application.emi.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Interest Rate</p>
                            <p className="font-semibold text-lg">{application.interestRate}%</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Progress</p>
                            <p className="text-sm text-muted-foreground">{application.stage}</p>
                          </div>
                          <Progress value={getProgressPercentage(application.status)} className="h-2" />
                        </div>

                        <div className="mb-4">
                          <h4 className="text-sm font-semibold mb-2">Next Steps:</h4>
                          <ul className="space-y-1">
                            {application.nextSteps.map((step, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-center">
                                <ArrowRight className="w-3 h-3 mr-2 text-blue-500" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {application.documentsRequired && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold mb-2">Document Status:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {application.documentsRequired.map((doc, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <span className="text-sm">{doc.name}</span>
                                  <Badge variant={
                                    doc.status === 'verified' ? 'default' : 
                                    doc.status === 'pending' ? 'outline' : 'destructive'
                                  }>
                                    {doc.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <div className="text-sm text-muted-foreground">
                            <p>Applied: {new Date(application.appliedDate).toLocaleDateString()}</p>
                            <p>Updated: {new Date(application.lastUpdated).toLocaleDateString()}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedApplication(application)}
                              data-testid={`button-view-details-${application.lenderId}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => {
                                setApplicationId(application.applicationId);
                                setLenderId(application.lenderId);
                                checkStatusMutation.mutate({ 
                                  applicationId: application.applicationId, 
                                  lenderId: application.lenderId 
                                });
                              }}
                              disabled={checkStatusMutation.isPending}
                              data-testid={`button-refresh-status-${application.lenderId}`}
                            >
                              {checkStatusMutation.isPending ? "Checking..." : "Refresh Status"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Check Application Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="applicationId">Application ID</Label>
                    <Input
                      id="applicationId"
                      placeholder="e.g., ICICI-1757389456789"
                      value={applicationId}
                      onChange={(e) => setApplicationId(e.target.value)}
                      data-testid="input-application-id"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lenderId">Lender</Label>
                    <Input
                      id="lenderId"
                      placeholder="e.g., icici, hdfc, tata_capital, bajaj_finance"
                      value={lenderId}
                      onChange={(e) => setLenderId(e.target.value)}
                      data-testid="input-lender-id"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleCheckStatus}
                  disabled={checkStatusMutation.isPending}
                  className="w-full"
                  data-testid="button-check-status"
                >
                  {checkStatusMutation.isPending ? "Checking Status..." : "Check Status"}
                </Button>

                {selectedApplication && (
                  <Card className="mt-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <span className="text-xl">{getLenderLogo(selectedApplication.lenderId)}</span>
                        <span>{selectedApplication.lenderName} - Status Details</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Status</p>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(selectedApplication.status)}
                            <span className="font-semibold">{selectedApplication.status.replace('_', ' ').toUpperCase()}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Stage</p>
                          <p className="font-semibold">{selectedApplication.stage}</p>
                        </div>
                      </div>

                      {selectedApplication.estimatedDisbursementDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">Expected Disbursement</p>
                          <p className="font-semibold text-green-600">
                            {new Date(selectedApplication.estimatedDisbursementDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold mb-2">Next Steps:</h4>
                        <ul className="space-y-1">
                          {selectedApplication.nextSteps.map((step, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-center">
                              <ArrowRight className="w-3 h-3 mr-2 text-blue-500" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { name: "Identity Proof", status: "verified", description: "PAN Card, Aadhaar Card" },
                    { name: "Address Proof", status: "verified", description: "Utility Bills, Passport" },
                    { name: "Income Proof", status: "pending", description: "Salary Slips, ITR" },
                    { name: "Bank Statements", status: "not_submitted", description: "Last 6 months" },
                    { name: "Employment Proof", status: "verified", description: "Offer Letter, ID Card" },
                    { name: "Photograph", status: "verified", description: "Passport size photo" }
                  ].map((doc, index) => (
                    <Card key={index} className="border">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-sm">{doc.name}</h3>
                          <Badge variant={
                            doc.status === 'verified' ? 'default' : 
                            doc.status === 'pending' ? 'outline' : 'destructive'
                          }>
                            {doc.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{doc.description}</p>
                        <div className="flex space-x-2">
                          {doc.status === 'not_submitted' && (
                            <Button size="sm" className="w-full">
                              <Upload className="w-3 h-3 mr-1" />
                              Upload
                            </Button>
                          )}
                          {doc.status === 'verified' && (
                            <Button size="sm" variant="outline" className="w-full">
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          )}
                          {doc.status === 'pending' && (
                            <Button size="sm" variant="outline" className="w-full" disabled>
                              <Clock className="w-3 h-3 mr-1" />
                              Under Review
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Need Help?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                      <CardContent className="py-4 text-center">
                        <PhoneCall className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <h4 className="font-semibold text-sm mb-1">Call Support</h4>
                        <p className="text-xs text-muted-foreground">1800-123-4567</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                      <CardContent className="py-4 text-center">
                        <Mail className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <h4 className="font-semibold text-sm mb-1">Email Support</h4>
                        <p className="text-xs text-muted-foreground">loans@fintekpro.com</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
                      <CardContent className="py-4 text-center">
                        <MapPin className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <h4 className="font-semibold text-sm mb-1">Branch Locator</h4>
                        <p className="text-xs text-muted-foreground">Find nearest branch</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}