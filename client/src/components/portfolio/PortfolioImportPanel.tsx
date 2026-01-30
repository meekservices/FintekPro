import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Upload, FileText, Link2, Edit2, Trash2, Plus, Save, X, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useParsePortfolioPDF,
  useParsePortfolioURL,
  useParseCASStatement,
  useImportWealthyURL,
  useSaveImportedHoldings,
  useImportHistory,
  useRecordImportHistory,
  type ImportedHolding,
  type ImportResult,
  type AssetType,
  type ImportSource,
  type ImportHistoryEntry,
} from "@/hooks/use-portfolio";

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'equity', label: 'Equity' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bond' },
  { value: 'gold', label: 'Gold' },
  { value: 'debt', label: 'Debt' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'pms', label: 'PMS' },
  { value: 'aif', label: 'AIF' },
  { value: 'reit', label: 'REIT' },
  { value: 'invit', label: 'InvIT' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'other', label: 'Other' },
];

interface PortfolioImportPanelProps {
  prospectId?: string;
  portfolioId?: string;
  onImportComplete?: (result: ImportResult) => void;
  onHoldingsSaved?: (count: number) => void;
  showWealthyImport?: boolean;
  showCASImport?: boolean;
  showPDFImport?: boolean;
  showURLImport?: boolean;
  showManualEntry?: boolean;
  compact?: boolean;
}

export function PortfolioImportPanel({
  prospectId,
  portfolioId,
  onImportComplete,
  onHoldingsSaved,
  showWealthyImport = true,
  showCASImport = true,
  showPDFImport = true,
  showURLImport = true,
  showManualEntry = true,
  compact = false,
}: PortfolioImportPanelProps) {
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>('pdf');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHoldings, setPreviewHoldings] = useState<ImportedHolding[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>('broker_pdf');
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [casFile, setCasFile] = useState<File | null>(null);
  const [casType, setCasType] = useState<'cas' | 'demat'>('cas');
  const [urlInput, setUrlInput] = useState('');
  const [wealthyUrl, setWealthyUrl] = useState('');
  
  const parsePDF = useParsePortfolioPDF();
  const parseURL = useParsePortfolioURL();
  const parseCAS = useParseCASStatement();
  const importWealthy = useImportWealthyURL();
  const saveHoldings = useSaveImportedHoldings();
  const importHistory = useImportHistory(prospectId);
  const recordHistory = useRecordImportHistory();
  const [showHistory, setShowHistory] = useState(false);

  const isLoading = parsePDF.isPending || parseURL.isPending || parseCAS.isPending || importWealthy.isPending || saveHoldings.isPending;

  const handleParseSuccess = useCallback((result: ImportResult, source: ImportSource) => {
    if (result.success && result.holdings?.length > 0) {
      // Transform holdings to ensure avgPrice is properly mapped from various backend field names
      const transformedHoldings = result.holdings.map((h: any, i: number) => ({
        ...h,
        id: h.id || `temp-${i}`,
        // Map various backend field names to avgPrice
        avgPrice: String(h.avgPrice || h.averagePrice || h.avgCostPerUnit || h.averageCost || 0),
        quantity: String(h.quantity || h.units || 0),
        currentValue: String(h.currentValue || 0),
      }));
      setPreviewHoldings(transformedHoldings);
      setPreviewMode(true);
      setImportSource(source);
      onImportComplete?.(result);
    } else {
      toast({
        title: "No Holdings Found",
        description: result.errors?.[0] || "Could not extract any holdings from the file.",
        variant: "destructive",
      });
    }
  }, [onImportComplete, toast]);

  const handlePDFUpload = useCallback(async () => {
    if (!pdfFile) return;
    
    parsePDF.mutate(
      { file: pdfFile, options: { prospectId } },
      {
        onSuccess: (result) => handleParseSuccess(result, 'broker_pdf'),
        onError: (error) => {
          toast({ title: "Parse Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [pdfFile, prospectId, parsePDF, handleParseSuccess, toast]);

  const handleCASUpload = useCallback(async () => {
    if (!casFile) return;
    
    parseCAS.mutate(
      { file: casFile, type: casType, options: { prospectId } },
      {
        onSuccess: (result) => handleParseSuccess(result, 'cas_statement'),
        onError: (error) => {
          toast({ title: "Parse Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [casFile, casType, prospectId, parseCAS, handleParseSuccess, toast]);

  const handleURLImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    parseURL.mutate(
      { url: urlInput, options: { prospectId, replaceExisting } },
      {
        onSuccess: (result) => handleParseSuccess(result, 'url_import'),
        onError: (error) => {
          toast({ title: "Import Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [urlInput, prospectId, replaceExisting, parseURL, handleParseSuccess, toast]);

  const handleWealthyImport = useCallback(async () => {
    if (!wealthyUrl.trim()) return;
    
    importWealthy.mutate(
      { url: wealthyUrl, replaceExisting },
      {
        onSuccess: (result) => handleParseSuccess(result, 'wealthy_url'),
        onError: (error) => {
          toast({ title: "Import Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [wealthyUrl, replaceExisting, importWealthy, handleParseSuccess, toast]);

  const handleSaveHoldings = useCallback(async () => {
    const holdingsWithIsin = previewHoldings.filter(h => h.isin);
    const totalValue = previewHoldings.reduce((sum, h) => {
      const qty = parseFloat(h.quantity as string) || 0;
      const price = parseFloat(h.avgPrice as string) || 0;
      return sum + (qty * price);
    }, 0);

    saveHoldings.mutate(
      { holdings: previewHoldings, prospectId, portfolioId, source: importSource, replaceExisting },
      {
        onSuccess: (result) => {
          toast({ title: "Holdings Saved", description: `Successfully saved ${result.savedCount} holdings.` });
          
          // Record import history for tracking
          if (prospectId) {
            recordHistory.mutate({
              clientId: prospectId,
              data: {
                source: importSource,
                provider: null,
                holdingsCount: result.savedCount,
                totalValue: totalValue,
                isinMatchedCount: holdingsWithIsin.length,
                confidenceScore: holdingsWithIsin.length / Math.max(previewHoldings.length, 1),
                status: holdingsWithIsin.length === previewHoldings.length ? 'success' : 'partial',
                errors: []
              }
            });
          }
          
          setPreviewMode(false);
          setPreviewHoldings([]);
          onHoldingsSaved?.(result.savedCount);
        },
        onError: (error) => {
          toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [previewHoldings, prospectId, portfolioId, importSource, replaceExisting, saveHoldings, recordHistory, toast, onHoldingsSaved]);

  const updateHolding = useCallback((index: number, updates: Partial<ImportedHolding>) => {
    setPreviewHoldings(prev => prev.map((h, i) => i === index ? { ...h, ...updates } : h));
  }, []);

  const deleteHolding = useCallback((index: number) => {
    setPreviewHoldings(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addNewHolding = useCallback(() => {
    const newHolding: ImportedHolding = {
      id: `temp-new-${Date.now()}`,
      name: '',
      assetType: 'mutual_fund',
      quantity: '0',
      avgPrice: '0',
    };
    setPreviewHoldings(prev => [...prev, newHolding]);
    setEditingIndex(previewHoldings.length);
  }, [previewHoldings.length]);

  const resetPreview = useCallback(() => {
    setPreviewMode(false);
    setPreviewHoldings([]);
    setEditingIndex(null);
    setPdfFile(null);
    setCasFile(null);
    setUrlInput('');
    setWealthyUrl('');
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  if (previewMode) {
    const totalValue = previewHoldings.reduce((sum, h) => {
      const qty = parseFloat(h.quantity) || 0;
      const price = parseFloat(h.avgPrice) || 0;
      return sum + (qty * price);
    }, 0);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                Review & Edit Holdings
              </CardTitle>
              <CardDescription>
                Review the parsed holdings below. You can edit, add, or remove entries before saving.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetPreview}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button variant="outline" size="sm" onClick={addNewHolding}>
                <Plus className="w-4 h-4 mr-2" /> Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Holdings</p>
                <p className="text-lg font-bold">{previewHoldings.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated Value</p>
                <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-xs text-muted-foreground">ISIN Enrichment</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium text-green-600">
                    {previewHoldings.filter(h => h.isin).length} matched
                  </span>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm text-amber-600">
                    {previewHoldings.filter(h => !h.isin && h.symbol).length} partial
                  </span>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm text-muted-foreground">
                    {previewHoldings.filter(h => !h.isin && !h.symbol).length} unknown
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="secondary">{importSource.replace('_', ' ')}</Badge>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Name / Symbol</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead className="w-[80px]">ISIN Status</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewHoldings.map((holding, index) => {
                  const isEditing = editingIndex === index;
                  const qty = parseFloat(holding.quantity) || 0;
                  const price = parseFloat(holding.avgPrice) || 0;
                  const value = qty * price;

                  return (
                    <TableRow key={holding.id || index}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={holding.name}
                            onChange={(e) => updateHolding(index, { name: e.target.value })}
                            placeholder="Fund/Stock Name"
                            className="h-8"
                          />
                        ) : (
                          <div>
                            <p className="font-medium text-sm truncate max-w-[280px]" title={holding.name}>
                              {holding.name || 'Unnamed'}
                            </p>
                            {holding.symbol && <p className="text-xs text-muted-foreground">{holding.symbol}</p>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={holding.assetType}
                            onValueChange={(val) => updateHolding(index, { assetType: val as AssetType })}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSET_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {ASSET_TYPE_OPTIONS.find(o => o.value === holding.assetType)?.label || holding.assetType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {holding.isin ? (
                          <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Matched
                          </Badge>
                        ) : holding.symbol ? (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Unknown
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={holding.quantity}
                            onChange={(e) => updateHolding(index, { quantity: e.target.value })}
                            className="h-8 w-24 text-right"
                          />
                        ) : (
                          <span>{parseFloat(holding.quantity).toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={holding.avgPrice}
                            onChange={(e) => updateHolding(index, { avgPrice: e.target.value })}
                            className="h-8 w-24 text-right"
                          />
                        ) : (
                          <span>₹{parseFloat(holding.avgPrice).toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingIndex(null)}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingIndex(index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600"
                            onClick={() => deleteHolding(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="replace-existing-save"
                checked={replaceExisting}
                onCheckedChange={setReplaceExisting}
              />
              <Label htmlFor="replace-existing-save" className="text-sm">
                Replace existing holdings from this source
              </Label>
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={resetPreview}>Cancel</Button>
            <Button onClick={handleSaveHoldings} disabled={saveHoldings.isPending || previewHoldings.length === 0}>
              {saveHoldings.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save {previewHoldings.length} Holdings</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableTabs = [
    showPDFImport && 'pdf',
    showCASImport && 'cas',
    showURLImport && 'url',
    showWealthyImport && 'wealthy',
    showManualEntry && 'manual',
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Portfolio
        </CardTitle>
        {!compact && (
          <CardDescription>
            Import holdings from PDF statements, CAS, URLs, or enter manually
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
            {showPDFImport && <TabsTrigger value="pdf"><FileText className="w-4 h-4 mr-1" /> PDF</TabsTrigger>}
            {showCASImport && <TabsTrigger value="cas"><FileText className="w-4 h-4 mr-1" /> CAS</TabsTrigger>}
            {showURLImport && <TabsTrigger value="url"><Link2 className="w-4 h-4 mr-1" /> URL</TabsTrigger>}
            {showWealthyImport && <TabsTrigger value="wealthy">Wealthy.in</TabsTrigger>}
            {showManualEntry && <TabsTrigger value="manual"><Plus className="w-4 h-4 mr-1" /> Manual</TabsTrigger>}
          </TabsList>

          {showPDFImport && (
            <TabsContent value="pdf" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Upload Statement (PDF or HTML)</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.html,.htm"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button onClick={handlePDFUpload} disabled={!pdfFile || parsePDF.isPending}>
                    {parsePDF.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports Zerodha, Groww, ICICI Direct, HDFC Securities, Kotak, and other broker statements
                </p>
              </div>
            </TabsContent>
          )}

          {showCASImport && (
            <TabsContent value="cas" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Button
                  variant={casType === 'cas' ? 'default' : 'outline'}
                  onClick={() => setCasType('cas')}
                  className="w-full"
                >
                  CAMS/KFintech CAS
                </Button>
                <Button
                  variant={casType === 'demat' ? 'default' : 'outline'}
                  onClick={() => setCasType('demat')}
                  className="w-full"
                >
                  NSDL/CDSL Statement
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Upload {casType === 'cas' ? 'CAS' : 'Demat'} Statement</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setCasFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button onClick={handleCASUpload} disabled={!casFile || parseCAS.isPending}>
                    {parseCAS.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {casType === 'cas' 
                    ? 'Download your CAS from MFCentral, CAMSOnline, or KFintech portal'
                    : 'Download your statement from NSDL or CDSL portal'
                  }
                </p>
              </div>
            </TabsContent>
          )}

          {showURLImport && (
            <TabsContent value="url" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Portfolio Report URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleURLImport} disabled={!urlInput.trim() || parseURL.isPending}>
                    {parseURL.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a shareable portfolio report URL from any supported platform
                </p>
              </div>
            </TabsContent>
          )}

          {showWealthyImport && (
            <TabsContent value="wealthy" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Wealthy.in Portfolio URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://reports.wealthy.in/?token=..."
                    value={wealthyUrl}
                    onChange={(e) => setWealthyUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleWealthyImport} disabled={!wealthyUrl.trim() || importWealthy.isPending}>
                    {importWealthy.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get this URL from your Wealthy.in account by sharing the portfolio report
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="replace-wealthy"
                  checked={replaceExisting}
                  onCheckedChange={setReplaceExisting}
                />
                <Label htmlFor="replace-wealthy" className="text-sm">
                  Replace existing Wealthy.in holdings
                </Label>
              </div>
            </TabsContent>
          )}

          {showManualEntry && (
            <TabsContent value="manual" className="space-y-4 mt-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Click the button below to add holdings manually. You can add multiple entries and edit them before saving.
                </AlertDescription>
              </Alert>
              <Button onClick={() => {
                setPreviewHoldings([{
                  id: `temp-new-${Date.now()}`,
                  name: '',
                  assetType: 'mutual_fund',
                  quantity: '0',
                  avgPrice: '0',
                }]);
                setPreviewMode(true);
                setImportSource('manual_entry');
                setEditingIndex(0);
              }}>
                <Plus className="w-4 h-4 mr-2" /> Start Manual Entry
              </Button>
            </TabsContent>
          )}
        </Tabs>

        {/* Import History Section */}
        {prospectId && (
          <div className="mt-6 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
              onClick={() => setShowHistory(!showHistory)}
            >
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Import History
                {importHistory.data?.count ? ` (${importHistory.data.count})` : ''}
              </span>
              {showHistory ? <ArrowLeft className="w-4 h-4 rotate-90" /> : <ArrowLeft className="w-4 h-4 -rotate-90" />}
            </Button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-[200px] overflow-auto">
                {importHistory.isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading history...</span>
                  </div>
                ) : !importHistory.data?.history?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No import history yet</p>
                ) : (
                  importHistory.data.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={entry.status === 'success' ? 'default' : entry.status === 'partial' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {entry.status}
                        </Badge>
                        <span className="font-medium">{entry.source.replace(/_/g, ' ')}</span>
                        {entry.provider && (
                          <span className="text-muted-foreground">via {entry.provider}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground text-xs">
                        <span>{entry.holdingsCount} holdings</span>
                        <span className="text-green-600">{entry.isinMatchedCount} matched</span>
                        <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioImportPanel;
