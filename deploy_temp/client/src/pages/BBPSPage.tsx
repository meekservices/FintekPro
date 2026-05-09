import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Receipt, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Zap, 
  Smartphone, 
  Wifi, 
  Home,
  Car,
  Shield,
  Building,
  IndianRupee,
  Calendar,
  User,
  History,
  Search
} from "lucide-react";

interface BbpsCategory {
  id: string;
  categoryName: string;
  categoryCode: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BbpsBiller {
  id: string;
  billerName: string;
  billerCode: string;
  categoryId: string;
  billerAliasName: string;
  billerCoverage: string;
  paymentAmountExactness: string;
  customerParamName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BbpsCustomerBill {
  id: string;
  userId: string;
  billerId: string;
  customerParam: string;
  billAmount: string;
  dueDate: string;
  billDate: string;
  billPeriod: string;
  billFetchStatus: string;
  billData: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface BbpsTransaction {
  id: string;
  userId: string;
  billId: string;
  billerCode: string;
  customerParam: string;
  paymentAmount: string;
  transactionId: string;
  bbpsTransactionId: string;
  paymentStatus: string;
  paymentMode: string;
  transactionReference: string;
  failureReason: string;
  commissionAmount: string;
  settlementDate: string;
  receiptData: string;
  initiatedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

const categoryIcons: Record<string, any> = {
  ELECTRICITY: Zap,
  GAS: Home,
  WATER: Home,
  TELECOM_POSTPAID: Smartphone,
  TELECOM_PREPAID: Smartphone,
  DTH: Wifi,
  BROADBAND: Wifi,
  INSURANCE: Shield,
  LOAN_REPAYMENT: Building,
  MUNICIPAL: Building,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "SUCCESS":
      return "bg-green-500";
    case "FAILED":
      return "bg-red-500";
    case "PENDING":
      return "bg-yellow-500";
    default:
      return "bg-muted";
  }
};

export default function BBPSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBiller, setSelectedBiller] = useState<BbpsBiller | null>(null);
  const [customerParam, setCustomerParam] = useState("");
  const [fetchedBill, setFetchedBill] = useState<BbpsCustomerBill | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  // Handle payment callback from Cashfree - verify status from backend
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const transactionId = urlParams.get('transactionId');
    const message = urlParams.get('message');

    if (paymentStatus && transactionId) {
      // Fetch verified status from backend instead of trusting URL params
      const verifyPaymentStatus = async () => {
        try {
          const response = await fetch(`/api/bbps/transactions/${transactionId}/status`);
          
          if (!response.ok) {
            throw new Error('Failed to verify payment status');
          }

          const verifiedStatus = await response.json();

          // Show toast based on verified status from database
          if (verifiedStatus.status === 'SUCCESS') {
            toast({
              title: "Payment Successful!",
              description: `Your bill payment was successful. Transaction ID: ${transactionId}`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/bbps/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/bbps/bills"] });
          } else if (verifiedStatus.status === 'FAILED') {
            toast({
              title: "Payment Failed",
              description: "Your payment could not be processed. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Payment Pending",
              description: "Your payment is being processed. Please check back shortly.",
            });
          }
        } catch (error) {
          console.error('Error verifying payment status:', error);
          toast({
            title: "Verification Error",
            description: "Could not verify payment status. Please check your transaction history.",
            variant: "destructive",
          });
        }
      };

      verifyPaymentStatus();

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'error') {
      // Handle error callback without transaction ID
      toast({
        title: "Payment Error",
        description: message || "An error occurred during payment processing.",
        variant: "destructive",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, queryClient]);

  // Fetch categories
  const { data: categories = [] } = useQuery<BbpsCategory[]>({
    queryKey: ["/api/bbps/categories"],
  });

  // Fetch billers for selected category
  const { data: billers = [] } = useQuery<BbpsBiller[]>({
    queryKey: ["/api/bbps/categories", selectedCategory, "billers"],
    enabled: !!selectedCategory,
  });

  // Fetch user bills
  const { data: userBills = [] } = useQuery<BbpsCustomerBill[]>({
    queryKey: ["/api/bbps/bills"],
  });

  // Fetch user transactions
  const { data: userTransactions = [] } = useQuery<BbpsTransaction[]>({
    queryKey: ["/api/bbps/transactions"],
  });

  // Fetch bill mutation
  const fetchBillMutation = useMutation({
    mutationFn: async (data: { billerId: string; customerParam: string }) => {
      const response = await fetch("/api/bbps/fetch-bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch bill");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setFetchedBill(data);
      queryClient.invalidateQueries({ queryKey: ["/api/bbps/bills"] });
      toast({
        title: "Bill fetched successfully",
        description: "Your bill details have been retrieved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error fetching bill",
        description: error.message || "Failed to fetch bill details.",
        variant: "destructive",
      });
    },
  });

  // Pay bill mutation
  const payBillMutation = useMutation({
    mutationFn: async (data: { billId: string; paymentAmount: string }) => {
      const response = await fetch("/api/bbps/pay-bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to process payment");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.paymentUrl) {
        // Redirect to Cashfree payment page
        toast({
          title: "Redirecting to payment gateway...",
          description: "Please complete your payment on the secure payment page.",
        });
        
        // Redirect after a short delay to let user see the toast
        setTimeout(() => {
          window.location.href = data.paymentUrl;
        }, 1000);
      } else {
        throw new Error(data.message || "Failed to get payment URL");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment Initiation Failed",
        description: error.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFetchBill = () => {
    if (!selectedBiller || !customerParam) {
      toast({
        title: "Missing information",
        description: "Please select a biller and enter customer details.",
        variant: "destructive",
      });
      return;
    }

    fetchBillMutation.mutate({
      billerId: selectedBiller.id,
      customerParam,
    });
  };

  const handlePayBill = () => {
    if (!fetchedBill) {
      toast({
        title: "Missing information",
        description: "Please fetch a bill first.",
        variant: "destructive",
      });
      return;
    }

    payBillMutation.mutate({
      billId: fetchedBill.id,
      paymentAmount: fetchedBill.billAmount || "0",
    });
  };

  const formatCurrency = (amount: string) => {
    const numAmount = parseFloat(amount) / 100; // Convert paise to rupees
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN");
  };

  return (
    <div className="container mx-auto p-6" data-testid="bbps-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="page-title">BBPS - Bill Payment</h1>
        <p className="text-muted-foreground" data-testid="page-description">
          Pay your utility bills, mobile recharges, and more through India's unified bill payment system
        </p>
      </div>

      <Tabs defaultValue="pay-bills" className="w-full" data-testid="bbps-tabs">
        <ScrollableTabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
          <TabsTrigger value="pay-bills" data-testid="tab-pay-bills">Pay Bills</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="pay-bills" className="space-y-6" data-testid="tab-content-pay-bills">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Bill Categories */}
            <Card data-testid="card-categories">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="card-title-categories">
                  <Search className="h-5 w-5" />
                  Select Category
                </CardTitle>
                <CardDescription data-testid="card-description-categories">
                  Choose the type of bill you want to pay
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3" data-testid="category-grid">
                  {categories.map((category) => {
                    const IconComponent = categoryIcons[category.categoryCode] || IndianRupee;
                    return (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        className="justify-start h-auto p-4"
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setSelectedBiller(null);
                          setFetchedBill(null);
                          setCustomerParam("");
                        }}
                        data-testid={`category-button-${category.categoryCode}`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5" />
                          <div className="text-left">
                            <div className="font-medium">{category.categoryName}</div>
                            <div className="text-sm text-muted-foreground">{category.description}</div>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Biller Selection & Bill Fetch */}
            <Card data-testid="card-biller-selection">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="card-title-biller">
                  <Building className="h-5 w-5" />
                  Select Biller
                </CardTitle>
                <CardDescription data-testid="card-description-biller">
                  Choose your service provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCategory && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="biller-select" data-testid="label-biller">Service Provider</Label>
                      <Select
                        value={selectedBiller?.id || ""}
                        onValueChange={(value) => {
                          const biller = billers.find(b => b.id === value);
                          setSelectedBiller(biller || null);
                          setFetchedBill(null);
                          setCustomerParam("");
                        }}
                      >
                        <SelectTrigger data-testid="select-biller">
                          <SelectValue placeholder="Select a biller" />
                        </SelectTrigger>
                        <SelectContent>
                          {billers.map((biller) => (
                            <SelectItem key={biller.id} value={biller.id} data-testid={`biller-option-${biller.billerCode}`}>
                              <div>
                                <div className="font-medium">{biller.billerName}</div>
                                <div className="text-sm text-muted-foreground">{biller.billerCoverage}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedBiller && (
                      <div className="space-y-2">
                        <Label htmlFor="customer-param" data-testid="label-customer-param">
                          {selectedBiller.customerParamName}
                        </Label>
                        <Input
                          id="customer-param"
                          placeholder={`Enter your ${selectedBiller.customerParamName}`}
                          value={customerParam}
                          onChange={(e) => setCustomerParam(e.target.value)}
                          data-testid="input-customer-param"
                        />
                        <Button 
                          onClick={handleFetchBill}
                          disabled={fetchBillMutation.isPending || !customerParam}
                          className="w-full"
                          data-testid="button-fetch-bill"
                        >
                          {fetchBillMutation.isPending ? "Fetching..." : "Fetch Bill"}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {!selectedCategory && (
                  <Alert data-testid="alert-select-category">
                    <AlertDescription>
                      Please select a category first to see available billers.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bill Details & Payment */}
          {fetchedBill && (
            <Card data-testid="card-bill-details">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="card-title-bill-details">
                  <Receipt className="h-5 w-5" />
                  Bill Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fetchedBill.billFetchStatus === "SUCCESS" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2" data-testid="bill-info-grid">
                      <div className="space-y-2">
                        <Label data-testid="label-customer-info">Customer Information</Label>
                        <div className="p-3 bg-muted rounded-lg" data-testid="customer-info">
                          <div className="text-sm"><strong>Parameter:</strong> {fetchedBill.customerParam}</div>
                          {fetchedBill.billData && (
                            <>
                              {JSON.parse(fetchedBill.billData).customerName && (
                                <div className="text-sm"><strong>Name:</strong> {JSON.parse(fetchedBill.billData).customerName}</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label data-testid="label-bill-info">Bill Information</Label>
                        <div className="p-3 bg-muted rounded-lg" data-testid="bill-info">
                          <div className="text-sm"><strong>Amount:</strong> {formatCurrency(fetchedBill.billAmount || "0")}</div>
                          <div className="text-sm"><strong>Due Date:</strong> {formatDate(fetchedBill.dueDate || "")}</div>
                          <div className="text-sm"><strong>Bill Period:</strong> {fetchedBill.billPeriod}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                        <AlertDescription className="text-sm">
                          You'll be redirected to Cashfree payment gateway to complete your payment securely using UPI, Net Banking, Cards, or other payment methods.
                        </AlertDescription>
                      </Alert>

                      <Button 
                        onClick={handlePayBill}
                        disabled={payBillMutation.isPending}
                        className="w-full"
                        size="lg"
                        data-testid="button-pay-bill"
                      >
                        <CreditCard className="mr-2 h-5 w-5" />
                        {payBillMutation.isPending ? "Initiating Payment..." : `Pay ${formatCurrency(fetchedBill.billAmount || "0")}`}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert variant="destructive" data-testid="alert-bill-fetch-failed">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to fetch bill details. Please check your information and try again.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4" data-testid="tab-content-history">
          <Card data-testid="card-bill-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="card-title-history">
                <History className="h-5 w-5" />
                Bill History
              </CardTitle>
              <CardDescription data-testid="card-description-history">
                Your recently fetched bills
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userBills.length > 0 ? (
                <div className="space-y-3" data-testid="bills-list">
                  {userBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`bill-item-${bill.id}`}>
                      <div>
                        <div className="font-medium" data-testid={`bill-customer-param-${bill.id}`}>{bill.customerParam}</div>
                        <div className="text-sm text-muted-foreground" data-testid={`bill-period-${bill.id}`}>{bill.billPeriod}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`bill-amount-${bill.id}`}>{formatCurrency(bill.billAmount || "0")}</div>
                        <Badge variant={bill.billFetchStatus === "SUCCESS" ? "default" : "destructive"} data-testid={`bill-status-${bill.id}`}>
                          {bill.billFetchStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8" data-testid="no-bills-message">
                  No bills found. Start by fetching a bill in the Pay Bills tab.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4" data-testid="tab-content-transactions">
          <Card data-testid="card-transaction-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="card-title-transactions">
                <CreditCard className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription data-testid="card-description-transactions">
                Your bill payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userTransactions.length > 0 ? (
                <div className="space-y-3" data-testid="transactions-list">
                  {userTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`transaction-item-${transaction.id}`}>
                      <div>
                        <div className="font-medium" data-testid={`transaction-id-${transaction.id}`}>{transaction.transactionId}</div>
                        <div className="text-sm text-muted-foreground" data-testid={`transaction-customer-param-${transaction.id}`}>{transaction.customerParam}</div>
                        <div className="text-xs text-muted-foreground" data-testid={`transaction-date-${transaction.id}`}>
                          {formatDate(transaction.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`transaction-amount-${transaction.id}`}>{formatCurrency(transaction.paymentAmount)}</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(transaction.paymentStatus)}`} data-testid={`transaction-status-indicator-${transaction.id}`}></div>
                          <Badge variant={transaction.paymentStatus === "SUCCESS" ? "default" : transaction.paymentStatus === "FAILED" ? "destructive" : "secondary"} data-testid={`transaction-status-${transaction.id}`}>
                            {transaction.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8" data-testid="no-transactions-message">
                  No transactions found. Complete a bill payment to see your transactions here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}