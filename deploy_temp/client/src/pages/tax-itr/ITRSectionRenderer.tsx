import React from "react";
import { useTax } from "./TaxContext";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { IncomeSourcesSection } from "./sections/IncomeSourcesSection";
import { SalarySection } from "./sections/SalarySection";
import { HousePropertySection } from "./sections/HousePropertySection";
import { BusinessIncomeSection } from "./sections/BusinessIncomeSection";
import { FinancialsSection } from "./sections/FinancialsSection";
import { CapitalGainsSection } from "./sections/CapitalGainsSection";
import { ForeignIncomeSection } from "./sections/ForeignIncomeSection";
import { OtherIncomeSection } from "./sections/OtherIncomeSection";
import { DisclosuresSection } from "./sections/DisclosuresSection";
import { DeductionsSection } from "./sections/DeductionsSection";
import { ScheduleALSection } from "./sections/ScheduleALSection";
import { LossAdjustmentSection } from "./sections/LossAdjustmentSection";
import { SIEISchedulesSection } from "./sections/SIEISchedulesSection";
import { TaxPaymentsSection } from "./sections/TaxPaymentsSection";
import { ReviewSection } from "./sections/ReviewSection";
import { EntityProfileSection } from "./sections/EntityProfileSection";
import { TrustIncomeSection } from "./sections/TrustIncomeSection";
import { ScheduleSPISection } from "./sections/ScheduleSPISection";
import { Schedule5ASection } from "./sections/Schedule5ASection";
import { ScheduleIFSection } from "./sections/ScheduleIFSection";
import { MATAMTSection } from "./sections/MATAMTSection";
import { TDSSchedulesSection } from "./sections/TDSSchedulesSection";

export function ITRSectionRenderer(): React.ReactElement {
  const { currentStepId } = useTax();
  const stepId = currentStepId;

  switch (stepId) {
    case "basic": return <BasicInfoSection />;
    case "sources": return <IncomeSourcesSection />;
    case "entity_profile": return <EntityProfileSection />;
    case "salary": return <SalarySection />;
    case "property": return <HousePropertySection />;
    case "business": return <BusinessIncomeSection />;
    case "financials": return <FinancialsSection />;
    case "capital": return <CapitalGainsSection />;
    case "foreign": return <ForeignIncomeSection />;
    case "other": return <OtherIncomeSection />;
    case "disclosures": return <DisclosuresSection />;
    case "trust_income": return <TrustIncomeSection />;
    case "deductions": return <DeductionsSection />;
    case "schedule_al": return <ScheduleALSection />;
    case "loss_adjustment": return <LossAdjustmentSection />;
    case "schedule_si_ei": return <SIEISchedulesSection />;
    case "schedule_spi": return <ScheduleSPISection />;
    case "schedule_5a": return <Schedule5ASection />;
    case "schedule_if": return <ScheduleIFSection />;
    case "mat_amt": return <MATAMTSection />;
    case "tds_schedules": return <TDSSchedulesSection />;
    case "tax_payments": return <TaxPaymentsSection />;
    case "review": return <ReviewSection />;
    default: return <div className="p-8 text-center text-muted-foreground">Step not found: {currentStepId}</div>;
  }
};
