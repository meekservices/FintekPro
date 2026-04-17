import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTax } from "../TaxContext";
import { Schedule5ADetails, ScheduleIFEntry } from "../types";

export const Schedule5ASection: React.FC = (): React.ReactElement => {
  const {
    schedule5A,
    setSchedule5A,
    scheduleIF,
    setScheduleIF
  } = useTax();
  const totalFirmIncome = scheduleIF.reduce((sum: number, e: ScheduleIFEntry) => sum + e.shareOfProfit + e.shareOfSalary + e.shareOfInterest + e.shareOfBonus + e.shareOfCommission, 0);
  const totalAssessee = schedule5A.headwiseBreakdown.salary.assessee + schedule5A.headwiseBreakdown.houseProperty.assessee + schedule5A.headwiseBreakdown.business.assessee + schedule5A.headwiseBreakdown.capitalGains.assessee + schedule5A.headwiseBreakdown.otherSources.assessee;
  const totalSpouse = schedule5A.headwiseBreakdown.salary.spouse + schedule5A.headwiseBreakdown.houseProperty.spouse + schedule5A.headwiseBreakdown.business.spouse + schedule5A.headwiseBreakdown.capitalGains.spouse + schedule5A.headwiseBreakdown.otherSources.spouse;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule 5A — Apportionment of Income (Portuguese Civil Code)</CardTitle>
          <CardDescription>For residents of Goa and Union Territories of Dadra & Nagar Haveli and Daman & Diu married under Portuguese Civil Code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={schedule5A.isApplicable} onCheckedChange={(v: boolean): void => setSchedule5A((p: Schedule5ADetails) => ({ ...p, isApplicable: v }))} />
            <Label className="text-sm">Portuguese Civil Code is applicable to me</Label>
          </div>

          {schedule5A.isApplicable && (
            <>
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Under Portuguese Civil Code, income earned by either spouse is apportioned equally (50:50) between husband and wife. Each spouse reports their 50% share in their individual ITR.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name of Spouse</Label>
                  <Input value={schedule5A.nameOfSpouse} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setSchedule5A((p: Schedule5ADetails) => ({ ...p, nameOfSpouse: e.target.value }))} placeholder="Spouse's full name" />
                </div>
                <div>
                  <Label className="text-xs">PAN of Spouse</Label>
                  <Input value={schedule5A.panOfSpouse} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setSchedule5A((p: Schedule5ADetails) => ({ ...p, panOfSpouse: e.target.value.toUpperCase() }))} placeholder="AAAAA0000A" maxLength={10} />
                </div>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4">Head-wise Income Apportionment</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Income Head</th>
                      <th className="text-right py-2 px-2">Your Share (₹)</th>
                      <th className="text-right py-2 px-2">Spouse Share (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["salary", "houseProperty", "business", "capitalGains", "otherSources"] as const).map(head => (
                      <tr key={head} className="border-b">
                        <td className="py-2 px-2 capitalize">{head === "houseProperty" ? "House Property" : head === "capitalGains" ? "Capital Gains" : head === "otherSources" ? "Other Sources" : head}</td>
                        <td className="py-1 px-2">
                          <Input type="number" className="h-8 text-xs text-right" value={schedule5A.headwiseBreakdown[head].assessee || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setSchedule5A((p: Schedule5ADetails) => ({ ...p, headwiseBreakdown: { ...p.headwiseBreakdown, [head]: { ...p.headwiseBreakdown[head], assessee: Number(e.target.value) } } }))} />
                        </td>
                        <td className="py-1 px-2">
                          <Input type="number" className="h-8 text-xs text-right" value={schedule5A.headwiseBreakdown[head].spouse || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setSchedule5A((p: Schedule5ADetails) => ({ ...p, headwiseBreakdown: { ...p.headwiseBreakdown, [head]: { ...p.headwiseBreakdown[head], spouse: Number(e.target.value) } } }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t-2">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">₹{totalAssessee.toLocaleString("en-IN")}</td>
                      <td className="py-2 px-2 text-right">₹{totalSpouse.toLocaleString("en-IN")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
