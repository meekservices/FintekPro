import React from "react";
import { 
  Briefcase, Home, TrendingUp, Building2, Globe, Wallet, FileText 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ValidationBanner } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { formScheduleMap } from "../constants";
import { IncomeSource } from "../types";

export const IncomeSourcesSection: React.FC = (): React.ReactElement => {
  const {
    assessmentYear,
    incomeSources,
    setIncomeSources,
    recommendedForm,
    residentialStatus,
    housePropertyDetails,
    isEntityForm,
    panContext,
    validateStep,
    currentStepId
  } = useTax();

  const currentValidation = validateStep(currentStepId);

  interface SourceItem {
    key: string;
    label: string;
    icon: React.ElementType;
    desc: string;
    color: string;
  }

  const sources: SourceItem[] = [
    { key: "hasSalary", label: "Salary / Pension", icon: Briefcase, desc: "Income from employment, Form 16", color: "text-blue-600" },
    { key: "hasHouseProperty", label: "House Property", icon: Home, desc: "Rental income or home loan interest", color: "text-green-600" },
    { key: "hasCapitalGains", label: "Capital Gains", icon: TrendingUp, desc: "Stocks, MFs, property sale, STT/non-STT split", color: "text-purple-600" },
    { key: "hasBusinessIncome", label: "Business / Profession", icon: Building2, desc: "Self-employed, freelancer, F&O, business P&L", color: "text-orange-600" },
    { key: "hasForeignIncome", label: "Foreign Income / Global Stocks", icon: Globe, desc: "US/global stocks, DTAA relief, Schedule FA & FSI", color: "text-red-600" },
    { key: "hasOtherIncome", label: "Other Sources", icon: Wallet, desc: "FD/savings interest, dividends, lottery, gaming", color: "text-teal-600" }
  ];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Select all sources of income for FY {assessmentYear === "2026-27" ? "2025-26" : assessmentYear === "2025-26" ? "2024-25" : assessmentYear === "2024-25" ? "2023-24" : "2022-23"}. 
        The system will automatically select the correct ITR form — schedules adjust internally.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((source: SourceItem): React.ReactElement => {
          const Icon = source.icon;
          const isChecked = incomeSources[source.key as keyof IncomeSource];
          return (
            <Card 
              key={source.key} 
              className={`cursor-pointer transition-all hover:shadow-sm ${isChecked ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-muted-foreground/40'}`}
              onClick={(): void => setIncomeSources((prev: IncomeSource): IncomeSource => ({ ...prev, [source.key]: !prev[source.key as keyof IncomeSource] }))}
              data-testid={`card-source-${source.key}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox checked={isChecked} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${source.color}`} />
                    <span className="font-medium text-sm">{source.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{source.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className={`border-2 ${
        recommendedForm === "ITR-1" ? "border-green-300 bg-green-50 dark:bg-green-950" :
        recommendedForm === "ITR-2" ? "border-blue-300 bg-blue-50 dark:bg-blue-950" :
        recommendedForm === "ITR-3" ? "border-orange-300 bg-orange-50 dark:bg-orange-950" :
        recommendedForm === "ITR-4" ? "border-amber-300 bg-amber-50 dark:bg-amber-950" :
        "border-purple-300 bg-purple-50 dark:bg-purple-950"
      }`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              recommendedForm === "ITR-1" ? "bg-green-100 dark:bg-green-900" :
              recommendedForm === "ITR-2" ? "bg-blue-100 dark:bg-blue-900" :
              "bg-purple-100 dark:bg-purple-900"
            }`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                Auto-selected: {recommendedForm} {
                  recommendedForm === "ITR-1" ? "(Sahaj)" :
                  recommendedForm === "ITR-2" ? "(Individual/HUF — No Business)" :
                  recommendedForm === "ITR-3" ? "(Business/Profession)" :
                  recommendedForm === "ITR-4" ? "(Sugam — Presumptive)" :
                  recommendedForm === "ITR-5" ? "(Firm/LLP/AOP)" :
                  recommendedForm === "ITR-6" ? "(Company)" : "(Trust/Charity)"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Based on your PAN type and income sources. Steps and schedules adjust automatically.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(formScheduleMap[recommendedForm] as string[] || []).map((sch: string, i: number): React.ReactElement => (
              <Badge key={i} variant="secondary" className="text-xs">{sch}</Badge>
            ))}
          </div>
          {recommendedForm !== "ITR-1" && (
            <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
              <strong>Why not ITR-1?</strong>{" "}
              {incomeSources.hasCapitalGains && "Capital gains require ITR-2+. "}
              {incomeSources.hasForeignIncome && "Foreign income/assets require ITR-2+. "}
              {incomeSources.hasBusinessIncome && "Business income requires ITR-3/4. "}
              {residentialStatus !== "resident" && "NRI/RNOR status requires ITR-2+. "}
              {housePropertyDetails.propertyCount > 1 && "Multiple properties require ITR-2+. "}
              {isEntityForm && `Entity type (${panContext?.panType}) requires ${recommendedForm}. `}
            </div>
          )}
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );
};
