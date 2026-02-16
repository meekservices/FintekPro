import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, FileText, Link2, Edit2, Trash2, Plus, Save, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, ArrowLeft, Sparkles, PenLine
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSmartImport,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'choose' | 'smart' | 'manual'>('choose');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHoldings, setPreviewHoldings] = useState<ImportedHolding[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>('broker_pdf');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  const smartImport = useSmartImport();
  const saveHoldings = useSaveImportedHoldings();
  const importHistory = useImportHistory(prospectId);
  const recordHistory = useRecordImportHistory();
  const [showHistory, setShowHistory] = useState(false);

  const isLoading = smartImport.isPending || saveHoldings.isPending;

  const handleParseSuccess = useCallback((result: ImportResult, source: ImportSource) => {
    if (result.success && result.holdings?.length > 0) {
      // Transform holdings to ensure fields are properly mapped from various backend field names
      const transformedHoldings = result.holdings.map((h: any, i: number) => {
        // LOT-FIRST ARCHITECTURE: Extract EARLIEST date from ALL lots
        const lots = h.lots || [];
        let purchaseDate = h.purchaseDate || h.firstPurchaseDate || '';
        
        // If we have lots with transactionDate/transactionDateStr, find the EARLIEST date
        if (lots.length > 0) {
          const lotDates: string[] = lots.map((lot: any) => {
            return lot.transactionDateStr || 
                   (lot.transactionDate instanceof Date 
                     ? lot.transactionDate.toISOString().split('T')[0]
                     : (typeof lot.transactionDate === 'string' 
                         ? lot.transactionDate.split('T')[0] 
                         : '')) ||
                   lot.purchaseDate || '';
          }).filter((d: string) => d && d.length > 0);
          
          // Sort dates and get the earliest one as the canonical purchaseDate
          if (lotDates.length > 0) {
            lotDates.sort();
            purchaseDate = lotDates[0];
          }
        }
        
        // Build lot summary for display
        const lotCount = h.lotCount || lots.length || 0;
        const lotSummary = h.lotSummary || (lotCount > 0 ? `${lotCount} lot${lotCount !== 1 ? 's' : ''}` : '');
        
        return {
          ...h,
          id: h.id || `temp-${i}`,
          // Map various backend field names to avgPrice
          avgPrice: String(h.avgPrice || h.averagePrice || h.avgCostPerUnit || h.averageCost || 0),
          quantity: String(h.quantity || h.units || 0),
          currentValue: String(h.currentValue || 0),
          // LOT-FIRST: Use EARLIEST purchaseDate derived from lots
          purchaseDate,
          // Preserve lots array for expandable view
          lots,
          lotCount,
          lotSummary,
        };
      });
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

  const handleSmartImport = useCallback(async () => {
    if (!selectedFile && !urlInput.trim()) return;

    const source: ImportSource = urlInput.trim()
      ? (/wealthy\.in/i.test(urlInput) ? 'wealthy_url' : 'url_import')
      : 'broker_pdf';

    smartImport.mutate(
      { file: selectedFile || undefined, url: urlInput.trim() || undefined, prospectId },
      {
        onSuccess: (result) => handleParseSuccess(result, source),
        onError: (error) => {
          toast({ title: "Import Failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }, [selectedFile, urlInput, prospectId, smartImport, handleParseSuccess, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSaveHoldings = useCallback(async () => {
    const holdingsWithIsin = previewHoldings.filter(h => h.isin);
    const totalValue = previewHoldings.reduce((sum, h) => {
      return sum + (parseFloat(h.currentValue as string) || 0);
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
    setSelectedFile(null);
    setUrlInput('');
    setMode('choose');
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  if (previewMode) {
    const totalValue = previewHoldings.reduce((sum, h) => {
      return sum + (parseFloat(h.currentValue) || 0);
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
                  <TableHead className="w-[250px]">Name / Symbol</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead className="w-[70px]">ISIN</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="w-[120px]">Purchase Date</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewHoldings.map((holding, index) => {
                  const isEditing = editingIndex === index;
                  const value = parseFloat(holding.currentValue) || 0;

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
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={holding.purchaseDate || ''}
                            onChange={(e) => updateHolding(index, { purchaseDate: e.target.value })}
                            className="h-8 w-[110px]"
                            max={new Date().toISOString().split('T')[0]}
                          />
                        ) : (
                          <span className="text-sm">
                            {/* LOT-FIRST: Show earliest date + lot count indicator */}
                            {holding.purchaseDate ? (
                              <span>
                                {new Date(holding.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {holding.lots && holding.lots.length > 1 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (+{holding.lots.length - 1} more)
                                  </span>
                                )}
                              </span>
                            ) : holding.lotSummary ? (
                              <span className="text-muted-foreground text-xs">{holding.lotSummary}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Not set</span>
                            )}
                          </span>
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

  const fileExtLabel = selectedFile
    ? selectedFile.name.split('.').pop()?.toUpperCase() || 'FILE'
    : null;

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Portfolio
        </CardTitle>
        {!compact && (
          <CardDescription>
            Upload a file or paste a URL to instantly import your holdings
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {mode === 'choose' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('smart')}
              className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Smart Import</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-detects PDF, CAS, CSV, Excel, HTML, or URL
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1 mt-1">
                {['PDF', 'CAS', 'CSV', 'Excel', 'HTML', 'URL'].map(fmt => (
                  <Badge key={fmt} variant="secondary" className="text-[10px] px-1.5 py-0">{fmt}</Badge>
                ))}
              </div>
            </button>

            {showManualEntry && (
              <button
                onClick={() => {
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
                  setMode('manual');
                }}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <PenLine className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base">Manual Entry</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add holdings one by one with full edit capability
                  </p>
                </div>
              </button>
            )}
          </div>
        )}

        {mode === 'smart' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => { setMode('choose'); setSelectedFile(null); setUrlInput(''); }}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <span className="text-sm font-medium text-muted-foreground">Smart Import</span>
            </div>

            <div
              className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                dragActive
                  ? 'border-primary bg-primary/10'
                  : selectedFile
                    ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                    : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,.html,.htm"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {fileExtLabel && <Badge variant="outline" className="ml-2 text-[10px]">{fileExtLabel}</Badge>}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  >
                    Choose a different file
                  </Button>
                </>
              ) : (
                <>
                  <Upload className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-center">
                    <p className="font-medium text-sm">Drop your file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, CAS, CSV, Excel, HTML statements from any broker
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Import from URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://reports.wealthy.in/... or any portfolio URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supports Wealthy.in reports and other shareable portfolio URLs
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSmartImport}
              disabled={(!selectedFile && !urlInput.trim()) || smartImport.isPending}
            >
              {smartImport.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Import Portfolio</>
              )}
            </Button>

            {smartImport.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{smartImport.error.message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

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
