import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, Search, Loader2, ArrowLeft, Building2, Landmark, FileText, 
  TrendingUp, AlertTriangle, History, Eye, Shield, DollarSign, Percent,
  Plus, Upload, Download, Check, X, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface BondCatalogItem {
  id: string;
  source: string;
  sourceId?: string;
  isin: string;
  bondName: string;
  issuerName: string;
  instrumentType: string;
  isListed: boolean;
  exchange?: string;
  faceValue: string;
  couponRate?: string;
  couponFrequency?: string;
  issueDate?: string;
  maturityDate: string;
  cleanPrice?: string;
  yieldToMaturity?: string;
  creditRating?: string;
  ratingAgency?: string;
  minInvestment?: string;
  lotSize?: number;
  taxCategory: string;
  tdsApplicable: boolean;
  tdsRate?: string;
  status: string;
  publishedAt?: string;
  lastSyncAt?: string;
  kycTierRequired: string;
  feeProfileId?: string;
  feeProfile?: FeeProfile;
}

interface FeeProfile {
  id: string;
  instrumentType: string;
  name: string;
  retailBrokerageRate: string;
  hniBrokerageRate: string;
  institutionalBrokerageRate: string;
  retailBrokerageCap: string;
  hniBrokerageCap: string;
  institutionalBrokerageCap: string;
  platformFeeRate: string;
  platformFeeCap: string;
  gstRate: string;
  stampDutyApplicable: boolean;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  oldValues?: any;
  newValues?: any;
  performedBy: string;
  createdAt: string;
  ipAddress?: string;
  additionalInfo?: any;
}

interface NetYieldResult {
  grossYield: number;
  netYield: number;
  netYieldAfterTax: number;
  feeImpactBps: number;
  taxImpactBps: number;
  totalImpactBps: number;
  annualizedFeePercentage: number;
  breakdown: {
    platformFeeAnnualized: number;
    brokerageFeeAnnualized: number;
    transactionChargesAnnualized: number;
    gstAnnualized: number;
    stampDutyAnnualized: number;
  };
  regulatoryCompliant: boolean;
  violations: string[];
}

const INSTRUMENT_TYPES = [
  { value: 'gsec', label: 'Government Securities (G-Sec)', category: 'government' },
  { value: 'tbill', label: 'Treasury Bills (T-Bill)', category: 'government' },
  { value: 'sdl', label: 'State Development Loans (SDL)', category: 'government' },
  { value: 'sgb', label: 'Sovereign Gold Bonds (SGB)', category: 'government' },
  { value: 'corporate_bond', label: 'Corporate Bonds', category: 'corporate' },
  { value: 'ncd', label: 'Non-Convertible Debentures (NCD)', category: 'corporate' },
  { value: 'tax_free_bond', label: 'Tax-Free Bonds', category: 'corporate' },
  { value: 'infrastructure_bond', label: 'Infrastructure Bonds', category: 'corporate' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const KYC_TIER_COLORS: Record<string, string> = {
  basic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  enhanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  accredited: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export default function BondSeedAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("government");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBonds, setSelectedBonds] = useState<Set<string>>(new Set());
  const [publishDialog, setPublishDialog] = useState<{ open: boolean; bonds: BondCatalogItem[] }>({ open: false, bonds: [] });
  const [netYields, setNetYields] = useState<Record<string, NetYieldResult>>({});
  const [selectedSegment, setSelectedSegment] = useState<'retail' | 'hni' | 'institutional'>('retail');
  const [unlisistedDialog, setUnlistedDialog] = useState(false);
  const [newUnlistedBond, setNewUnlistedBond] = useState({
    isin: '',
    bondName: '',
    issuerName: '',
    instrumentType: 'corporate_bond',
    faceValue: '1000',
    couponRate: '',
    maturityDate: '',
    yieldToMaturity: '',
    minInvestment: '10000',
    lotSize: 1,
    creditRating: '',
    ratingAgency: '',
  });

  const { data: catalogData, isLoading: isLoadingCatalog, refetch: refetchCatalog } = useQuery<{ bonds: BondCatalogItem[] }>({
    queryKey: ['/api/admin/bond-seed/catalog'],
  });

  const { data: feeProfilesData, isLoading: isLoadingProfiles } = useQuery<{ profiles: FeeProfile[] }>({
    queryKey: ['/api/admin/bond-seed/fee-profiles'],
  });

  const { data: auditLogsData, isLoading: isLoadingLogs } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ['/api/admin/bond-seed/audit-logs'],
  });

  const bonds = catalogData?.bonds || [];
  const feeProfiles = feeProfilesData?.profiles || [];
  const auditLogs = auditLogsData?.logs || [];

  const governmentBonds = bonds.filter(b => ['gsec', 'tbill', 'sdl', 'sgb'].includes(b.instrumentType));
  const corporateBonds = bonds.filter(b => ['corporate_bond', 'ncd', 'tax_free_bond', 'infrastructure_bond'].includes(b.instrumentType));
  const unlistedBonds = bonds.filter(b => !b.isListed);

  const syncNseMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/bond-seed/sync/nse', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/audit-logs'] });
      toast({
        title: "NSE Sync Complete",
        description: `Synced ${data.synced || 0} new bonds, updated ${data.updated || 0} existing`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync from NSE",
        variant: "destructive",
      });
    },
  });

  const syncBseMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/bond-seed/sync/bse', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/audit-logs'] });
      toast({
        title: "BSE Sync Complete",
        description: `Synced ${data.synced || 0} new bonds, updated ${data.updated || 0} existing`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync from BSE",
        variant: "destructive",
      });
    },
  });

  const publishBondsMutation = useMutation({
    mutationFn: (bondIds: string[]) => apiRequest('/api/admin/bond-seed/publish', { 
      method: 'POST',
      body: JSON.stringify({ bondIds })
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/audit-logs'] });
      setSelectedBonds(new Set());
      setPublishDialog({ open: false, bonds: [] });
      toast({
        title: "Bonds Published",
        description: `${data.published || 0} bonds are now visible in the marketplace`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Publish Failed",
        description: error.message || "Failed to publish bonds",
        variant: "destructive",
      });
    },
  });

  const fetchNetYieldsMutation = useMutation({
    mutationFn: async ({ bondIds, investorSegment }: { bondIds: string[], investorSegment: string }) => {
      const response = await apiRequest('/api/admin/bond-seed/catalog/batch-net-yield', {
        method: 'POST',
        body: JSON.stringify({ bondIds, investorSegment })
      });
      return response as { netYields: Record<string, NetYieldResult> };
    },
    onSuccess: (data) => {
      setNetYields(data.netYields || {});
    },
    onError: (error: any) => {
      console.error("Error fetching net yields:", error);
    },
  });

  const unpublishBondMutation = useMutation({
    mutationFn: (bondId: string) => apiRequest(`/api/admin/bond-seed/catalog/${bondId}/unpublish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/audit-logs'] });
      toast({
        title: "Bond Unpublished",
        description: "Bond removed from marketplace",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unpublish bond",
        variant: "destructive",
      });
    },
  });

  const createUnlistedBondMutation = useMutation({
    mutationFn: (bond: typeof newUnlistedBond) => apiRequest('/api/admin/bond-seed/unlisted', { 
      method: 'POST',
      body: JSON.stringify(bond)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/catalog'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bond-seed/audit-logs'] });
      setUnlistedDialog(false);
      setNewUnlistedBond({
        isin: '', bondName: '', issuerName: '', instrumentType: 'corporate_bond',
        faceValue: '1000', couponRate: '', maturityDate: '', yieldToMaturity: '',
        minInvestment: '10000', lotSize: 1, creditRating: '', ratingAgency: '',
      });
      toast({
        title: "Unlisted Bond Created",
        description: "Bond added to catalog as draft",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create bond",
        variant: "destructive",
      });
    },
  });

  const handleSelectBond = (bondId: string, checked: boolean) => {
    const newSet = new Set(selectedBonds);
    if (checked) {
      newSet.add(bondId);
    } else {
      newSet.delete(bondId);
    }
    setSelectedBonds(newSet);
  };

  const handleSelectAll = (bonds: BondCatalogItem[], checked: boolean) => {
    const draftBonds = bonds.filter(b => b.status === 'draft');
    if (checked) {
      setSelectedBonds(new Set(draftBonds.map(b => b.id)));
    } else {
      setSelectedBonds(new Set());
    }
  };

  const handlePublishSelected = () => {
    const selectedBondItems = bonds.filter(b => selectedBonds.has(b.id) && b.status === 'draft');
    if (selectedBondItems.length > 0) {
      setPublishDialog({ open: true, bonds: selectedBondItems });
      // Fetch net yields for selected bonds
      fetchNetYieldsMutation.mutate({
        bondIds: selectedBondItems.map(b => b.id),
        investorSegment: selectedSegment
      });
    }
  };

  const handleSegmentChange = (segment: 'retail' | 'hni' | 'institutional') => {
    setSelectedSegment(segment);
    if (publishDialog.bonds.length > 0) {
      fetchNetYieldsMutation.mutate({
        bondIds: publishDialog.bonds.map(b => b.id),
        investorSegment: segment
      });
    }
  };

  const filteredBonds = (list: BondCatalogItem[]) => {
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(b => 
      b.bondName.toLowerCase().includes(query) ||
      b.isin.toLowerCase().includes(query) ||
      b.issuerName.toLowerCase().includes(query)
    );
  };

  const getFeeProfileForType = (instrumentType: string) => {
    return feeProfiles.find(p => p.instrumentType === instrumentType);
  };

  const renderBondTable = (bondsList: BondCatalogItem[], showSync: 'nse' | 'bse' | 'none') => {
    const filtered = filteredBonds(bondsList);
    const draftBonds = filtered.filter(b => b.status === 'draft');

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name, ISIN, issuer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[300px]"
                data-testid="input-search-bonds"
              />
              <Button variant="outline" size="icon" onClick={() => refetchCatalog()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {showSync === 'nse' && (
                <Button 
                  onClick={() => syncNseMutation.mutate()} 
                  disabled={syncNseMutation.isPending}
                  data-testid="button-sync-nse"
                >
                  {syncNseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Sync from NSE
                </Button>
              )}
              {showSync === 'bse' && (
                <Button 
                  onClick={() => syncBseMutation.mutate()} 
                  disabled={syncBseMutation.isPending}
                  data-testid="button-sync-bse"
                >
                  {syncBseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Sync from BSE
                </Button>
              )}
              {showSync === 'none' && (
                <Button onClick={() => setUnlistedDialog(true)} data-testid="button-add-unlisted">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Unlisted Bond
                </Button>
              )}
              {selectedBonds.size > 0 && draftBonds.length > 0 && (
                <Button onClick={handlePublishSelected} variant="default" data-testid="button-publish-selected">
                  <Check className="h-4 w-4 mr-2" />
                  Publish Selected ({selectedBonds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={draftBonds.length > 0 && selectedBonds.size === draftBonds.length}
                      onCheckedChange={(checked) => handleSelectAll(filtered, !!checked)}
                    />
                  </TableHead>
                  <TableHead>ISIN / Name</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Coupon</TableHead>
                  <TableHead className="text-right">YTM</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>KYC Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCatalog ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No bonds found. {showSync !== 'none' ? 'Try syncing from the exchange.' : 'Add an unlisted bond to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bond) => (
                    <TableRow key={bond.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedBonds.has(bond.id)}
                          onCheckedChange={(checked) => handleSelectBond(bond.id, !!checked)}
                          disabled={bond.status !== 'draft'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{bond.bondName}</div>
                        <div className="text-xs text-muted-foreground">{bond.isin}</div>
                      </TableCell>
                      <TableCell className="text-sm">{bond.issuerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {INSTRUMENT_TYPES.find(t => t.value === bond.instrumentType)?.label || bond.instrumentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {bond.couponRate ? `${parseFloat(bond.couponRate).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {bond.yieldToMaturity ? `${parseFloat(bond.yieldToMaturity).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {bond.cleanPrice ? `₹${parseFloat(bond.cleanPrice).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell>
                        {bond.creditRating && (
                          <Badge variant="secondary" className="text-xs">
                            {bond.creditRating}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={KYC_TIER_COLORS[bond.kycTierRequired] || 'bg-gray-100'}>
                          {bond.kycTierRequired}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[bond.status] || 'bg-gray-100'}>
                          {bond.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {bond.status === 'draft' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setPublishDialog({ open: true, bonds: [bond] });
                                fetchNetYieldsMutation.mutate({
                                  bondIds: [bond.id],
                                  investorSegment: selectedSegment
                                });
                              }}
                              data-testid={`button-publish-${bond.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Publish
                            </Button>
                          )}
                          {bond.status === 'published' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => unpublishBondMutation.mutate(bond.id)}
                              data-testid={`button-unpublish-${bond.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Unpublish
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const renderFeeProfilesTable = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fee Profiles (SEBI/RBI Regulatory Caps)
        </CardTitle>
        <CardDescription>
          Brokerage and platform fee configurations per instrument type. Rates cannot exceed regulatory caps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument Type</TableHead>
                <TableHead className="text-center">Retail Rate / Cap</TableHead>
                <TableHead className="text-center">HNI Rate / Cap</TableHead>
                <TableHead className="text-center">Institutional Rate / Cap</TableHead>
                <TableHead className="text-center">Platform Fee</TableHead>
                <TableHead className="text-center">GST</TableHead>
                <TableHead className="text-center">Stamp Duty</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingProfiles ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : feeProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No fee profiles configured. Default profiles will be created on first sync.
                  </TableCell>
                </TableRow>
              ) : (
                feeProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="font-medium">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">{profile.instrumentType}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm">{parseFloat(profile.retailBrokerageRate).toFixed(3)}%</div>
                      <div className="text-xs text-muted-foreground">max {parseFloat(profile.retailBrokerageCap).toFixed(3)}%</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm">{parseFloat(profile.hniBrokerageRate).toFixed(3)}%</div>
                      <div className="text-xs text-muted-foreground">max {parseFloat(profile.hniBrokerageCap).toFixed(3)}%</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm">{parseFloat(profile.institutionalBrokerageRate).toFixed(3)}%</div>
                      <div className="text-xs text-muted-foreground">max {parseFloat(profile.institutionalBrokerageCap).toFixed(3)}%</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm">{parseFloat(profile.platformFeeRate).toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">max {parseFloat(profile.platformFeeCap).toFixed(2)}%</div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {parseFloat(profile.gstRate).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {profile.stampDutyApplicable ? (
                        <Check className="h-4 w-4 mx-auto text-green-600" />
                      ) : (
                        <X className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.isActive ? "default" : "secondary"}>
                        {profile.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderAuditLogs = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Complete history of bond seed operations for compliance review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLogs ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit logs yet. Operations will be recorded here.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{log.entityName || log.entityId}</div>
                      <div className="text-xs text-muted-foreground">{log.entityType}</div>
                    </TableCell>
                    <TableCell className="text-sm">{log.performedBy}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.additionalInfo ? JSON.stringify(log.additionalInfo) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/store-management">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Bond Seed Administration</h1>
            <p className="text-muted-foreground">
              Ingest bonds from NSE/BSE, manage fee profiles, and publish to marketplace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Landmark className="h-3 w-3" />
            {governmentBonds.length} G-Secs
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {corporateBonds.length} Corporate
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {unlistedBonds.length} Unlisted
          </Badge>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Regulatory Compliance:</strong> All brokerage rates are capped as per SEBI/RBI guidelines. 
          Government securities: max 0.025% (G-Secs, SDLs), 0.0125% (T-Bills), 0.50% (SGBs). 
          Corporate bonds: max 0.50%. GST at 18% applies on brokerage.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="government" className="flex items-center gap-2" data-testid="tab-government">
            <Landmark className="h-4 w-4" />
            Government Securities
          </TabsTrigger>
          <TabsTrigger value="corporate" className="flex items-center gap-2" data-testid="tab-corporate">
            <Building2 className="h-4 w-4" />
            Corporate Bonds
          </TabsTrigger>
          <TabsTrigger value="unlisted" className="flex items-center gap-2" data-testid="tab-unlisted">
            <FileText className="h-4 w-4" />
            Unlisted Bonds
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-2" data-testid="tab-fees">
            <Percent className="h-4 w-4" />
            Fee Profiles
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2" data-testid="tab-audit">
            <History className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="government" className="mt-6">
          {renderBondTable(governmentBonds, 'nse')}
        </TabsContent>

        <TabsContent value="corporate" className="mt-6">
          {renderBondTable(corporateBonds, 'bse')}
        </TabsContent>

        <TabsContent value="unlisted" className="mt-6">
          {renderBondTable(unlistedBonds, 'none')}
        </TabsContent>

        <TabsContent value="fees" className="mt-6">
          {renderFeeProfilesTable()}
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          {renderAuditLogs()}
        </TabsContent>
      </Tabs>

      <Dialog open={publishDialog.open} onOpenChange={(open) => setPublishDialog({ ...publishDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Publish Bonds to Marketplace</DialogTitle>
            <DialogDescription>
              Review fee structure and net yields before publishing. Bonds will be visible to clients with appropriate KYC tier.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4 py-2 border-b">
            <Label className="text-sm font-medium">Investor Segment:</Label>
            <Select value={selectedSegment} onValueChange={(v) => handleSegmentChange(v as 'retail' | 'hni' | 'institutional')}>
              <SelectTrigger className="w-[180px]" data-testid="select-investor-segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="hni">HNI</SelectItem>
                <SelectItem value="institutional">Institutional</SelectItem>
              </SelectContent>
            </Select>
            {fetchNetYieldsMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              {publishDialog.bonds.map((bond) => {
                const profile = getFeeProfileForType(bond.instrumentType);
                const yieldData = netYields[bond.id];
                return (
                  <Card key={bond.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{bond.bondName}</h4>
                        <p className="text-sm text-muted-foreground">{bond.isin} | {bond.issuerName}</p>
                      </div>
                      <Badge className={KYC_TIER_COLORS[bond.kycTierRequired]}>
                        {bond.kycTierRequired} KYC required
                      </Badge>
                    </div>
                    
                    {yieldData && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Net Yield Analysis</span>
                          {!yieldData.regulatoryCompliant && (
                            <Badge variant="destructive" className="ml-auto">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Compliance Issue
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">Gross YTM</p>
                            <p className="font-mono text-lg font-semibold text-green-600 dark:text-green-400">
                              {yieldData.grossYield.toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">Fee Impact</p>
                            <p className="font-mono text-lg font-semibold text-amber-600 dark:text-amber-400">
                              -{yieldData.feeImpactBps} bps
                            </p>
                          </div>
                          <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">Net Yield</p>
                            <p className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">
                              {yieldData.netYield.toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">After Tax (30%)</p>
                            <p className="font-mono text-lg font-semibold">
                              {yieldData.netYieldAfterTax.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-5 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="block">Platform</span>
                            <span className="font-mono">{yieldData.breakdown.platformFeeAnnualized.toFixed(4)}%</span>
                          </div>
                          <div>
                            <span className="block">Brokerage</span>
                            <span className="font-mono">{yieldData.breakdown.brokerageFeeAnnualized.toFixed(4)}%</span>
                          </div>
                          <div>
                            <span className="block">Txn Charges</span>
                            <span className="font-mono">{yieldData.breakdown.transactionChargesAnnualized.toFixed(4)}%</span>
                          </div>
                          <div>
                            <span className="block">GST</span>
                            <span className="font-mono">{yieldData.breakdown.gstAnnualized.toFixed(4)}%</span>
                          </div>
                          <div>
                            <span className="block">Stamp Duty</span>
                            <span className="font-mono">{yieldData.breakdown.stampDutyAnnualized.toFixed(4)}%</span>
                          </div>
                        </div>
                        {yieldData.violations.length > 0 && (
                          <Alert variant="destructive" className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {yieldData.violations.join('; ')}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                    
                    {!yieldData && profile && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Retail Brokerage</p>
                          <p className="font-mono">{parseFloat(profile.retailBrokerageRate).toFixed(3)}% + GST</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">HNI Brokerage</p>
                          <p className="font-mono">{parseFloat(profile.hniBrokerageRate).toFixed(3)}% + GST</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Platform Fee</p>
                          <p className="font-mono">{parseFloat(profile.platformFeeRate).toFixed(2)}%</p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setPublishDialog({ open: false, bonds: [] })}>
              Cancel
            </Button>
            <Button 
              onClick={() => publishBondsMutation.mutate(publishDialog.bonds.map(b => b.id))}
              disabled={publishBondsMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishBondsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm Publish ({publishDialog.bonds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlisistedDialog} onOpenChange={setUnlistedDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Unlisted Bond</DialogTitle>
            <DialogDescription>
              Manually add an unlisted bond to the catalog. It will be created as a draft.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>ISIN</Label>
              <Input 
                value={newUnlistedBond.isin} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, isin: e.target.value })}
                placeholder="INE..."
                data-testid="input-isin"
              />
            </div>
            <div className="space-y-2">
              <Label>Instrument Type</Label>
              <Select 
                value={newUnlistedBond.instrumentType} 
                onValueChange={(v) => setNewUnlistedBond({ ...newUnlistedBond, instrumentType: v })}
              >
                <SelectTrigger data-testid="select-instrument-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENT_TYPES.filter(t => t.category === 'corporate').map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Bond Name</Label>
              <Input 
                value={newUnlistedBond.bondName} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, bondName: e.target.value })}
                placeholder="Company Name 8.5% NCD 2028"
                data-testid="input-bond-name"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Issuer Name</Label>
              <Input 
                value={newUnlistedBond.issuerName} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, issuerName: e.target.value })}
                placeholder="Company Name Ltd"
                data-testid="input-issuer-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Face Value (₹)</Label>
              <Input 
                value={newUnlistedBond.faceValue} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, faceValue: e.target.value })}
                type="number"
                data-testid="input-face-value"
              />
            </div>
            <div className="space-y-2">
              <Label>Coupon Rate (%)</Label>
              <Input 
                value={newUnlistedBond.couponRate} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, couponRate: e.target.value })}
                type="number"
                step="0.01"
                data-testid="input-coupon-rate"
              />
            </div>
            <div className="space-y-2">
              <Label>Maturity Date</Label>
              <Input 
                value={newUnlistedBond.maturityDate} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, maturityDate: e.target.value })}
                type="date"
                data-testid="input-maturity-date"
              />
            </div>
            <div className="space-y-2">
              <Label>YTM (%)</Label>
              <Input 
                value={newUnlistedBond.yieldToMaturity} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, yieldToMaturity: e.target.value })}
                type="number"
                step="0.01"
                data-testid="input-ytm"
              />
            </div>
            <div className="space-y-2">
              <Label>Min Investment (₹)</Label>
              <Input 
                value={newUnlistedBond.minInvestment} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, minInvestment: e.target.value })}
                type="number"
                data-testid="input-min-investment"
              />
            </div>
            <div className="space-y-2">
              <Label>Lot Size</Label>
              <Input 
                value={newUnlistedBond.lotSize} 
                onChange={(e) => setNewUnlistedBond({ ...newUnlistedBond, lotSize: parseInt(e.target.value) || 1 })}
                type="number"
                data-testid="input-lot-size"
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Rating</Label>
              <Select 
                value={newUnlistedBond.creditRating} 
                onValueChange={(v) => setNewUnlistedBond({ ...newUnlistedBond, creditRating: v })}
              >
                <SelectTrigger data-testid="select-credit-rating">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  {['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'Below BB'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rating Agency</Label>
              <Select 
                value={newUnlistedBond.ratingAgency} 
                onValueChange={(v) => setNewUnlistedBond({ ...newUnlistedBond, ratingAgency: v })}
              >
                <SelectTrigger data-testid="select-rating-agency">
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  {['CRISIL', 'ICRA', 'CARE', 'India Ratings', 'Brickwork'].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlistedDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createUnlistedBondMutation.mutate(newUnlistedBond)}
              disabled={createUnlistedBondMutation.isPending || !newUnlistedBond.isin || !newUnlistedBond.bondName}
              data-testid="button-create-unlisted"
            >
              {createUnlistedBondMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
