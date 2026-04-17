import React from "react";
import { Home, Receipt, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  FieldHint, CurrencyInput, ValidationBanner, formatCurrency 
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { ScheduleALDetails } from "../types";

export const ScheduleALSection: React.FC = (): React.ReactElement => {
  const {
    scheduleAL,
    setScheduleAL,
    assessmentYear,
    validateStep,
    currentStepId
  } = useTax();

  const currentValidation = validateStep(currentStepId);

  const computedTotalAssets = scheduleAL.immovableProperty + scheduleAL.movableAssets + scheduleAL.bankDeposits + scheduleAL.sharesAndSecurities + scheduleAL.insurancePolicies + scheduleAL.loansAndAdvancesGiven + scheduleAL.cashInHand + scheduleAL.jewelleryBullion + scheduleAL.archaeologicalCollections + scheduleAL.vehiclesYachtsBoats;
  const computedTotalLiabilities = scheduleAL.liabilitiesRelatedToImmovable + scheduleAL.liabilitiesRelatedToOther;
  const netWorth = computedTotalAssets - computedTotalLiabilities;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Schedule AL (Assets & Liabilities) is <strong>mandatory for ITR-2/3/4 when total income exceeds ₹50 lakhs</strong>. 
        Disclose all assets and liabilities as on 31st March of the assessment year. This is a wealth disclosure requirement per Income Tax rules.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" /> Part A — Assets (as on 31st March)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Immovable Assets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Land & Building (Total Value)
                  <FieldHint text="Market value of all immovable properties — residential, commercial, agricultural land. Include stamp duty value or purchase cost." />
                </Label>
                <CurrencyInput id="al-immovable" value={scheduleAL.immovableProperty} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, immovableProperty: v }))} data-testid="al-immovable" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Movable Assets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Jewellery, Bullion & Precious Items
                  <FieldHint text="Estimated value of gold, silver, diamonds, and other precious items owned." />
                </Label>
                <CurrencyInput id="al-jewellery" value={scheduleAL.jewelleryBullion} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, jewelleryBullion: v }))} data-testid="al-jewellery" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Motor Vehicles, Yachts & Boats
                  <FieldHint text="Current market value of all vehicles, yachts, boats, and aircraft owned." />
                </Label>
                <CurrencyInput id="al-vehicles" value={scheduleAL.vehiclesYachtsBoats} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, vehiclesYachtsBoats: v }))} data-testid="al-vehicles" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Archaeological Collections & Paintings
                  <FieldHint text="Value of art, antiques, archaeological artifacts, and collectible paintings." />
                </Label>
                <CurrencyInput id="al-archaeological" value={scheduleAL.archaeologicalCollections} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, archaeologicalCollections: v }))} data-testid="al-archaeological" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Other Movable Assets
                  <FieldHint text="Any other movable assets not listed above — furniture, electronics, equipment, etc." />
                </Label>
                <CurrencyInput id="al-movable" value={scheduleAL.movableAssets} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, movableAssets: v }))} data-testid="al-movable" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Assets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Bank Deposits (Savings + FD + RD)
                  <FieldHint text="Total balance in all bank accounts including savings, fixed deposits, recurring deposits." />
                </Label>
                <CurrencyInput id="al-bank" value={scheduleAL.bankDeposits} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, bankDeposits: v }))} data-testid="al-bank" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Shares & Securities (Market Value)
                  <FieldHint text="Market value of all shares, mutual funds, bonds, debentures, and other securities held." />
                </Label>
                <CurrencyInput id="al-shares" value={scheduleAL.sharesAndSecurities} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, sharesAndSecurities: v }))} data-testid="al-shares" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Insurance Policies (Surrender Value)
                  <FieldHint text="Surrender value of all life insurance policies, ULIPs, and endowment plans." />
                </Label>
                <CurrencyInput id="al-insurance" value={scheduleAL.insurancePolicies} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, insurancePolicies: v }))} data-testid="al-insurance" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Loans & Advances Given
                  <FieldHint text="Total outstanding loans given to others. Include personal loans, advance payments." />
                </Label>
                <CurrencyInput id="al-loans" value={scheduleAL.loansAndAdvancesGiven} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, loansAndAdvancesGiven: v }))} data-testid="al-loans" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Cash in Hand
                  <FieldHint text="Physical cash held as on 31st March. Disclose actual cash balance." />
                </Label>
                <CurrencyInput id="al-cash" value={scheduleAL.cashInHand} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, cashInHand: v }))} data-testid="al-cash" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Part B — Liabilities (as on 31st March)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Liabilities Related to Immovable Property
                <FieldHint text="Outstanding home loans, property loans, or mortgages on land & buildings." />
              </Label>
              <CurrencyInput id="al-liab-immovable" value={scheduleAL.liabilitiesRelatedToImmovable} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, liabilitiesRelatedToImmovable: v }))} data-testid="al-liab-immovable" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Other Liabilities (Personal/Vehicle Loans)
                <FieldHint text="Outstanding personal loans, car loans, credit card dues, and any other liabilities." />
              </Label>
              <CurrencyInput id="al-liab-other" value={scheduleAL.liabilitiesRelatedToOther} onChange={(v: number): void => setScheduleAL((prev: ScheduleALDetails) => ({ ...prev, liabilitiesRelatedToOther: v }))} data-testid="al-liab-other" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Total Assets</span>
            <span className="font-bold text-blue-600">{formatCurrency(computedTotalAssets)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Total Liabilities</span>
            <span className="font-bold text-red-600">{formatCurrency(computedTotalLiabilities)}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-medium">Net Worth (Assets − Liabilities)</span>
            <span className={`font-bold text-lg ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netWorth)}</span>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Important:</strong> Ensure all assets are disclosed at their value as on 31st March {assessmentYear ? parseInt(assessmentYear) - 1 : '2025'}. 
          Non-disclosure or under-reporting may attract penalty under Section 271(1)(c) for concealment of income and assets.
        </AlertDescription>
      </Alert>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
