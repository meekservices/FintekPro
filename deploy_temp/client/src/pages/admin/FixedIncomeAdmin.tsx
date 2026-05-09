import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, Edit, Trash2, Search, Filter, Download, Upload,
  Landmark, Building2, Coins, Receipt, AlertCircle, CheckCircle2,
  RefreshCw, Eye, FileText, Calendar, TrendingUp, Handshake, ShoppingCart, Store
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

interface Bond {
  id: string;
  isin: string;
  securityName: string;
  issuer: string;
  couponRate: number;
  yieldToMaturity: number | null;
  faceValue: number;
  currentPrice: number | null;
  maturityDate: string;
  securityType: string;
  creditRating: string | null;
  taxStatus: string;
  bondType: 'government' | 'corporate';
  isActive: boolean;
}

interface NcdIssue {
  id: string;
  issueCode: string;
  issuer: string;
  issueSize: number;
  pricePerNcd: number;
  couponRate: number;
  tenure: number;
  tenureUnit: string;
  creditRating: string;
  issueOpenDate: string;
  issueCloseDate: string;
  status: string;
  isActive: boolean;
}

interface SgbIssue {
  id: string;
  seriesName: string;
  tranche: string;
  issueDate: string;
  subscriptionOpenDate: string;
  subscriptionCloseDate: string;
  issuePrice: number;
  goldPriceReference: number;
  maturityDate: string;
  interestRate: number;
  minQuantity: number;
  maxQuantity: number;
  status: string;
  isActive: boolean;
}

function BondForm({ bond, onSubmit, onCancel, isLoading }: {
  bond?: Bond | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm({
    defaultValues: {
      isin: bond?.isin || '',
      securityName: bond?.securityName || '',
      issuer: bond?.issuer || '',
      bondType: bond?.bondType || 'corporate',
      securityType: bond?.securityType || 'ncd',
      faceValue: bond?.faceValue?.toString() || '1000',
      currentPrice: bond?.currentPrice?.toString() || '',
      couponRate: bond?.couponRate?.toString() || '',
      yieldToMaturity: bond?.yieldToMaturity?.toString() || '',
      maturityDate: bond?.maturityDate?.split('T')[0] || '',
      creditRating: bond?.creditRating || '',
      taxStatus: bond?.taxStatus || 'taxable',
      isActive: bond?.isActive ?? true,
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="isin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ISIN</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="INE001A07001" data-testid="input-isin" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="securityName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Bond/NCD Name" data-testid="input-security-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="issuer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Issuer</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Company/Institution name" data-testid="input-issuer" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bondType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bond Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-bond-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="securityType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Security Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-security-type">
                      <SelectValue placeholder="Select security type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="g_sec">G-Sec</SelectItem>
                    <SelectItem value="t_bill">T-Bill</SelectItem>
                    <SelectItem value="sdl">SDL</SelectItem>
                    <SelectItem value="ncd">NCD</SelectItem>
                    <SelectItem value="corporate_bond">Corporate Bond</SelectItem>
                    <SelectItem value="debenture">Debenture</SelectItem>
                    <SelectItem value="infrastructure_bond">Infrastructure Bond</SelectItem>
                    <SelectItem value="tax_free_bond">Tax Free Bond</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="faceValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Face Value (₹)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="1000" data-testid="input-face-value" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Price (₹)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="1050" data-testid="input-current-price" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="couponRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coupon Rate (%)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="8.5" data-testid="input-coupon-rate" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="yieldToMaturity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>YTM (%)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="7.8" data-testid="input-ytm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maturityDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maturity Date</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-maturity-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="creditRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Credit Rating</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-credit-rating">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AAA">AAA</SelectItem>
                    <SelectItem value="AA+">AA+</SelectItem>
                    <SelectItem value="AA">AA</SelectItem>
                    <SelectItem value="AA-">AA-</SelectItem>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="BBB+">BBB+</SelectItem>
                    <SelectItem value="BBB">BBB</SelectItem>
                    <SelectItem value="sovereign">Sovereign</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="taxStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-tax-status">
                      <SelectValue placeholder="Select tax status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="taxable">Taxable</SelectItem>
                    <SelectItem value="tax_free">Tax Free</SelectItem>
                    <SelectItem value="section_54EC">Section 54EC</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <FormDescription className="text-xs">
                    Make this bond available for trading
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-is-active"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="btn-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="btn-save-bond">
            {isLoading ? "Saving..." : bond ? "Update Bond" : "Add Bond"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function NcdIssueForm({ issue, onSubmit, onCancel, isLoading }: {
  issue?: NcdIssue | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const form = useForm({
    defaultValues: {
      issueCode: issue?.issueCode || '',
      issuer: issue?.issuer || '',
      issueSize: issue?.issueSize?.toString() || '',
      pricePerNcd: issue?.pricePerNcd?.toString() || '1000',
      couponRate: issue?.couponRate?.toString() || '',
      tenure: issue?.tenure?.toString() || '',
      tenureUnit: issue?.tenureUnit || 'years',
      creditRating: issue?.creditRating || '',
      issueOpenDate: issue?.issueOpenDate?.split('T')[0] || '',
      issueCloseDate: issue?.issueCloseDate?.split('T')[0] || '',
      status: issue?.status || 'upcoming',
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="issueCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Code</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="NCD-2025-001" data-testid="input-issue-code" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issuer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issuer</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Company name" data-testid="input-ncd-issuer" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="issueSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Size (₹)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="500000000" data-testid="input-issue-size" />
                </FormControl>
                <FormDescription className="text-xs">Total issue amount in rupees</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pricePerNcd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price Per NCD (₹)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="1000" data-testid="input-price-per-ncd" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="couponRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coupon Rate (%)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="9.5" data-testid="input-ncd-coupon" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="tenure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tenure</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="5" data-testid="input-tenure" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tenureUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tenure Unit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-tenure-unit">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="creditRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Credit Rating</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ncd-rating">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AAA">AAA</SelectItem>
                    <SelectItem value="AA+">AA+</SelectItem>
                    <SelectItem value="AA">AA</SelectItem>
                    <SelectItem value="AA-">AA-</SelectItem>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="issueOpenDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Open Date</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-issue-open-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issueCloseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Close Date</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-issue-close-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ncd-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="allotted">Allotted</SelectItem>
                    <SelectItem value="listed">Listed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="btn-cancel-ncd">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="btn-save-ncd">
            {isLoading ? "Saving..." : issue ? "Update NCD Issue" : "Add NCD Issue"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function BondsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showBondDialog, setShowBondDialog] = useState(false);
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const { toast } = useToast();

  const { data: bondsData, isLoading } = useQuery<{
    bonds: Bond[];
    total: number;
  }>({
    queryKey: ['/api/fixed-income/bonds'],
  });

  const saveBondMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedBond) {
        return apiRequest(`/api/fixed-income/admin/bonds/${selectedBond.id}`, { 
          method: 'PUT', 
          body: JSON.stringify(data) 
        });
      }
      return apiRequest('/api/fixed-income/admin/bonds', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      });
    },
    onSuccess: () => {
      toast({
        title: selectedBond ? "Bond Updated" : "Bond Added",
        description: selectedBond ? "Bond has been updated successfully" : "New bond has been added to the marketplace",
      });
      setShowBondDialog(false);
      setSelectedBond(null);
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/bonds'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save bond",
      });
    }
  });

  const handleEdit = (bond: Bond) => {
    setSelectedBond(bond);
    setShowBondDialog(true);
  };

  const handleAdd = () => {
    setSelectedBond(null);
    setShowBondDialog(true);
  };

  const filteredBonds = (bondsData?.bonds || []).filter(bond => 
    !searchTerm || 
    bond.securityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bond.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bond.isin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState variant="list" count={5} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search bonds..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-bonds"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="btn-refresh-bonds">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Catalog
          </Button>
          <Button onClick={handleAdd} data-testid="btn-add-bond">
            <Plus className="h-4 w-4 mr-2" />
            Add Bond
          </Button>
        </div>
      </div>

      {filteredBonds.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bonds found"
          description="Add bonds to start building your marketplace catalog"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISIN</TableHead>
                <TableHead>Security Name</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Coupon</TableHead>
                <TableHead className="text-right">YTM</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBonds.map((bond) => (
                <TableRow key={bond.id} data-testid={`bond-row-${bond.isin}`}>
                  <TableCell className="font-mono text-sm">{bond.isin}</TableCell>
                  <TableCell className="font-medium">{bond.securityName}</TableCell>
                  <TableCell>{bond.issuer}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{bond.bondType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{bond.couponRate}%</TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    {bond.yieldToMaturity?.toFixed(2) || '-'}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      bond.creditRating?.startsWith('AAA') ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' :
                      bond.creditRating?.startsWith('AA') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' :
                      bond.creditRating?.startsWith('A') ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' :
                      'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                    }>
                      {bond.creditRating || 'Unrated'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={bond.isActive ? "default" : "secondary"}>
                      {bond.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(bond)} data-testid={`btn-edit-${bond.isin}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showBondDialog} onOpenChange={(open) => !open && setShowBondDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBond ? "Edit Bond" : "Add New Bond"}</DialogTitle>
            <DialogDescription>
              {selectedBond ? "Update bond details" : "Add a new bond to the marketplace catalog"}
            </DialogDescription>
          </DialogHeader>
          <BondForm
            bond={selectedBond}
            onSubmit={(data) => saveBondMutation.mutate(data)}
            onCancel={() => setShowBondDialog(false)}
            isLoading={saveBondMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NcdManagement() {
  const [showNcdDialog, setShowNcdDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<NcdIssue | null>(null);
  const { toast } = useToast();

  const { data: issues, isLoading } = useQuery<NcdIssue[]>({
    queryKey: ['/api/fixed-income/ncd-issues'],
  });

  const saveNcdMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedIssue) {
        return apiRequest(`/api/fixed-income/admin/ncd-issues/${selectedIssue.id}`, { 
          method: 'PUT', 
          body: JSON.stringify(data) 
        });
      }
      return apiRequest('/api/fixed-income/admin/ncd-issues', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      });
    },
    onSuccess: () => {
      toast({
        title: selectedIssue ? "NCD Issue Updated" : "NCD Issue Added",
        description: selectedIssue ? "NCD issue has been updated" : "New NCD issue has been created",
      });
      setShowNcdDialog(false);
      setSelectedIssue(null);
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/ncd-issues'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save NCD issue",
      });
    }
  });

  const handleAdd = () => {
    setSelectedIssue(null);
    setShowNcdDialog(true);
  };

  const handleEdit = (issue: NcdIssue) => {
    setSelectedIssue(issue);
    setShowNcdDialog(true);
  };

  if (isLoading) {
    return <LoadingState variant="list" count={3} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">NCD Public Issues</h3>
        <Button onClick={handleAdd} data-testid="btn-add-ncd">
          <Plus className="h-4 w-4 mr-2" />
          Add NCD Issue
        </Button>
      </div>

      {!issues || issues.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No NCD issues"
          description="Create NCD issues when companies announce public NCDs"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue Code</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead className="text-right">Issue Size</TableHead>
                <TableHead className="text-right">Coupon</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Open/Close</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.id} data-testid={`ncd-row-${issue.issueCode}`}>
                  <TableCell className="font-mono">{issue.issueCode}</TableCell>
                  <TableCell className="font-medium">{issue.issuer}</TableCell>
                  <TableCell className="text-right">₹{(issue.issueSize / 10000000).toFixed(0)} Cr</TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">{issue.couponRate}%</TableCell>
                  <TableCell>{issue.tenure} {issue.tenureUnit}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">{issue.creditRating}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(issue.issueOpenDate).toLocaleDateString()} - {new Date(issue.issueCloseDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={issue.status === 'open' ? "default" : "secondary"}>
                      {issue.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(issue)} data-testid={`btn-edit-ncd-${issue.issueCode}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showNcdDialog} onOpenChange={(open) => !open && setShowNcdDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedIssue ? "Edit NCD Issue" : "Add NCD Issue"}</DialogTitle>
            <DialogDescription>
              {selectedIssue ? "Update NCD issue details" : "Create a new public NCD issue"}
            </DialogDescription>
          </DialogHeader>
          <NcdIssueForm
            issue={selectedIssue}
            onSubmit={(data) => saveNcdMutation.mutate(data)}
            onCancel={() => setShowNcdDialog(false)}
            isLoading={saveNcdMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SgbManagement() {
  const { data: issues, isLoading } = useQuery<SgbIssue[]>({
    queryKey: ['/api/fixed-income/sgb-issues'],
  });

  if (isLoading) {
    return <LoadingState variant="list" count={3} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sovereign Gold Bond Issues</h3>
        <Button variant="outline" data-testid="btn-sync-sgb">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync from RBI
        </Button>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <Coins className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">RBI Managed</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          SGB issues are announced by RBI. Use sync to fetch latest issue details from official sources.
        </AlertDescription>
      </Alert>

      {!issues || issues.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No SGB issues"
          description="SGB issues will appear here when synced from RBI"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.map((issue) => (
            <Card key={issue.id} data-testid={`sgb-admin-${issue.seriesName}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{issue.seriesName}</CardTitle>
                  <Badge variant={issue.status === 'open' ? "default" : "secondary"}>{issue.status}</Badge>
                </div>
                <CardDescription>Tranche: {issue.tranche}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Issue Price:</span>
                    <span className="font-semibold ml-2">₹{issue.issuePrice}/gm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Interest:</span>
                    <span className="font-semibold ml-2">{issue.interestRate}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Opens:</span>
                    <span className="font-semibold ml-2">{new Date(issue.subscriptionOpenDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Closes:</span>
                    <span className="font-semibold ml-2">{new Date(issue.subscriptionCloseDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersOverview() {
  const { data: orders, isLoading } = useQuery<Array<{
    id: string;
    userId: string;
    orderType: string;
    bondId: string;
    quantity: number;
    price: number;
    status: string;
    createdAt: string;
  }>>({
    queryKey: ['/api/fixed-income/admin/orders'],
  });

  if (isLoading) {
    return <LoadingState variant="list" count={5} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Recent Orders</h3>
        <Button variant="outline" size="sm" data-testid="btn-export-orders">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No orders yet"
          description="Orders will appear here when users start trading"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Bond</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}...</TableCell>
                  <TableCell className="font-mono text-sm">{order.userId.slice(0, 8)}...</TableCell>
                  <TableCell>{order.bondId.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={order.orderType === 'buy' ? "default" : "secondary"}>
                      {order.orderType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{order.quantity}</TableCell>
                  <TableCell className="text-right">₹{order.price.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={
                      order.status === 'executed' ? "default" :
                      order.status === 'pending' ? "outline" :
                      "secondary"
                    }>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AuditLogsView() {
  const { data: logsData, isLoading } = useQuery<Array<{
    id: string;
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    eventDetails: any;
    createdAt: string;
  }>>({
    queryKey: ['/api/fixed-income/admin/audit-logs'],
  });

  const logs = Array.isArray(logsData) ? logsData : [];

  if (isLoading) {
    return <LoadingState variant="list" count={10} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Audit Trail</h3>
        <div className="flex gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]" data-testid="select-event-type">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="order_placed">Order Placed</SelectItem>
              <SelectItem value="order_executed">Order Executed</SelectItem>
              <SelectItem value="suitability_check">Suitability Check</SelectItem>
              <SelectItem value="kyc_update">KYC Update</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="btn-export-audit">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Compliance Logging</AlertTitle>
        <AlertDescription>
          All audit logs are retained for 7 years as per PMLA regulations. Logs cannot be deleted or modified.
        </AlertDescription>
      </Alert>

      {!logs || logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No audit logs"
          description="Activity logs will appear here when users interact with the marketplace"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-sm">{log.userId?.slice(0, 8) || 'system'}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.eventType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.entityType}: {log.entityId?.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {JSON.stringify(log.eventDetails)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface BondSellListing {
  id: string;
  sellerUserId: string;
  isin: string;
  bondName: string;
  bondType: string;
  quantity: number;
  askPrice: string;
  status: string;
  createdAt: string;
}

interface BondBuyRequest {
  id: string;
  buyerUserId: string;
  isin: string;
  bondName: string;
  bondType: string;
  quantity: number;
  maxPrice: string;
  status: string;
  createdAt: string;
}

function BondMarketplaceManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'sell' | 'buy' | 'deals'>('sell');

  const { data: sellListingsResponse, isLoading: loadingSell } = useQuery<{ success: boolean; data: BondSellListing[] }>({
    queryKey: ['/api/bonds/admin/listings'],
  });
  const sellListings = sellListingsResponse?.data || [];

  const { data: buyRequestsResponse, isLoading: loadingBuy } = useQuery<{ success: boolean; data: BondBuyRequest[] }>({
    queryKey: ['/api/bonds/admin/requests'],
  });
  const buyRequests = buyRequestsResponse?.data || [];

  const { data: statsResponse, isLoading: loadingStats } = useQuery<{ success: boolean; data: {
    totalSellListings: number;
    totalBuyRequests: number;
    totalDeals: number;
    activeSellListings: number;
    activeBuyRequests: number;
    pendingDeals: number;
    totalVolume: string;
  } }>({
    queryKey: ['/api/bonds/admin/stats'],
  });
  const stats = statsResponse?.data;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/bonds/admin/listings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/listings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/stats'] });
      toast({ title: 'Status updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    }
  });

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'active' });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'rejected' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bond Marketplace Management</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/listings'] });
            queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/stats'] });
          }} data-testid="btn-refresh-marketplace">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xl font-bold">{stats?.activeSellListings || 0}</p>
                <p className="text-sm text-muted-foreground">Active Sell Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xl font-bold">{stats?.activeBuyRequests || 0}</p>
                <p className="text-sm text-muted-foreground">Active Buy Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Handshake className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xl font-bold">{stats?.pendingDeals || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xl font-bold">₹{parseFloat(stats?.totalVolume || '0').toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Volume</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'sell' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('sell')}
          data-testid="btn-tab-sell"
        >
          <Store className="h-4 w-4 mr-2" />
          Sell Listings ({stats?.totalSellListings || 0})
        </Button>
        <Button
          variant={activeTab === 'buy' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('buy')}
          data-testid="btn-tab-buy"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Buy Requests ({stats?.totalBuyRequests || 0})
        </Button>
        <Button
          variant={activeTab === 'deals' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('deals')}
          data-testid="btn-tab-deals"
        >
          <Handshake className="h-4 w-4 mr-2" />
          Deals ({stats?.totalDeals || 0})
        </Button>
      </div>

      {/* Sell Listings Tab */}
      {activeTab === 'sell' && (
        <div>
          {loadingSell ? (
            <LoadingState variant="list" count={5} />
          ) : !sellListings || sellListings.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No sell listings"
              description="Bond sell listings will appear here when investors create them"
            />
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bond</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Ask Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellListings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">{listing.bondName}</TableCell>
                      <TableCell className="font-mono text-sm">{listing.isin}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{listing.bondType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{listing.quantity}</TableCell>
                      <TableCell className="text-right">₹{parseFloat(listing.askPrice).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          listing.status === 'active' ? 'default' :
                          listing.status === 'pending' ? 'outline' :
                          listing.status === 'matched' ? 'secondary' :
                          'destructive'
                        }>
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(listing.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {listing.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => handleApprove(listing.id)}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`btn-approve-${listing.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-red-600"
                                onClick={() => handleReject(listing.id)}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`btn-reject-${listing.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            data-testid={`btn-view-${listing.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Buy Requests Tab */}
      {activeTab === 'buy' && (
        <div>
          {loadingBuy ? (
            <LoadingState variant="list" count={5} />
          ) : !buyRequests || buyRequests.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No buy requests"
              description="Bond buy requests will appear here when investors create them"
            />
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bond</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Max Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.bondName}</TableCell>
                      <TableCell className="font-mono text-sm">{request.isin}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.bondType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{request.quantity}</TableCell>
                      <TableCell className="text-right">₹{parseFloat(request.maxPrice).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          request.status === 'active' ? 'default' :
                          request.status === 'pending' ? 'outline' :
                          request.status === 'matched' ? 'secondary' :
                          'destructive'
                        }>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          data-testid={`btn-view-request-${request.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Deals Tab */}
      {activeTab === 'deals' && (
        <div>
          <Alert className="mb-4">
            <Handshake className="h-4 w-4" />
            <AlertTitle>Deal Matching</AlertTitle>
            <AlertDescription>
              Match sell listings with buy requests to create deals. Ensure compliance checks are completed before approving.
            </AlertDescription>
          </Alert>
          <EmptyState
            icon={Handshake}
            title="No deals yet"
            description="Matched deals between sellers and buyers will appear here"
          />
        </div>
      )}
    </div>
  );
}

interface FixedIncomeAdminProps {
  defaultTab?: 'bonds' | 'ncd' | 'sgb' | 'orders' | 'audit' | 'marketplace';
}

export default function FixedIncomeAdmin({ defaultTab = 'bonds' }: FixedIncomeAdminProps) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fixed Income Administration</h1>
          <p className="text-muted-foreground">Manage bonds, NCDs, SGBs, and monitor marketplace activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Landmark className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Active Bonds</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Receipt className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Open NCDs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Coins className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">SGB Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Today's Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <ScrollableTabsList>
          <TabsTrigger value="bonds" data-testid="tab-admin-bonds">
            <Landmark className="h-4 w-4 mr-2" />
            Bonds
          </TabsTrigger>
          <TabsTrigger value="ncd" data-testid="tab-admin-ncd">
            <Receipt className="h-4 w-4 mr-2" />
            NCDs
          </TabsTrigger>
          <TabsTrigger value="sgb" data-testid="tab-admin-sgb">
            <Coins className="h-4 w-4 mr-2" />
            SGBs
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-admin-orders">
            <FileText className="h-4 w-4 mr-2" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-admin-audit">
            <Eye className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-admin-marketplace">
            <Handshake className="h-4 w-4 mr-2" />
            Bond Marketplace
          </TabsTrigger>
        </ScrollableTabsList>

        <div className="mt-6">
          <TabsContent value="bonds">
            <BondsManagement />
          </TabsContent>
          <TabsContent value="ncd">
            <NcdManagement />
          </TabsContent>
          <TabsContent value="sgb">
            <SgbManagement />
          </TabsContent>
          <TabsContent value="orders">
            <OrdersOverview />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogsView />
          </TabsContent>
          <TabsContent value="marketplace">
            <BondMarketplaceManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
