import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  UserPlus, 
  DollarSign,
  TrendingUp,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  BarChart3,
  Download
} from "lucide-react";

const clientReferralSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z.string().regex(/^[0-9]{10}$/, "Valid 10-digit mobile number is required"),
  interestedProducts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type ClientReferralData = z.infer<typeof clientReferralSchema>;

interface SubAgentData {
  totalReferrals: number;
  newReferralsThisMonth: number;
  activeClients: number;
  conversionRate: number;
  totalEarnings: number;
  earningsThisMonth: number;
  pendingCommission: number;
  nextPayoutDate: string;
}

interface ReferredClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  status: string;
  interestedProducts: string[];
  referredDate: string;
  totalEarnings: number;
}

interface Earning {
  id: string;
  transactionDate: string;
  clientName: string;
  productType: string;
  transactionType: string;
  transactionAmount: number;
  commissionRate: number;
  marketingFee: number;
  tdsAmount: number;
  netEarnings: number;
  paymentStatus: string;
}


interface SubAgentDashboardProps {
  agentId: string;
}

export function SubAgentDashboard({ agentId }: SubAgentDashboardProps) {
  const { toast } = useToast();
  const [isReferralDialogOpen, setIsReferralDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const { data: referralStats } = useQuery<SubAgentData>({
    queryKey: [`/api/agents/${agentId}/referral-stats`],
  });

  const { data: referredClients, isLoading: clientsLoading } = useQuery<ReferredClient[]>({
    queryKey: [`/api/agents/${agentId}/referred-clients`],
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery<Earning[]>({
    queryKey: [`/api/agents/${agentId}/earnings`],
  });

  const productCategories = [
    { value: "mutual_funds", label: "Mutual Funds" },
    { value: "equity", label: "Equity Trading" },
    { value: "bonds", label: "Bonds" },
    { value: "insurance", label: "Insurance" },
    { value: "loans", label: "Loans" },
    { value: "aif", label: "Alternative Investment Funds" },
    { value: "pms", label: "Portfolio Management Services" },
  ];

  const referralForm = useForm<ClientReferralData>({
    resolver: zodResolver(clientReferralSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      interestedProducts: [],
      notes: "",
    },
  });

  const referClientMutation = useMutation({
    mutationFn: (data: ClientReferralData) =>
      apiRequest(`/api/agents/${agentId}/refer-client`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          interestedProducts: selectedProducts,
        }),
      }),
    onSuccess: () => {
      toast({
        title: "Client Referred Successfully",
        description: "The client has been added to your referral list.",
      });
      setIsReferralDialogOpen(false);
      referralForm.reset();
      setSelectedProducts([]);
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/referred-clients`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/referral-stats`] });
    },
    onError: (error: any) => {
      toast({
        title: "Referral Failed",
        description: error.message || "Failed to refer client",
        variant: "destructive",
      });
    },
  });

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/register?ref=${agentId}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Referral Link Copied",
      description: "Share this link with potential clients",
    });
  };

  const handleProductToggle = (product: string) => {
    setSelectedProducts((prev) =>
      prev.includes(product)
        ? prev.filter((p) => p !== product)
        : [...prev, product]
    );
  };

  const getReferralStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "outline" as const, icon: Clock, label: "Pending" },
      contacted: { variant: "default" as const, icon: Users, label: "Contacted" },
      onboarded: { variant: "default" as const, icon: CheckCircle2, label: "Onboarded" },
      active: { variant: "default" as const, icon: TrendingUp, label: "Active" },
      inactive: { variant: "secondary" as const, icon: AlertTriangle, label: "Inactive" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} data-testid={`status-${status}`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-referrals">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralStats?.totalReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{referralStats?.newReferralsThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-clients">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralStats?.activeClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              {referralStats?.conversionRate || 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-earnings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(referralStats?.totalEarnings || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              +₹{(referralStats?.earningsThisMonth || 0).toLocaleString('en-IN')} this month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-commission">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commission</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(referralStats?.pendingCommission || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Next payout: {referralStats?.nextPayoutDate || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Referral Management</CardTitle>
              <CardDescription>
                Track and manage your client referrals
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyReferralLink}
                data-testid="button-copy-referral-link"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Copy Referral Link
              </Button>
              <Dialog open={isReferralDialogOpen} onOpenChange={setIsReferralDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-refer-client">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Refer New Client
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Refer New Client</DialogTitle>
                    <DialogDescription>
                      Add client details and interested products for follow-up
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...referralForm}>
                    <form
                      onSubmit={referralForm.handleSubmit((data) => referClientMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={referralForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-first-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={referralForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-last-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={referralForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={referralForm.control}
                        name="mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="10-digit mobile number" data-testid="input-mobile" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label>Interested Products (Select all that apply)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {productCategories.map((product) => (
                            <div
                              key={product.value}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="checkbox"
                                id={product.value}
                                checked={selectedProducts.includes(product.value)}
                                onChange={() => handleProductToggle(product.value)}
                                className="rounded border-border"
                                data-testid={`checkbox-${product.value}`}
                              />
                              <label
                                htmlFor={product.value}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {product.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <FormField
                        control={referralForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Add any relevant notes about the client"
                                data-testid="input-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsReferralDialogOpen(false)}
                          data-testid="button-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={referClientMutation.isPending}
                          data-testid="button-submit-referral"
                        >
                          {referClientMutation.isPending ? "Submitting..." : "Refer Client"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="clients" className="w-full">
            <ScrollableTabsList>
              <TabsTrigger value="clients" data-testid="tab-clients">
                <Users className="mr-2 h-4 w-4" />
                Referred Clients
              </TabsTrigger>
              <TabsTrigger value="earnings" data-testid="tab-earnings">
                <BarChart3 className="mr-2 h-4 w-4" />
                Earnings Breakdown
              </TabsTrigger>
            </ScrollableTabsList>

            <TabsContent value="clients" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Interested Products</TableHead>
                      <TableHead>Referred Date</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          Loading clients...
                        </TableCell>
                      </TableRow>
                    ) : referredClients && referredClients.length > 0 ? (
                      referredClients.map((client: ReferredClient) => (
                        <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                          <TableCell className="font-medium">
                            {client.firstName} {client.lastName}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{client.email}</div>
                              <div className="text-muted-foreground">{client.mobile}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getReferralStatusBadge(client.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {client.interestedProducts?.map((product: string) => (
                                <Badge key={product} variant="secondary" className="text-xs">
                                  {product}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(client.referredDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{(client.totalEarnings || 0).toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No referred clients yet. Start referring clients to earn commissions!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="earnings" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead className="text-right">Gross Amount</TableHead>
                      <TableHead className="text-right">Commission Rate</TableHead>
                      <TableHead className="text-right">Marketing Fee (25%)</TableHead>
                      <TableHead className="text-right">TDS (10%)</TableHead>
                      <TableHead className="text-right">Net Earnings</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earningsLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center">
                          Loading earnings...
                        </TableCell>
                      </TableRow>
                    ) : earnings && earnings.length > 0 ? (
                      earnings.map((earning: Earning) => (
                        <TableRow key={earning.id} data-testid={`row-earning-${earning.id}`}>
                          <TableCell className="text-sm">
                            {new Date(earning.transactionDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {earning.clientName}
                          </TableCell>
                          <TableCell>{earning.productType}</TableCell>
                          <TableCell>{earning.transactionType}</TableCell>
                          <TableCell className="text-right">
                            ₹{earning.transactionAmount.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">
                            {earning.commissionRate}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{earning.marketingFee.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            -₹{earning.tdsAmount.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                            ₹{earning.netEarnings.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={earning.paymentStatus === 'paid' ? 'default' : 'outline'}>
                              {earning.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          No earnings yet. Refer clients and earn commissions on their transactions!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
