import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Building2, CheckCircle, AlertCircle, Star, TrendingUp } from "lucide-react";

// Demat account form schema
const dematAccountSchema = z.object({
  dematAccountNumber: z.string().min(8, "Demat account number must be at least 8 digits").max(20, "Account number is too long"),
  dematDpId: z.string().min(1, "DP ID is required"),
  dematDpName: z.string().min(1, "DP name is required"),
  depositoryType: z.enum(["NSDL", "CDSL"], {
    required_error: "Please select depository type"
  }),
  nsdlClientId: z.string().optional(),
  cdslBoId: z.string().optional(),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  // Additional demat-specific fields
  tradingAccountNumber: z.string().optional(),
  brokerName: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format").optional(),
});

type DematAccountForm = z.infer<typeof dematAccountSchema>;

interface DematAccount {
  id: string;
  dematAccountNumber: string;
  dematDpId: string;
  dematDpName: string;
  depositoryType: string;
  nsdlClientId?: string;
  cdslBoId?: string;
  accountHolderName: string;
  tradingAccountNumber?: string;
  brokerName?: string;
  panNumber?: string;
  isDefaultForEquityTransactions: boolean;
  isDefaultForMutualFundTransactions: boolean;
  isActive: boolean;
  isVerified: boolean;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export function DematTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Fetch demat accounts
  const { data: dematAccounts, isLoading } = useQuery<DematAccount[]>({
    queryKey: ["/api/demat-accounts"],
  });

  const form = useForm<DematAccountForm>({
    resolver: zodResolver(dematAccountSchema),
    defaultValues: {
      dematAccountNumber: "",
      dematDpId: "",
      dematDpName: "",
      depositoryType: "NSDL",
      nsdlClientId: "",
      cdslBoId: "",
      accountHolderName: "",
      tradingAccountNumber: "",
      brokerName: "",
      panNumber: "",
    },
  });

  // Add new demat account mutation
  const addAccountMutation = useMutation({
    mutationFn: (data: DematAccountForm) => apiRequest("POST", "/api/demat-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demat-accounts"] });
      setIsAddingAccount(false);
      form.reset();
      toast({
        title: "Success",
        description: "Demat account added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add demat account",
        variant: "destructive",
      });
    },
  });

  // Update demat account mutation
  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DematAccountForm }) => 
      apiRequest("PUT", `/api/demat-accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demat-accounts"] });
      setEditingAccountId(null);
      form.reset();
      toast({
        title: "Success",
        description: "Demat account updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update demat account",
        variant: "destructive",
      });
    },
  });

  // Delete demat account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/demat-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demat-accounts"] });
      toast({
        title: "Success",
        description: "Demat account removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove demat account",
        variant: "destructive",
      });
    },
  });

  // Set default demat account mutation
  const setDefaultMutation = useMutation({
    mutationFn: ({ accountId, defaultType }: { accountId: string; defaultType: 'equity' | 'mutualFunds' }) => 
      apiRequest("PUT", `/api/demat-accounts/${accountId}/set-default`, { defaultType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demat-accounts"] });
      toast({
        title: "Success",
        description: "Default account updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default account",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: DematAccountForm) => {
    if (editingAccountId) {
      updateAccountMutation.mutate({ id: editingAccountId, data });
    } else {
      addAccountMutation.mutate(data);
    }
  };

  const handleEdit = (account: DematAccount) => {
    setEditingAccountId(account.id);
    setIsAddingAccount(true);
    form.reset({
      dematAccountNumber: account.dematAccountNumber,
      dematDpId: account.dematDpId,
      dematDpName: account.dematDpName,
      depositoryType: account.depositoryType as any,
      nsdlClientId: account.nsdlClientId || "",
      cdslBoId: account.cdslBoId || "",
      accountHolderName: account.accountHolderName,
      tradingAccountNumber: account.tradingAccountNumber || "",
      brokerName: account.brokerName || "",
      panNumber: account.panNumber || "",
    });
  };

  const handleCancel = () => {
    setIsAddingAccount(false);
    setEditingAccountId(null);
    form.reset();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to remove this demat account?")) {
      deleteAccountMutation.mutate(id);
    }
  };

  const handleSetDefault = (accountId: string, defaultType: 'equity' | 'mutualFunds') => {
    setDefaultMutation.mutate({ accountId, defaultType });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demat Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6">
            <div className="text-sm text-muted-foreground">Loading demat accounts...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Demat Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Manage your demat accounts for securities trading
          </p>
        </div>
        <Button
          onClick={() => setIsAddingAccount(true)}
          className="flex items-center gap-2"
          data-testid="button-add-demat-account"
        >
          <Plus className="h-4 w-4" />
          Add Demat Account
        </Button>
      </div>

      {dematAccounts && dematAccounts.length >= 3 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have reached the maximum limit of 3 demat accounts per client.
          </AlertDescription>
        </Alert>
      )}

      {isAddingAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {editingAccountId ? "Edit Demat Account" : "Add New Demat Account"}
            </CardTitle>
            <CardDescription>
              {editingAccountId ? "Update your demat account details" : "Enter your demat account information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Basic Demat Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dematAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Demat Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter demat account number" {...field} data-testid="input-demat-account-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account holder name" {...field} data-testid="input-account-holder-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Depository Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="depositoryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depository Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-depository-type">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select depository" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="NSDL">NSDL (National Securities Depository Limited)</SelectItem>
                            <SelectItem value="CDSL">CDSL (Central Depository Services Limited)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dematDpId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DP ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter DP ID" {...field} data-testid="input-dp-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dematDpName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depository Participant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter DP name (e.g., ICICI Securities)" {...field} data-testid="input-dp-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Conditional Fields based on Depository Type */}
                {form.watch("depositoryType") === "NSDL" && (
                  <FormField
                    control={form.control}
                    name="nsdlClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NSDL Client ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter NSDL Client ID (16 digits)" {...field} data-testid="input-nsdl-client-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("depositoryType") === "CDSL" && (
                  <FormField
                    control={form.control}
                    name="cdslBoId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CDSL BO ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter CDSL BO ID (16 digits)" {...field} data-testid="input-cdsl-bo-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Additional Trading Info */}
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Trading Information (Optional)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tradingAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trading Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter trading account number" {...field} data-testid="input-trading-account-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brokerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Broker Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter broker name" {...field} data-testid="input-broker-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter PAN number (e.g., ABCDE1234F)" {...field} data-testid="input-pan-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={addAccountMutation.isPending || updateAccountMutation.isPending}
                    data-testid="button-save-demat-account"
                  >
                    {addAccountMutation.isPending || updateAccountMutation.isPending
                      ? editingAccountId ? "Updating..." : "Adding..."
                      : editingAccountId ? "Update Account" : "Add Account"
                    }
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Existing Demat Accounts */}
      {dematAccounts && dematAccounts.length > 0 ? (
        <div className="grid gap-4">
          {dematAccounts.map((account) => (
            <Card key={account.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" />
                      {account.dematDpName}
                      {account.isVerified && (
                        <Badge variant="secondary" className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {!account.isVerified && (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending Verification
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {account.depositoryType} • DP ID: {account.dematDpId}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(account)} data-testid={`button-edit-demat-${account.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)} data-testid={`button-delete-demat-${account.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Account Number:</span>
                    <div className="text-muted-foreground">{account.dematAccountNumber}</div>
                  </div>
                  <div>
                    <span className="font-medium">Account Holder:</span>
                    <div className="text-muted-foreground">{account.accountHolderName}</div>
                  </div>
                  {account.depositoryType === "NSDL" && account.nsdlClientId && (
                    <div>
                      <span className="font-medium">NSDL Client ID:</span>
                      <div className="text-muted-foreground">{account.nsdlClientId}</div>
                    </div>
                  )}
                  {account.depositoryType === "CDSL" && account.cdslBoId && (
                    <div>
                      <span className="font-medium">CDSL BO ID:</span>
                      <div className="text-muted-foreground">{account.cdslBoId}</div>
                    </div>
                  )}
                  {account.tradingAccountNumber && (
                    <div>
                      <span className="font-medium">Trading Account:</span>
                      <div className="text-muted-foreground">{account.tradingAccountNumber}</div>
                    </div>
                  )}
                  {account.brokerName && (
                    <div>
                      <span className="font-medium">Broker:</span>
                      <div className="text-muted-foreground">{account.brokerName}</div>
                    </div>
                  )}
                </div>

                {/* Default Account Selection */}
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Default Account Settings</h4>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`equity-default-${account.id}`}
                        checked={account.isDefaultForEquityTransactions}
                        onCheckedChange={() => handleSetDefault(account.id, 'equity')}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`checkbox-equity-default-${account.id}`}
                      />
                      <label
                        htmlFor={`equity-default-${account.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                      >
                        Default for Equity Trading
                        {account.isDefaultForEquityTransactions && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`mf-default-${account.id}`}
                        checked={account.isDefaultForMutualFundTransactions}
                        onCheckedChange={() => handleSetDefault(account.id, 'mutualFunds')}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`checkbox-mf-default-${account.id}`}
                      />
                      <label
                        htmlFor={`mf-default-${account.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                      >
                        Default for Mutual Funds
                        {account.isDefaultForMutualFundTransactions && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Demat Accounts</h3>
            <p className="text-center text-muted-foreground mb-4 max-w-md">
              You haven't added any demat accounts yet. Add your first demat account to start securities trading.
            </p>
            <Button onClick={() => setIsAddingAccount(true)} data-testid="button-add-first-demat-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Demat Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}