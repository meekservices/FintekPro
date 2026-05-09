import React from "react";
import { Info, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { CYLAAdjustment, BFLAAdjustment, CFLEntry } from "../types";

export const LossAdjustmentSection: React.FC = () => {
  const { cyla, bfla, cfl, lossCarryForward } = useTax();

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Auto-computed loss adjustment schedules per Income Tax Act rules. CYLA adjusts current year losses across income heads; BFLA applies brought-forward losses from prior years; CFL shows remaining losses carried to future years.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule CYLA — Current Year Loss Adjustment</CardTitle>
          <CardDescription>Inter-head set-off of current year losses (HP loss max ₹2L against other heads; business loss against all except salary)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 font-medium">Head of Income</th>
                  <th className="text-right py-2 px-1 font-medium">Income</th>
                  <th className="text-right py-2 px-1 font-medium text-red-600">HP Loss Set-off</th>
                  <th className="text-right py-2 px-1 font-medium text-red-600">Business Loss</th>
                  <th className="text-right py-2 px-1 font-medium">After Set-off</th>
                </tr>
              </thead>
              <tbody>
                {cyla.adjustments.map((a: CYLAAdjustment, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 px-1 font-medium">{a.head}</td>
                    <td className="py-2 px-1 text-right">{formatCurrency(a.incomeBeforeSetOff)}</td>
                    <td className="py-2 px-1 text-right text-red-600">{a.hpLossSetOff > 0 ? `- ${formatCurrency(a.hpLossSetOff)}` : '—'}</td>
                    <td className="py-2 px-1 text-right text-red-600">{a.businessLossSetOff > 0 ? `- ${formatCurrency(a.businessLossSetOff)}` : '—'}</td>
                    <td className="py-2 px-1 text-right font-medium">{formatCurrency(a.incomeAfterSetOff)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-1">Total Income After CYLA</td>
                  <td colSpan={3}></td>
                  <td className="py-2 px-1 text-right">{formatCurrency(cyla.totalIncomeAfterCYLA)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {(cyla.unabsorbedHPLoss > 0 || cyla.unabsorbedBizLoss > 0 || cyla.currentYearSTCLoss > 0 || cyla.currentYearLTCLoss > 0) && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs space-y-1">
              {cyla.unabsorbedHPLoss > 0 && <p>Unabsorbed HP Loss: {formatCurrency(cyla.unabsorbedHPLoss)} (carry forward — no time limit)</p>}
              {cyla.unabsorbedBizLoss > 0 && <p>Unabsorbed Business Loss: {formatCurrency(cyla.unabsorbedBizLoss)} (carry forward — 8 AYs)</p>}
              {cyla.currentYearSTCLoss > 0 && <p>Current Year STCL: {formatCurrency(cyla.currentYearSTCLoss)} (carry forward — 8 AYs)</p>}
              {cyla.currentYearLTCLoss > 0 && <p>Current Year LTCL: {formatCurrency(cyla.currentYearLTCLoss)} (carry forward — 8 AYs, set-off only against LTCG)</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule BFLA — Brought Forward Loss Adjustment</CardTitle>
          <CardDescription>Set-off of losses from prior assessment years against current year income (after CYLA)</CardDescription>
        </CardHeader>
        <CardContent>
          {lossCarryForward.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <p>No brought-forward losses entered. Add prior year losses in the Disclosures step to see BFLA adjustments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium">Head</th>
                    <th className="text-right py-2 px-1 font-medium">After CYLA</th>
                    <th className="text-right py-2 px-1 font-medium text-orange-600">BF HP Loss</th>
                    <th className="text-right py-2 px-1 font-medium text-orange-600">BF STCL</th>
                    <th className="text-right py-2 px-1 font-medium text-orange-600">BF LTCL</th>
                    <th className="text-right py-2 px-1 font-medium text-orange-600">BF Business</th>
                    <th className="text-right py-2 px-1 font-medium">After BFLA</th>
                  </tr>
                </thead>
                <tbody>
                  {bfla.bflaRows.map((r: BFLAAdjustment, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-1 font-medium">{r.head}</td>
                      <td className="py-2 px-1 text-right">{formatCurrency(r.incomeAfterCYLA)}</td>
                      <td className="py-2 px-1 text-right text-orange-600">{r.bfHPLossSetOff > 0 ? `- ${formatCurrency(r.bfHPLossSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right text-orange-600">{r.bfSTCLSetOff > 0 ? `- ${formatCurrency(r.bfSTCLSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right text-orange-600">{r.bfLTCLSetOff > 0 ? `- ${formatCurrency(r.bfLTCLSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right text-orange-600">{r.bfBusinessLossSetOff > 0 ? `- ${formatCurrency(r.bfBusinessLossSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right font-medium">{formatCurrency(r.incomeAfterBFLA)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 px-1">Total After BFLA</td>
                    <td colSpan={5}></td>
                    <td className="py-2 px-1 text-right">{formatCurrency(bfla.totalIncomeAfterBFLA)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule CFL — Losses to Carry Forward</CardTitle>
          <CardDescription>Losses remaining after CYLA + BFLA, available for set-off in future assessment years</CardDescription>
        </CardHeader>
        <CardContent>
          {cfl.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p>No losses to carry forward. All losses have been fully absorbed in the current year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium">Assessment Year</th>
                    <th className="text-right py-2 px-1 font-medium">HP Loss</th>
                    <th className="text-right py-2 px-1 font-medium">STCL</th>
                    <th className="text-right py-2 px-1 font-medium">LTCL</th>
                    <th className="text-right py-2 px-1 font-medium">Business</th>
                    <th className="text-right py-2 px-1 font-medium">Speculation</th>
                    <th className="text-right py-2 px-1 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cfl.map((e: CFLEntry, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-1 font-medium">{e.assessmentYear}</td>
                      <td className="py-2 px-1 text-right">{e.housePropertyLoss > 0 ? formatCurrency(e.housePropertyLoss) : '—'}</td>
                      <td className="py-2 px-1 text-right">{e.shortTermCapitalLoss > 0 ? formatCurrency(e.shortTermCapitalLoss) : '—'}</td>
                      <td className="py-2 px-1 text-right">{e.longTermCapitalLoss > 0 ? formatCurrency(e.longTermCapitalLoss) : '—'}</td>
                      <td className="py-2 px-1 text-right">{e.businessLoss > 0 ? formatCurrency(e.businessLoss) : '—'}</td>
                      <td className="py-2 px-1 text-right">{e.speculativeBusinessLoss > 0 ? formatCurrency(e.speculativeBusinessLoss) : '—'}</td>
                      <td className="py-2 px-1 text-right font-medium">{formatCurrency(e.housePropertyLoss + e.shortTermCapitalLoss + e.longTermCapitalLoss + e.businessLoss + e.speculativeBusinessLoss + e.specifiedBusinessLoss)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs space-y-1">
            <p><strong>Carry-forward rules:</strong></p>
            <p>House Property Loss — No time limit for carry-forward</p>
            <p>Capital Losses (STCL/LTCL) — 8 assessment years; LTCL only against LTCG</p>
            <p>Business Loss — 8 assessment years; against any head except salary</p>
            <p>Speculation Loss — 4 assessment years; only against speculation income</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
