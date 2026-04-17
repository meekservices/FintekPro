import React from "react";
import { 
  Upload, Plus, BarChart3, Save, Trash2, FileText, Info, Shield, TrendingUp 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHint, CurrencyInput, ValidationBanner, formatCurrency } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { MANUAL_ASSET_TYPES } from "../constants";
import { ManualCGEntry, Broker, CapitalGainsDetails, BrokerUploadInfo, Schedule112AEntry } from "../types";

export const CapitalGainsSection: React.FC = () => {
  const {
    assessmentYear,
    recommendedForm,
    incomeSources,
    capitalGainsDetails,
    setCapitalGainsDetails,
    totals,
    supportedBrokers,
    cgMode,
    setCgMode,
    cgBrokerSearch,
    setCgBrokerSearch,
    cgSelectedBroker,
    setCgSelectedBroker,
    cgUploading,
    cgUploads,
    setCgUploads,
    cgManualAssetType,
    setCgManualAssetType,
    cgManualEntries,
    setCgManualEntries,
    cgManualSaved,
    setCgManualSaved,
    schedule112AEntries,
    setSchedule112AEntries,
    handleCgFileUpload,
    handleCgManualSave,
    validateStep,
    currentStepId
  } = useTax();

  const brokerList = supportedBrokers?.data || [];
  const currentValidation = validateStep(currentStepId);
  const capitalGainsTotal = totals.capitalGains;

  const filteredBrokers = brokerList.filter((b: Broker) =>
    b.name.toLowerCase().includes(cgBrokerSearch.toLowerCase()) ||
    b.category.toLowerCase().includes(cgBrokerSearch.toLowerCase())
  );

  const addManualEntry = () => {
    setCgManualEntries((prev: ManualCGEntry[]) => [...prev, {
      assetName: '', isin: '', buyDate: '', sellDate: '',
      quantity: 0, buyPrice: 0, sellPrice: 0,
      expenses: 0, sttPaid: 0, fairMarketValue: 0,
      exemptionSection: '', exemptionAmount: 0,
    }]);
  };

  const updateManualEntry = (idx: number, field: keyof ManualCGEntry, value: string | number) => {
    setCgManualEntries((prev: ManualCGEntry[]) => prev.map((e: ManualCGEntry, i: number) => i === idx ? { ...e, [field]: value } : e) as ManualCGEntry[]);
  };

  const removeManualEntry = (idx: number) => {
    setCgManualEntries((prev: ManualCGEntry[]) => prev.filter((_: ManualCGEntry, i: number) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Upload your broker's Tax P&L statement or enter capital gains manually for each asset type.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={cgMode === 'upload' ? 'default' : 'outline'} onClick={() => setCgMode('upload')} data-testid="cg-mode-upload">
          <Upload className="h-4 w-4 mr-1" /> Upload Statement
        </Button>
        <Button size="sm" variant={cgMode === 'manual' ? 'default' : 'outline'} onClick={() => setCgMode('manual')} data-testid="cg-mode-manual">
          <Plus className="h-4 w-4 mr-1" /> Manual Entry
        </Button>
        <Button size="sm" variant={cgMode === 'summary' ? 'default' : 'outline'} onClick={() => setCgMode('summary')} data-testid="cg-mode-summary">
          <BarChart3 className="h-4 w-4 mr-1" /> Summary
        </Button>
      </div>

      {cgMode === 'upload' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Capital Gains Statement
              </CardTitle>
              <CardDescription>Select your broker/fund house and upload the Tax P&L report. We support {brokerList.length}+ platforms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search brokers (e.g. Zerodha, CAMS, Groww...)"
                  value={cgBrokerSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCgBrokerSearch(e.target.value)}
                  className="pl-8"
                  data-testid="cg-broker-search"
                />
                <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </span>
              </div>

              {(['stock_broker', 'fund_house', 'aggregator', 'us_stocks'] as const).map(category => {
                const brokers = filteredBrokers.filter((b: Broker) => b.category === category);
                if (brokers.length === 0) return null;
                const categoryLabels: Record<string, string> = {
                  stock_broker: 'Stock Brokers',
                  fund_house: 'Fund Houses / Registrars',
                  aggregator: 'Aggregators & Platforms',
                  us_stocks: 'US Stocks',
                };
                return (
                  <div key={category} className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">{categoryLabels[category]}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {brokers.map((broker: Broker) => (
                        <Button
                          key={broker.id}
                          variant={cgSelectedBroker === broker.id ? 'default' : 'outline'}
                          size="sm"
                          className="h-auto py-2 px-3 text-left justify-start text-xs"
                          onClick={() => setCgSelectedBroker(broker.id === cgSelectedBroker ? null : broker.id)}
                          data-testid={`cg-broker-${broker.id}`}
                        >
                          <span className="truncate">{broker.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {cgSelectedBroker && (() => {
                const broker = brokerList.find((b: Broker) => b.id === cgSelectedBroker);
                if (!broker) return null;
                return (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{broker.name}</p>
                          <p className="text-xs text-muted-foreground">{broker.fileFormatHint}</p>
                        </div>
                        <Badge variant="outline">{broker.supportedFormats.map((f: string) => f.toUpperCase()).join(' / ')}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept={broker.supportedFormats.map((f: string) => `.${f}`).join(',')}
                          disabled={cgUploading}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0];
                            if (file) handleCgFileUpload(file, broker.id);
                          }}
                          data-testid="cg-file-input"
                        />
                        {cgUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading & parsing...</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Broker not listed?</p>
                  <p className="text-xs text-muted-foreground">Download our Excel template, fill in your transactions, and upload using "FintekPro Template" option above.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCgSelectedBroker('template')}>
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {cgUploads.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Uploaded Statements ({cgUploads.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cgUploads.map(upload => (
                  <div key={upload.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{upload.brokerName}</span>
                        <Badge variant={upload.parseConfidence >= 0.7 ? 'default' : 'secondary'} className="text-xs">
                          {(upload.parseConfidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{upload.fileName} — {upload.summary.totalTransactions} transactions</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs">STCG: <span className={upload.summary.netSTCG >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(upload.summary.netSTCG)}</span></span>
                        <span className="text-xs">LTCG: <span className={upload.summary.netLTCG >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(upload.summary.netLTCG)}</span></span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setCgUploads((prev: BrokerUploadInfo[]) => prev.filter((u: BrokerUploadInfo) => u.id !== upload.id));
                    }}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {cgMode === 'manual' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Sale Entry — Manual</CardTitle>
              <CardDescription>Enter capital gains data manually for each asset type. Each entry is logged to the audit trail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MANUAL_ASSET_TYPES.map(at => (
                  <Button
                    key={at.value}
                    variant={cgManualAssetType === at.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-auto py-2 px-3 text-left justify-start"
                    onClick={() => { setCgManualAssetType(at.value); setCgManualEntries([]); }}
                    data-testid={`cg-manual-type-${at.value}`}
                  >
                    <span className="mr-1.5">{at.icon}</span>
                    <span className="text-xs truncate">{at.label}</span>
                  </Button>
                ))}
              </div>

              {(() => {
                const selectedType = MANUAL_ASSET_TYPES.find(t => t.value === cgManualAssetType);
                if (!selectedType) return null;
                return (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>{selectedType.label}</strong>: {selectedType.hint}<br/>
                      <span className="text-muted-foreground">LTCG holding period: {selectedType.holdingPeriod}</span>
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {cgManualEntries.map((entry, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Transaction #{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeManualEntry(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Asset Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={entry.assetName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateManualEntry(idx, 'assetName', e.target.value)}
                          placeholder={cgManualAssetType === 'property' ? 'e.g. 2BHK Flat, Andheri' : 'e.g. Reliance Industries'}
                          data-testid={`cg-manual-name-${idx}`}
                        />
                      </div>
                      {cgManualAssetType !== 'property' && cgManualAssetType !== 'deemed_cg' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">ISIN (optional)</Label>
                          <Input
                            value={entry.isin}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateManualEntry(idx, 'isin', e.target.value)}
                            placeholder="e.g. INE002A01018"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Purchase Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={entry.buyDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateManualEntry(idx, 'buyDate', e.target.value)} data-testid={`cg-manual-buydate-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sale Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={entry.sellDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateManualEntry(idx, 'sellDate', e.target.value)} data-testid={`cg-manual-selldate-${idx}`} />
                      </div>
                      {cgManualAssetType !== 'property' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Quantity</Label>
                          <Input type="number" min={0} value={entry.quantity || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateManualEntry(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Number of units/shares" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">{cgManualAssetType === 'property' ? 'Purchase Price' : 'Buy Price Per Unit'}</Label>
                        <CurrencyInput id={`buyPrice-${idx}`} value={entry.buyPrice} onChange={(v: number) => updateManualEntry(idx, 'buyPrice', v)} data-testid={`cg-manual-buyprice-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{cgManualAssetType === 'property' ? 'Sale Consideration' : 'Sell Price Per Unit'}</Label>
                        <CurrencyInput id={`sellPrice-${idx}`} value={entry.sellPrice} onChange={(v: number) => updateManualEntry(idx, 'sellPrice', v)} data-testid={`cg-manual-sellprice-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Expenses (Brokerage/Stamp Duty)</Label>
                        <CurrencyInput id={`expenses-${idx}`} value={entry.expenses} onChange={(v: number) => updateManualEntry(idx, 'expenses', v)} />
                      </div>
                      {(cgManualAssetType === 'shares' || cgManualAssetType === 'mutual_funds') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">STT Paid</Label>
                          <CurrencyInput id={`stt-${idx}`} value={entry.sttPaid} onChange={(v: number) => updateManualEntry(idx, 'sttPaid', v)} />
                        </div>
                      )}
                      {cgManualAssetType === 'property' && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Stamp Duty Value (Sec 50C)</Label>
                            <CurrencyInput id={`sdv-${idx}`} value={entry.fairMarketValue} onChange={(v: number) => updateManualEntry(idx, 'fairMarketValue', v)} />
                          </div>
                        </>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Exemption Section</Label>
                        <Select value={entry.exemptionSection} onValueChange={(v) => updateManualEntry(idx, 'exemptionSection', v)}>
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Exemption</SelectItem>
                            <SelectItem value="54">Sec 54 - House reinvestment</SelectItem>
                            <SelectItem value="54EC">Sec 54EC - Capital Gains Bonds</SelectItem>
                            <SelectItem value="54F">Sec 54F - New house from other CG</SelectItem>
                            <SelectItem value="54B">Sec 54B - Agricultural land</SelectItem>
                            <SelectItem value="54GB">Sec 54GB - Startup investment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {entry.exemptionSection && entry.exemptionSection !== 'none' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Exemption Amount</Label>
                          <CurrencyInput id={`exemption-${idx}`} value={entry.exemptionAmount} onChange={(v: number) => updateManualEntry(idx, 'exemptionAmount', v)} />
                        </div>
                      )}
                    </div>
                    {entry.buyDate && entry.sellDate && (
                      <div className="flex gap-4 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <span>Holding: {Math.max(0, Math.floor((new Date(entry.sellDate).getTime() - new Date(entry.buyDate).getTime()) / (86400000)))} days</span>
                        <span>Gain/Loss: {formatCurrency((entry.quantity || 1) * (entry.sellPrice - entry.buyPrice) - entry.expenses - (entry.exemptionAmount || 0))}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.floor((new Date(entry.sellDate).getTime() - new Date(entry.buyDate).getTime()) / 86400000) > (cgManualAssetType === 'property' || cgManualAssetType === 'gold' || cgManualAssetType === 'other_assets' ? 730 : 365) ? 'LTCG' : 'STCG'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addManualEntry} data-testid="cg-add-manual">
                  <Plus className="h-4 w-4 mr-1" /> Add Transaction
                </Button>
                {cgManualEntries.length > 0 && (
                  <Button size="sm" onClick={handleCgManualSave} data-testid="cg-save-manual">
                    <Save className="h-4 w-4 mr-1" /> Save {cgManualEntries.length} Entries
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {cgManualSaved.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saved Manual Entries ({cgManualSaved.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cgManualSaved.map(saved => {
                  const at = MANUAL_ASSET_TYPES.find(t => t.value === saved.assetType);
                  return (
                    <div key={saved.id} className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <span className="text-sm font-medium">{at?.icon} {at?.label || saved.assetType}</span>
                        <span className="text-xs text-muted-foreground ml-2">({saved.entryCount} transactions)</span>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs">STCG: <span className="text-green-600">{formatCurrency(saved.summary.totalSTCG)}</span></span>
                          <span className="text-xs">LTCG: <span className="text-green-600">{formatCurrency(saved.summary.totalLTCG)}</span></span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setCgManualSaved((prev: any[]) => prev.filter((s: any) => s.id !== saved.id));
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>F&O / Intraday Trading:</strong> If you have Futures & Options or frequent intraday activity, these are classified as Business Income (ITR-3). 
              Use the Business & Profession section instead. Only equity delivery-based trades are reported as Capital Gains.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {cgMode === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Capital Gains Summary
              </CardTitle>
              <CardDescription>Combined totals from all uploaded statements and manual entries. These values will be used in your ITR filing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Short Term Capital Gains</p>
                    <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{formatCurrency(capitalGainsDetails.shortTermGains)}</p>
                    <p className="text-xs text-muted-foreground">Taxed at 15-20% (u/s 111A)</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Long Term Capital Gains</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(capitalGainsDetails.longTermGains)}</p>
                    <p className="text-xs text-muted-foreground">Taxed at 10-12.5% (u/s 112A)</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Net Capital Gains</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(capitalGainsTotal)}</p>
                    <p className="text-xs text-muted-foreground">After exemptions</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Exemptions (Sec 54/54EC/54F)</Label>
                <CurrencyInput
                  id="exemptions"
                  value={capitalGainsDetails.exemptionsApplied}
                  onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, exemptionsApplied: v }))}
                  placeholder="0 if no exemptions claimed"
                  data-testid="input-exemptions"
                />
                <p className="text-xs text-muted-foreground">Reinvestment exemptions. Sec 54: Reinvest property sale proceeds in a new house within 2 years. Sec 54EC: Invest up to ₹50 lakhs in capital gains bonds within 6 months.</p>
              </div>

              <Separator />

              {recommendedForm !== "ITR-1" && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Schedule CG — STT Split (ITR-2+)</Label>
                      <Badge variant="outline" className="text-[10px]">Mandatory for ITR-2/3</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Capital gains must be split by STT status. STT-paid equity (listed shares/MF on recognized exchange) has preferential tax rates. Non-STT includes unlisted shares, property, gold, etc.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          STCG — STT Paid (u/s 111A)
                          <FieldHint text="Short-term gains on listed equity/MF sold on stock exchange with STT paid. Taxed at flat 20% (from FY 2024-25, was 15% earlier)." />
                        </Label>
                        <CurrencyInput id="sttPaidSTCG" value={capitalGainsDetails.sttPaidSTCG} onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, sttPaidSTCG: v }))} data-testid="input-stt-paid-stcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          STCG — STT Not Paid
                          <FieldHint text="Short-term gains on unlisted shares, property, gold, bonds etc. where STT is not applicable. Taxed at slab rates." />
                        </Label>
                        <CurrencyInput id="sttNotPaidSTCG" value={capitalGainsDetails.sttNotPaidSTCG} onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, sttNotPaidSTCG: v }))} data-testid="input-stt-not-paid-stcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          LTCG — STT Paid (u/s 112A)
                          <FieldHint text="Long-term gains on listed equity/MF sold on exchange with STT paid. Taxed at flat 12.5% (from FY 2024-25, was 10% earlier). ₹1.25L exemption applies." />
                        </Label>
                        <CurrencyInput id="sttPaidLTCG" value={capitalGainsDetails.sttPaidLTCG} onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, sttPaidLTCG: v }))} data-testid="input-stt-paid-ltcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          LTCG — STT Not Paid (u/s 112)
                          <FieldHint text="Long-term gains on unlisted shares, property, gold, bonds etc. Taxed at 12.5% without indexation (from FY 2024-25). No ₹1.25L exemption." />
                        </Label>
                        <CurrencyInput id="sttNotPaidLTCG" value={capitalGainsDetails.sttNotPaidLTCG} onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, sttNotPaidLTCG: v }))} data-testid="input-stt-not-paid-ltcg" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Grandfathering — Pre-2018 Equity LTCG</Label>
                      <Badge variant="outline" className="text-[10px]">Sec 112A</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="grandfathering-toggle"
                        title="Apply grandfathering provision for equity acquired before 31-Jan-2018"
                        checked={capitalGainsDetails.grandfatheringApplied}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, grandfatheringApplied: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-grandfathering"
                      />
                      <Label htmlFor="grandfathering-toggle" className="text-sm cursor-pointer">
                        Apply grandfathering provision for equity acquired before 31-Jan-2018
                      </Label>
                    </div>
                    {capitalGainsDetails.grandfatheringApplied && (
                      <div className="space-y-2 pl-7">
                        <p className="text-xs text-muted-foreground">
                          For listed equity/MF acquired before 1-Feb-2018, the cost of acquisition is higher of: (a) actual purchase price, or (b) Fair Market Value as on 31-Jan-2018 (but not exceeding sale price). This reduces LTCG.
                        </p>
                        <div className="max-w-sm space-y-1.5">
                          <Label className="text-xs">
                            FMV as on 31-Jan-2018 (highest traded price)
                            <FieldHint text="Enter the highest price on NSE/BSE as of 31-Jan-2018 for your pre-2018 equity holdings. This is used as deemed cost of acquisition if higher than actual purchase price." />
                          </Label>
                          <CurrencyInput
                            id="grandfatheringFMV"
                            value={capitalGainsDetails.grandfatheringFMV}
                            onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, grandfatheringFMV: v }))}
                            placeholder="FMV of pre-2018 holdings"
                            data-testid="input-grandfathering-fmv"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />
                </>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Override Totals (Advanced)</Label>
                <p className="text-xs text-muted-foreground">If upload/manual totals are incorrect, you can override them directly below.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Short Term Capital Gains (STCG)</Label>
                    <CurrencyInput
                      id="shortTermGains"
                      value={capitalGainsDetails.shortTermGains}
                      onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, shortTermGains: v }))}
                      data-testid="input-short-term-gains"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Long Term Capital Gains (LTCG)</Label>
                    <CurrencyInput
                      id="longTermGains"
                      value={capitalGainsDetails.longTermGains}
                      onChange={(v: number) => setCapitalGainsDetails((prev: CapitalGainsDetails) => ({ ...prev, longTermGains: v }))}
                      data-testid="input-long-term-gains"
                    />
                  </div>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  All uploads and manual entries are logged with SHA-256 hash chain integrity for ITR department audit compliance. 
                  File checksums, parse confidence scores, and entry timestamps are immutably recorded.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      {["ITR-2", "ITR-3"].includes(recommendedForm) && incomeSources.hasCapitalGains && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" /> Schedule 112A — Scrip-wise Long-Term Capital Gains
                <Badge variant="outline" className="text-[10px]">Listed Equity / Equity MF with STT</Badge>
              </CardTitle>
              <CardDescription>Per-share details of LTCG on listed equity shares and equity-oriented mutual funds where STT was paid on sale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedule112AEntries.map((entry, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Scrip {idx + 1}: {entry.shareName || 'New Entry'}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSchedule112AEntries((prev: Schedule112AEntry[]) => prev.filter((_: Schedule112AEntry, i: number) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">ISIN *</Label>
                      <Input value={entry.isin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], isin: e.target.value.toUpperCase() }; setSchedule112AEntries(u); }} placeholder="INE..." maxLength={12} className="font-mono text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Share / Fund Name *</Label>
                      <Input value={entry.shareName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], shareName: e.target.value }; setSchedule112AEntries(u); }} placeholder="e.g. Reliance Industries" />
                    </div>
                    <div>
                      <Label className="text-xs">Units Sold</Label>
                      <Input type="number" value={entry.unitsSold || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], unitsSold: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Sale Price / Unit (₹)</Label>
                      <Input type="number" value={entry.salePricePerUnit || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], salePricePerUnit: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Cost of Acquisition (₹)</Label>
                      <Input type="number" value={entry.costOfAcquisition || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], costOfAcquisition: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">FMV as on 31-Jan-2018 (₹) <FieldHint text="Fair Market Value for grandfathering. Highest traded price on 31-Jan-2018 or NAV on that date for MF." /></Label>
                      <Input type="number" value={entry.fmvAsOn31Jan2018 || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], fmvAsOn31Jan2018: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Expenditure on Transfer (₹)</Label>
                      <Input type="number" value={entry.expenditureOnTransfer || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], expenditureOnTransfer: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">LTCG (₹)</Label>
                      <div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
                        ₹{(() => { const saleVal = (entry.unitsSold || 0) * (entry.salePricePerUnit || 0); const costWithFMV = entry.fmvAsOn31Jan2018 > 0 ? Math.max(entry.costOfAcquisition, Math.min(entry.fmvAsOn31Jan2018 * (entry.unitsSold || 0), saleVal)) : entry.costOfAcquisition; return (saleVal - costWithFMV - (entry.expenditureOnTransfer || 0)).toLocaleString('en-IN'); })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full dashed" onClick={() => setSchedule112AEntries((prev: Schedule112AEntry[]) => [...prev, { isin: '', shareName: '', unitsSold: 0, salePricePerUnit: 0, costOfAcquisition: 0, fmvAsOn31Jan2018: 0, expenditureOnTransfer: 0 }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Scrip to Schedule 112A
              </Button>
            </CardContent>
          </Card>
      )}

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
