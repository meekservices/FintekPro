import React from "react";
import { Info, Building2, XCircle, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  CurrencyInput, FieldHint 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { ScheduleIFEntry } from "../types";

export const ScheduleIFSection: React.FC = (): React.ReactElement => {
  const {
    scheduleIF,
    setScheduleIF
  } = useTax();
  const totalFirmIncome = scheduleIF.reduce((sum: number, e: ScheduleIFEntry): number => sum + e.shareOfProfit + e.shareOfSalary + e.shareOfInterest + e.shareOfBonus + e.shareOfCommission, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule IF — Information regarding Partnership Firms</CardTitle>
          <CardDescription>Details of firms in which you are a partner and income received from such firms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Share of profit from a partnership firm is exempt u/s 10(2A). However, salary, interest on capital, bonus, and commission received from the firm are taxable under "Business/Profession".
            </AlertDescription>
          </Alert>

          {scheduleIF.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No partnership firm entries</p>
              <p className="text-xs mt-1">Add details if you are a partner in any firm</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleIF.map((entry: ScheduleIFEntry, idx: number) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">Firm {idx + 1}</Badge>
                      <Button variant="ghost" size="sm" onClick={(): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.filter((_: ScheduleIFEntry, i: number): boolean => i !== idx))}>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name of Firm</Label>
                        <Input value={entry.firmName} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, firmName: e.target.value } : p))} placeholder="Firm name" />
                      </div>
                      <div>
                        <Label className="text-xs">PAN of Firm</Label>
                        <Input value={entry.firmPAN} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, firmPAN: e.target.value.toUpperCase() } : p))} placeholder="AAAAA0000A" maxLength={10} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Address of Firm</Label>
                        <Input value={entry.firmAddress} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, firmAddress: e.target.value } : p))} placeholder="Complete address" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income from Firm</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Share of Profit (₹) <FieldHint text="Exempt u/s 10(2A)" /></Label>
                        <CurrencyInput id={`if-profit-${idx}`} value={entry.shareOfProfit} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, shareOfProfit: v } : p))} />
                      </div>
                      <div>
                        <Label className="text-xs">Salary (₹) <FieldHint text="Taxable under Business/Profession" /></Label>
                        <CurrencyInput id={`if-salary-${idx}`} value={entry.shareOfSalary} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, shareOfSalary: v } : p))} />
                      </div>
                      <div>
                        <Label className="text-xs">Interest on Capital (₹)</Label>
                        <CurrencyInput id={`if-interest-${idx}`} value={entry.shareOfInterest} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, shareOfInterest: v } : p))} />
                      </div>
                      <div>
                        <Label className="text-xs">Bonus (₹)</Label>
                        <CurrencyInput id={`if-bonus-${idx}`} value={entry.shareOfBonus} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, shareOfBonus: v } : p))} />
                      </div>
                      <div>
                        <Label className="text-xs">Commission (₹)</Label>
                        <CurrencyInput id={`if-commission-${idx}`} value={entry.shareOfCommission} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, shareOfCommission: v } : p))} />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capital Balance</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Balance on 1st April (₹)</Label>
                        <CurrencyInput id={`if-cap-open-${idx}`} value={entry.capitalBalanceOnApril1} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, capitalBalanceOnApril1: v } : p))} />
                      </div>
                      <div>
                        <Label className="text-xs">Balance on 31st March (₹)</Label>
                        <CurrencyInput id={`if-cap-close-${idx}`} value={entry.capitalBalanceOnMarch31} onChange={(v: number): void => setScheduleIF((prev: ScheduleIFEntry[]) => prev.map((p: ScheduleIFEntry, i: number): ScheduleIFEntry => i === idx ? { ...p, capitalBalanceOnMarch31: v } : p))} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={(): void => setScheduleIF((prev: ScheduleIFEntry[]) => [...prev, { firmName: "", firmPAN: "", firmAddress: "", assessmentYear: "2025-26", shareOfProfit: 0, shareOfSalary: 0, shareOfInterest: 0, shareOfBonus: 0, shareOfCommission: 0, capitalBalanceOnApril1: 0, capitalBalanceOnMarch31: 0, isPartnerInAOP: false }])} data-testid="btn-add-if">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Partnership Firm
          </Button>

          {scheduleIF.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total Taxable Income from Firms</span>
                <span className="font-semibold">₹{(totalFirmIncome - scheduleIF.reduce((s: number, e: ScheduleIFEntry): number => s + e.shareOfProfit, 0)).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Exempt Profit Share u/s 10(2A)</span>
                <span>₹{scheduleIF.reduce((s: number, e: ScheduleIFEntry): number => s + e.shareOfProfit, 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
