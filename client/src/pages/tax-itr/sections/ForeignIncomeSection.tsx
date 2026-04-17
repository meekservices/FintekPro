import React from "react";
import { Globe, TrendingUp, Receipt, Scale, Shield, Plus, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FieldHint, CurrencyInput, ValidationBanner, formatCurrency 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { DTAA_COUNTRIES, CURRENCY_CODES, ASSET_TYPES_FA } from "../constants";
import { 
  ScheduleALDetails, DonationEntry, LossAdjustmentDetails, SpecialRateIncome, FOIncome, CYLAData, BFLAData,
  ForeignAssetEntry, ForeignIncomeDetails
} from "../types";

export const ForeignIncomeSection: React.FC = () => {
  const {
    foreignIncomeDetails,
    setForeignIncomeDetails,
    totals,
    validateStep,
    currentStepId
  } = useTax();

  const currentValidation = validateStep(currentStepId);
  const foreignTotalInINR = (
    foreignIncomeDetails.foreignSTCG + 
    foreignIncomeDetails.foreignLTCG + 
    foreignIncomeDetails.foreignDividends + 
    foreignIncomeDetails.foreignInterest + 
    foreignIncomeDetails.foreignOtherIncome
  ) * (foreignIncomeDetails.currencyCode === "INR" ? 1 : foreignIncomeDetails.exchangeRate);

  const addForeignAsset = (): void => {
    setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({
      ...prev,
      foreignAssets: [...prev.foreignAssets, {
        countryCode: prev.dtaaCountry || "US",
        countryName: DTAA_COUNTRIES.find(c => c.code === (prev.dtaaCountry || "US"))?.name || "United States",
        assetType: "equity",
        institutionName: "",
        accountNumber: "",
        peakBalance: 0,
        closingBalance: 0,
        acquisitionDate: "",
        totalGrossIncome: 0,
        taxableIncome: 0,
      }]
    }));
  };

  const removeForeignAsset = (idx: number): void => {
    setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({
      ...prev,
      foreignAssets: prev.foreignAssets.filter((_: ForeignAssetEntry, i: number) => i !== idx)
    }));
  };

  const updateForeignAsset = <K extends keyof ForeignAssetEntry>(idx: number, field: K, value: ForeignAssetEntry[K]): void => {
    setForeignIncomeDetails((prev: ForeignIncomeDetails) => {
      const u = [...prev.foreignAssets];
      u[idx] = { ...u[idx], [field]: value };
      return { ...prev, foreignAssets: u };
    });
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Globe className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>Global Stock Investments</strong> — Report all foreign income in INR (converted at RBI reference rate on the date of credit/sale).
          Schedule FA disclosure is mandatory under the Black Money Act, 2015. Non-disclosure attracts ₹10 lakh penalty.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Currency & Country Setup
          </CardTitle>
          <CardDescription>Set your primary investment country and currency for auto-conversion.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>
                DTAA Country
                <FieldHint text="Select the country where you earned foreign income. India has DTAA treaties with 90+ countries to prevent double taxation." />
              </Label>
              <Select value={foreignIncomeDetails.dtaaCountry} onValueChange={(v: string): void => {
                const country = DTAA_COUNTRIES.find((c: { code: string; name: string; article: string }) => c.code === v);
                setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({
                  ...prev,
                  dtaaCountry: v,
                  dtaaArticle: country?.article || "",
                }));
              }}>
                <SelectTrigger data-testid="select-dtaa-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DTAA_COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Currency
                <FieldHint text="Currency in which your foreign transactions were made. All amounts will be converted to INR using the exchange rate below." />
              </Label>
              <Select value={foreignIncomeDetails.currencyCode} onValueChange={(v: string): void => {
                const cur = CURRENCY_CODES.find((c: { code: string; symbol: string; name: string; defaultRate: number }) => c.code === v);
                setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({
                  ...prev,
                  currencyCode: v,
                  exchangeRate: cur?.defaultRate || prev.exchangeRate,
                }));
              }}>
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_CODES.map((c: { code: string; symbol: string; name: string; defaultRate: number }) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Exchange Rate (1 {foreignIncomeDetails.currencyCode} = ₹)
                <FieldHint text="Use the SBI TT Buying Rate or RBI reference rate on the date of transaction. Check rbi.org.in for official rates. The pre-filled rate is approximate." />
              </Label>
              <Input
                type="number"
                step="0.01"
                value={foreignIncomeDetails.exchangeRate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 0 }))}
                data-testid="input-exchange-rate"
              />
              <p className="text-xs text-muted-foreground">Pre-filled approximate rate. Verify from RBI/SBI for actual filing.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Foreign Capital Gains (Schedule CG)
          </CardTitle>
          <CardDescription>Enter capital gains from global stocks, ETFs, or other foreign assets. Enter amounts already converted to INR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignSTCG">
                Foreign STCG (in ₹)
                <FieldHint text="Short-term capital gains from foreign stocks/ETFs held < 24 months. Unlike Indian equities (12 months), foreign shares use 24-month holding period. Taxed at slab rates (not 15% flat like Indian STT-paid equity)." />
              </Label>
              <CurrencyInput
                id="foreignSTCG"
                value={foreignIncomeDetails.foreignSTCG}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignSTCG: v }))}
                placeholder="e.g., gains from selling US stocks < 24 months"
                data-testid="input-foreign-stcg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignLTCG">
                Foreign LTCG (in ₹)
                <FieldHint text="Long-term capital gains from foreign stocks/ETFs held > 24 months. Taxed at 20% with indexation benefit (u/s 112). No ₹1L exemption available (that's only for Indian listed equity u/s 112A)." />
              </Label>
              <CurrencyInput
                id="foreignLTCG"
                value={foreignIncomeDetails.foreignLTCG}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignLTCG: v }))}
                placeholder="e.g., gains from selling US stocks > 24 months"
                data-testid="input-foreign-ltcg"
              />
            </div>
          </div>
          <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              Foreign equity holding period for LTCG is 24 months (not 12 months like Indian listed equity). Also, STT-based concessional rates (15%/10%) do NOT apply to foreign stocks.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Foreign Income — Other Heads (Schedule FSI)
          </CardTitle>
          <CardDescription>Report dividends, interest, and other income earned from foreign sources. Report amounts in INR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignDividends">
                Foreign Dividends (in ₹)
                <FieldHint text="Dividends from US stocks are taxed at 25% (DTAA rate) by the US and added to your Indian income at slab rates. Claim FTC below to avoid double taxation." />
              </Label>
              <CurrencyInput
                id="foreignDividends"
                value={foreignIncomeDetails.foreignDividends}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignDividends: v }))}
                placeholder="Dividends from foreign stocks/funds"
                data-testid="input-foreign-dividends"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignInterest">
                Foreign Interest (in ₹)
                <FieldHint text="Interest earned on foreign bank accounts, bonds, or deposits. Fully taxable at slab rates in India." />
              </Label>
              <CurrencyInput
                id="foreignInterest"
                value={foreignIncomeDetails.foreignInterest}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignInterest: v }))}
                placeholder="Interest from foreign bank/bonds"
                data-testid="input-foreign-interest"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignOtherIncome">
                Other Foreign Income (in ₹)
                <FieldHint text="Any other income from foreign sources — rental income from overseas property, freelance income earned abroad, etc." />
              </Label>
              <CurrencyInput
                id="foreignOtherIncome"
                value={foreignIncomeDetails.foreignOtherIncome}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignOtherIncome: v }))}
                placeholder="Other foreign-sourced income"
                data-testid="input-foreign-other-income"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-green-600" /> Foreign Tax Credit — DTAA Relief (Schedule TR)
          </CardTitle>
          <CardDescription>Claim credit for taxes already paid in the foreign country to avoid double taxation. You must file Form 67 before filing ITR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignTaxPaid">
                Tax Paid in Foreign Country (in ₹)
                <FieldHint text="Total tax withheld or paid in the foreign country on your income. For US stocks: 25% on dividends, 0% on capital gains (US doesn't tax non-residents on capital gains). Get this from your broker's 1042-S form or tax statement." />
              </Label>
              <CurrencyInput
                id="foreignTaxPaid"
                value={foreignIncomeDetails.foreignTaxPaid}
                onChange={(v: number): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, foreignTaxPaid: v }))}
                placeholder="Tax withheld by foreign government"
                data-testid="input-foreign-tax-paid"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                DTAA Article
                <FieldHint text="The specific DTAA article under which you're claiming relief. Common: Article 10 (Dividends), Article 11 (Interest), Article 13 (Capital Gains). Auto-filled based on country selection." />
              </Label>
              <Input
                value={foreignIncomeDetails.dtaaArticle || DTAA_COUNTRIES.find((c: { code: string; name: string; article: string }) => c.code === foreignIncomeDetails.dtaaCountry)?.article || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setForeignIncomeDetails((prev: ForeignIncomeDetails) => ({ ...prev, dtaaArticle: e.target.value }))}
                placeholder="e.g., Article 10/11/13"
                data-testid="input-dtaa-article"
              />
            </div>
          </div>
          {foreignIncomeDetails.foreignTaxPaid > 0 && (
            <Alert className="mt-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                FTC of {formatCurrency(foreignIncomeDetails.foreignTaxPaid)} will be claimed under Section 90/91. 
                Remember to file <strong>Form 67</strong> before your ITR filing date — FTC is not allowed without it.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-600" /> Schedule FA — Foreign Asset Disclosure
            <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">Mandatory</Badge>
          </CardTitle>
          <CardDescription>
            Mandatory for Resident & Ordinarily Resident (ROR) Indians. Disclose ALL foreign assets — even zero-balance accounts, 
            dormant accounts, or assets held for even 1 day during the calendar year (Jan 1 – Dec 31).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {foreignIncomeDetails.foreignAssets.map((asset: ForeignAssetEntry, idx: number): React.ReactNode => (
            <Card key={idx} className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="text-xs">Asset {idx + 1}</Badge>
                  <Button variant="ghost" size="sm" onClick={(): void => removeForeignAsset(idx)} className="text-red-500 hover:text-red-700 h-7 px-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Country</Label>
                    <Select value={asset.countryCode} onValueChange={(v: string): void => {
                      updateForeignAsset(idx, "countryCode", v);
                      updateForeignAsset(idx, "countryName", DTAA_COUNTRIES.find((c: { code: string; name: string; article: string }) => c.code === v)?.name || v);
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DTAA_COUNTRIES.map((c: { name: string; code: string; article: string }) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Asset Type
                      <FieldHint text="Table A3: Equity/Debt in foreign entity. Table A1: Foreign bank account. Table A2: Custodial account. Table C: Immovable property." />
                    </Label>
                    <Select value={asset.assetType} onValueChange={(v: string): void => updateForeignAsset(idx, "assetType", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES_FA.map((t: { label: string; value: string }) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Institution / Broker Name</Label>
                    <Input
                      className="h-8 text-xs"
                      value={asset.institutionName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>): void => updateForeignAsset(idx, "institutionName", e.target.value)}
                      placeholder="e.g., Charles Schwab, Vested, INDmoney"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Account / Folio No.</Label>
                    <Input
                      className="h-8 text-xs"
                      value={asset.accountNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>): void => updateForeignAsset(idx, "accountNumber", e.target.value)}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Peak Balance (₹)
                      <FieldHint text="Maximum balance/value of this asset at any point during the calendar year (Jan 1 – Dec 31). Convert using SBI TTBR rate on that peak date." />
                    </Label>
                    <CurrencyInput
                      id={`peak-${idx}`}
                      value={asset.peakBalance}
                      onChange={(v: number): void => updateForeignAsset(idx, "peakBalance", v)}
                      placeholder="Max value during year"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Closing Balance (₹)
                      <FieldHint text="Value of this asset as of December 31 of the relevant calendar year. Convert at SBI TTBR rate on Dec 31." />
                    </Label>
                    <CurrencyInput
                      id={`closing-${idx}`}
                      value={asset.closingBalance}
                      onChange={(v: number): void => updateForeignAsset(idx, "closingBalance", v)}
                      placeholder="Value on Dec 31"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Acquired</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={asset.acquisitionDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>): void => updateForeignAsset(idx, "acquisitionDate", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" size="sm" onClick={addForeignAsset} className="w-full border-dashed" data-testid="button-add-foreign-asset">
            <Plus className="h-4 w-4 mr-2" /> Add Foreign Asset Entry
          </Button>

          {foreignIncomeDetails.foreignAssets.length === 0 && (
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 dark:text-blue-300 text-sm">
                Schedule FA is mandatory for residents holding foreign assets. The Income Tax Department receives data from 100+ countries via CRS (Common Reporting Standard). 
                Non-disclosure can lead to ₹10 lakh penalty and prosecution under the Black Money Act.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Foreign Capital Gains</span>
            <span className="font-bold text-lg">{formatCurrency(foreignIncomeDetails.foreignSTCG + foreignIncomeDetails.foreignLTCG)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Foreign Other Income</span>
            <span className="font-medium">{formatCurrency(foreignIncomeDetails.foreignDividends + foreignIncomeDetails.foreignInterest + foreignIncomeDetails.foreignOtherIncome)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Foreign Income</span>
            <span className="font-medium">{formatCurrency(foreignTotalInINR)}</span>
          </div>
          {foreignIncomeDetails.foreignTaxPaid > 0 && (
            <div className="flex justify-between items-center text-sm text-green-600">
              <span>Less: Foreign Tax Credit (DTAA)</span>
              <span>- {formatCurrency(foreignIncomeDetails.foreignTaxPaid)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center font-semibold">
            <span>Net Foreign Income (after FTC)</span>
            <span>{formatCurrency(foreignTotalInINR - foreignIncomeDetails.foreignTaxPaid)}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
