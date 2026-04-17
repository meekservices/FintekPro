import React from "react";
import { Info, Users, XCircle, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CurrencyInput, FieldHint 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { ScheduleSPIEntry } from "../types";

export const ScheduleSPISection: React.FC = (): React.ReactElement => {
  const {
    scheduleSPI,
    setScheduleSPI
  } = useTax();
  const totalClubbedIncome = scheduleSPI.reduce((sum: number, e: ScheduleSPIEntry): number => sum + e.amountIncluded, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule SPI — Income of Specified Persons (Clubbing)</CardTitle>
          <CardDescription>Income from spouse, minor child, or son's wife that is clubbed with your income under Section 64</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Under Section 64, income from assets transferred to spouse, minor child, or son's wife without adequate consideration is clubbed with the transferor's income. Each minor child gets ₹1,500 exemption u/s 10(32).
            </AlertDescription>
          </Alert>

          {scheduleSPI.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clubbing entries added yet</p>
              <p className="text-xs mt-1">Click below to add income of specified persons</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleSPI.map((entry: ScheduleSPIEntry, idx: number) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">Person {idx + 1}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.filter((_, i) => i !== idx))}>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name of Person</Label>
                        <Input value={entry.nameOfPerson} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, nameOfPerson: e.target.value } : p))} placeholder="Full name" />
                      </div>
                      <div>
                        <Label className="text-xs">PAN of Person</Label>
                        <Input value={entry.panOfPerson} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, panOfPerson: e.target.value.toUpperCase() } : p))} placeholder="AAAAA0000A" maxLength={10} />
                      </div>
                      <div>
                        <Label className="text-xs">Relationship <FieldHint text="Relationship of specified person with the assessee" /></Label>
                        <Select value={entry.relationshipCode} onValueChange={(v: string): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, relationshipCode: v as ScheduleSPIEntry['relationshipCode'] } : p))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="son">Son (Major)</SelectItem>
                            <SelectItem value="daughter">Daughter (Major)</SelectItem>
                            <SelectItem value="son_wife">Son's Wife</SelectItem>
                            <SelectItem value="minor_son">Minor Son</SelectItem>
                            <SelectItem value="minor_daughter">Minor Daughter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Section Applicable</Label>
                        <Select value={entry.section} onValueChange={(v: string): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, section: v as ScheduleSPIEntry['section'] } : p))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="64(1)(ii)">Sec 64(1)(ii) — Spouse</SelectItem>
                            <SelectItem value="64(1)(iv)">Sec 64(1)(iv) — Spouse/Son's wife</SelectItem>
                            <SelectItem value="64(1A)">Sec 64(1A) — Minor child</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Type of Income</Label>
                        <Select value={entry.incomeType} onValueChange={(v: string): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, incomeType: v as ScheduleSPIEntry['incomeType'] } : p))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="house_property">House Property</SelectItem>
                            <SelectItem value="business">Business / Profession</SelectItem>
                            <SelectItem value="capital_gains">Capital Gains</SelectItem>
                            <SelectItem value="other_sources">Other Sources</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Amount Included (₹)</Label>
                        <CurrencyInput id={`spi-amount-${idx}`} value={entry.amountIncluded} onChange={(v: number): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, amountIncluded: v } : p))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Remarks</Label>
                      <Input value={entry.remarks} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => prev.map((p: ScheduleSPIEntry, i: number): ScheduleSPIEntry => i === idx ? { ...p, remarks: e.target.value } : p))} placeholder="Nature of income / asset transferred" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={(): void => setScheduleSPI((prev: ScheduleSPIEntry[]) => [...prev, { nameOfPerson: "", panOfPerson: "", relationshipCode: "spouse", incomeType: "other_sources", amountIncluded: 0, section: "64(1)(ii)", remarks: "" }])} data-testid="btn-add-spi">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Specified Person
          </Button>

          {scheduleSPI.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex justify-between font-semibold">
                <span>Total Clubbed Income</span>
                <span>₹{totalClubbedIncome.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">This amount will be added to your Gross Total Income</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
