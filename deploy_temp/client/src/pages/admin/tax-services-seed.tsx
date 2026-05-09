import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, RefreshCw, Save, FileText, Calculator, IndianRupee, Clock, Users } from "lucide-react";

interface ItrPricingConfig {
  id: string;
  itrFormType: string;
  displayName: string;
  description: string | null;
  selfFileFee: string;
  selfFileGst: string;
  caAssistedFee: string;
  caAssistedGst: string;
  caRevenueSharePercent: string;
  expertConsultationFee: string;
  rushFilingFee: string;
  lateFeeMultiplier: string;
  complexityLevel: string;
  estimatedProcessingDays: number;
  eligibleForSelfFile: boolean;
  requiresCa: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

const defaultFormValues = {
  itrFormType: "",
  displayName: "",
  description: "",
  selfFileFee: "0",
  selfFileGst: "0",
  caAssistedFee: "0",
  caAssistedGst: "0",
  caRevenueSharePercent: "50",
  expertConsultationFee: "0",
  rushFilingFee: "0",
  lateFeeMultiplier: "1.0",
  complexityLevel: "standard",
  estimatedProcessingDays: 3,
  eligibleForSelfFile: true,
  requiresCa: false,
  isActive: true,
};

const ITR_FORM_TYPES = [
  { value: "ITR-1", label: "ITR-1 (Sahaj)", description: "Salary, One House Property, Other Sources" },
  { value: "ITR-2", label: "ITR-2", description: "Salary, Capital Gains, Multiple Properties, Foreign Assets" },
  { value: "ITR-3", label: "ITR-3", description: "Business/Profession Income (Non-Presumptive)" },
  { value: "ITR-4", label: "ITR-4 (Sugam)", description: "Presumptive Business Income (44AD/44ADA)" },
  { value: "ITR-5", label: "ITR-5", description: "LLPs, AOPs, BOIs, Cooperative Societies" },
  { value: "ITR-6", label: "ITR-6", description: "Companies (except Section 11)" },
  { value: "ITR-7", label: "ITR-7", description: "Trusts, Political Parties, Institutions" },
];

const COMPLEXITY_LEVELS = [
  { value: "simple", label: "Simple", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" },
  { value: "standard", label: "Standard", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200" },
  { value: "complex", label: "Complex", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200" },
];

export default function TaxServicesSeed() {
  const { toast } = useToast();
  const [editingConfig, setEditingConfig] = useState<ItrPricingConfig | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValues);

  const { data: pricingConfigsResponse, isLoading } = useQuery<{ success: boolean; data: ItrPricingConfig[] }>({
    queryKey: ["/api/admin/tax-services/pricing"],
  });
  
  const pricingConfigs = pricingConfigsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof defaultFormValues) => {
      return apiRequest("/api/admin/tax-services/pricing", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-services/pricing"] });
      setShowAddDialog(false);
      setFormValues(defaultFormValues);
      toast({ title: "Success", description: "Tax service pricing created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof defaultFormValues> }) => {
      return apiRequest(`/api/admin/tax-services/pricing/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-services/pricing"] });
      setEditingConfig(null);
      toast({ title: "Success", description: "Tax service pricing updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/tax-services/pricing/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-services/pricing"] });
      toast({ title: "Success", description: "Tax service pricing deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/tax-services/pricing/seed", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-services/pricing"] });
      toast({ title: "Success", description: "Default tax service pricing seeded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
  };

  const getComplexityBadge = (level: string) => {
    const config = COMPLEXITY_LEVELS.find(c => c.value === level) || COMPLEXITY_LEVELS[1];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleEdit = (config: ItrPricingConfig) => {
    setEditingConfig(config);
    setFormValues({
      itrFormType: config.itrFormType,
      displayName: config.displayName,
      description: config.description || "",
      selfFileFee: config.selfFileFee,
      selfFileGst: config.selfFileGst,
      caAssistedFee: config.caAssistedFee,
      caAssistedGst: config.caAssistedGst,
      caRevenueSharePercent: config.caRevenueSharePercent,
      expertConsultationFee: config.expertConsultationFee,
      rushFilingFee: config.rushFilingFee,
      lateFeeMultiplier: config.lateFeeMultiplier,
      complexityLevel: config.complexityLevel,
      estimatedProcessingDays: config.estimatedProcessingDays,
      eligibleForSelfFile: config.eligibleForSelfFile,
      requiresCa: config.requiresCa,
      isActive: config.isActive,
    });
  };

  const handleSave = () => {
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formValues });
    } else {
      createMutation.mutate(formValues);
    }
  };

  const PricingForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>ITR Form Type</Label>
          <Select
            value={formValues.itrFormType}
            onValueChange={(value) => {
              const formType = ITR_FORM_TYPES.find(f => f.value === value);
              setFormValues({
                ...formValues,
                itrFormType: value,
                displayName: formType?.label || value,
                description: formType?.description || "",
              });
            }}
            disabled={!!editingConfig}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ITR Form" />
            </SelectTrigger>
            <SelectContent>
              {ITR_FORM_TYPES.map((form) => (
                <SelectItem key={form.value} value={form.value}>
                  {form.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Display Name</Label>
          <Input
            value={formValues.displayName}
            onChange={(e) => setFormValues({ ...formValues, displayName: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formValues.description}
          onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
          rows={2}
        />
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Self-File Pricing
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Self-File Fee (₹)</Label>
            <Input
              type="number"
              value={formValues.selfFileFee}
              onChange={(e) => setFormValues({ ...formValues, selfFileFee: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>GST (₹)</Label>
            <Input
              type="number"
              value={formValues.selfFileGst}
              onChange={(e) => setFormValues({ ...formValues, selfFileGst: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          CA-Assisted Pricing
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CA-Assisted Fee (₹)</Label>
            <Input
              type="number"
              value={formValues.caAssistedFee}
              onChange={(e) => setFormValues({ ...formValues, caAssistedFee: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>GST (₹)</Label>
            <Input
              type="number"
              value={formValues.caAssistedGst}
              onChange={(e) => setFormValues({ ...formValues, caAssistedGst: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>CA Revenue Share (%)</Label>
            <Input
              type="number"
              value={formValues.caRevenueSharePercent}
              onChange={(e) => setFormValues({ ...formValues, caRevenueSharePercent: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Additional Charges
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Expert Consultation (₹)</Label>
            <Input
              type="number"
              value={formValues.expertConsultationFee}
              onChange={(e) => setFormValues({ ...formValues, expertConsultationFee: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Rush Filing Fee (₹)</Label>
            <Input
              type="number"
              value={formValues.rushFilingFee}
              onChange={(e) => setFormValues({ ...formValues, rushFilingFee: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Late Fee Multiplier</Label>
            <Input
              type="number"
              step="0.1"
              value={formValues.lateFeeMultiplier}
              onChange={(e) => setFormValues({ ...formValues, lateFeeMultiplier: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Configuration
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Complexity Level</Label>
            <Select
              value={formValues.complexityLevel}
              onValueChange={(value) => setFormValues({ ...formValues, complexityLevel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLEXITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Processing Days</Label>
            <Input
              type="number"
              value={formValues.estimatedProcessingDays}
              onChange={(e) => setFormValues({ ...formValues, estimatedProcessingDays: parseInt(e.target.value) || 3 })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={formValues.eligibleForSelfFile}
              onCheckedChange={(checked) => setFormValues({ ...formValues, eligibleForSelfFile: checked })}
            />
            <Label>Eligible for Self-File</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={formValues.requiresCa}
              onCheckedChange={(checked) => setFormValues({ ...formValues, requiresCa: checked })}
            />
            <Label>Requires CA</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={formValues.isActive}
              onCheckedChange={(checked) => setFormValues({ ...formValues, isActive: checked })}
            />
            <Label>Active</Label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Services Pricing</h1>
          <p className="text-muted-foreground">Configure ITR filing and tax service charges</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => seedDefaultsMutation.mutate()}
            disabled={seedDefaultsMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${seedDefaultsMutation.isPending ? 'animate-spin' : ''}`} />
            Seed Defaults
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { setFormValues(defaultFormValues); setEditingConfig(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pricing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Tax Service Pricing</DialogTitle>
                <DialogDescription>Configure pricing for a new ITR form type</DialogDescription>
              </DialogHeader>
              <PricingForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Pricing"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Detailed View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="space-y-2">
                    <div className="h-5 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : pricingConfigs?.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Tax Services Configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "Seed Defaults" to add standard ITR pricing or add manually
                  </p>
                </CardContent>
              </Card>
            ) : (
              pricingConfigs?.map((config) => (
                <Card key={config.id} className={!config.isActive ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{config.displayName}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getComplexityBadge(config.complexityLevel)}
                        {!config.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                    </div>
                    <CardDescription className="text-xs">{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Self-File:</span>
                        <span className="ml-2 font-medium">{formatCurrency(config.selfFileFee)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CA-Assisted:</span>
                        <span className="ml-2 font-medium">{formatCurrency(config.caAssistedFee)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{config.estimatedProcessingDays} days</span>
                      <span>CA Share: {config.caRevenueSharePercent}%</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(config)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(config.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ITR Form</TableHead>
                    <TableHead>Self-File</TableHead>
                    <TableHead>CA-Assisted</TableHead>
                    <TableHead>CA Share</TableHead>
                    <TableHead>Rush Fee</TableHead>
                    <TableHead>Complexity</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingConfigs?.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.itrFormType}</TableCell>
                      <TableCell>{formatCurrency(config.selfFileFee)}</TableCell>
                      <TableCell>{formatCurrency(config.caAssistedFee)}</TableCell>
                      <TableCell>{config.caRevenueSharePercent}%</TableCell>
                      <TableCell>{formatCurrency(config.rushFilingFee)}</TableCell>
                      <TableCell>{getComplexityBadge(config.complexityLevel)}</TableCell>
                      <TableCell>{config.estimatedProcessingDays}</TableCell>
                      <TableCell>
                        <Badge variant={config.isActive ? "default" : "secondary"}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tax Service Pricing</DialogTitle>
            <DialogDescription>Update pricing for {editingConfig?.displayName}</DialogDescription>
          </DialogHeader>
          <PricingForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
