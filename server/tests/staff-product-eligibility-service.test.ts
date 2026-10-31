import { describe, it, expect } from "vitest";
import {
  staffProductEligibilityService,
  StaffCredentialsProfile,
  MULTI_VENDOR_PRODUCT_CATALOG,
} from "../services/staff-product-eligibility-service";

describe("StaffProductEligibilityService - Multi-Vendor Portal Products Governance", () => {
  it("should return the complete statutory multi-vendor product catalog", () => {
    const matrix = staffProductEligibilityService.getVendorProductMatrix();
    expect(matrix.length).toBe(11);

    const sif = matrix.find((m) => m.productCode === "sif");
    expect(sif).toBeDefined();
    expect(sif?.regulator).toBe("SEBI");
    expect(sif?.primaryVendors).toContain("IRIS");
    expect(sif?.requiresEuin).toBe(true);
    expect(sif?.minExperienceYears).toBe(2);

    const mf = matrix.find((m) => m.productCode === "mutual_funds");
    expect(mf?.primaryVendors).toContain("IRIS");
    expect(mf?.regulator).toBe("SEBI");
    expect(mf?.requiresEuin).toBe(true);

    const fno = matrix.find((m) => m.productCode === "equity_derivatives");
    expect(fno?.primaryVendors).toContain("UPSTOX");
    expect(fno?.mandatoryCertifications).toContain("NISM_VIII");

    const ins = matrix.find((m) => m.productCode === "insurance");
    expect(ins?.regulator).toBe("IRDAI");
    expect(ins?.requiresPosp).toBe(true);
  });

  it("should authorize SIF (Specified Investment Funds) when staff has EUIN, NISM V-A/X-A, and >= 2 years experience", () => {
    const staffWithSif: StaffCredentialsProfile = {
      staffId: "stf-sif-01",
      name: "Ramesh Iyer",
      email: "ramesh.iyer@example.com",
      role: "agent",
      panNumber: "ABCDE9876F",
      panVerified: true,
      kycStatus: "VERIFIED",
      euinNumber: "E654321",
      euinVerified: true,
      yearsOfExperience: 3,
      certifications: [
        { code: "NISM_V_A", validUntil: "2029-01-01", isVerified: true },
      ],
    };

    const report = staffProductEligibilityService.evaluateStaffProductEligibility(staffWithSif);
    const sifEval = report.productEvaluations.find((p) => p.productCode === "sif");
    expect(sifEval?.accessLevel).toBe("FULL_MANAGEMENT");
    expect(sifEval?.canExecuteOrders).toBe(true);
    expect(sifEval?.primaryVendors).toContain("IRIS");

    // Ineligible case: lack of experience (< 2 years) for complex SIF derivatives
    const staffLowExp: StaffCredentialsProfile = {
      ...staffWithSif,
      yearsOfExperience: 1,
    };
    const reportLowExp = staffProductEligibilityService.evaluateStaffProductEligibility(staffLowExp);
    const sifLowExp = reportLowExp.productEvaluations.find((p) => p.productCode === "sif");
    expect(sifLowExp?.accessLevel).not.toBe("FULL_MANAGEMENT");
  });

  it("should authorize IRIS Mutual Funds when staff has valid EUIN and NISM Series V-A", () => {
    const staff: StaffCredentialsProfile = {
      staffId: "stf-001",
      name: "Aakash Gupta",
      email: "aakash@example.com",
      role: "agent",
      panNumber: "ABCDE1234F",
      panVerified: true,
      kycStatus: "VERIFIED",
      euinNumber: "E123456",
      euinVerified: true,
      yearsOfExperience: 2,
      certifications: [
        { code: "NISM_V_A", validUntil: "2028-12-31", isVerified: true },
      ],
    };

    const report = staffProductEligibilityService.evaluateStaffProductEligibility(staff);
    const mfEval = report.productEvaluations.find((p) => p.productCode === "mutual_funds");
    expect(mfEval?.accessLevel).toBe("FULL_MANAGEMENT");
    expect(mfEval?.canExecuteOrders).toBe(true);
    expect(report.authorizedVendors).toContain("IRIS");
  });

  it("should block IRIS Mutual Funds execution when staff lacks EUIN", () => {
    const staff: StaffCredentialsProfile = {
      staffId: "stf-002",
      name: "Karan Mehta",
      email: "karan@example.com",
      role: "agent",
      panNumber: "PQRST5678K",
      panVerified: true,
      kycStatus: "VERIFIED",
      // No EUIN
      yearsOfExperience: 1,
      certifications: [],
    };

    const report = staffProductEligibilityService.evaluateStaffProductEligibility(staff);
    const mfEval = report.productEvaluations.find((p) => p.productCode === "mutual_funds");
    expect(mfEval?.accessLevel).not.toBe("FULL_MANAGEMENT");
    expect(mfEval?.canExecuteOrders).toBe(false);
    expect(mfEval?.failedChecks).toContain("Mandatory EUIN missing or unverified");
  });

  it("should authorize Insurance products ONLY when staff holds valid IRDAI POSP certification", () => {
    const staffWithoutPosp: StaffCredentialsProfile = {
      staffId: "stf-003",
      name: "Meera Sen",
      email: "meera@example.com",
      role: "agent",
      panNumber: "LMNOP9876Q",
      panVerified: true,
      kycStatus: "VERIFIED",
      yearsOfExperience: 2,
    };

    const reportBlocked = staffProductEligibilityService.evaluateStaffProductEligibility(staffWithoutPosp);
    const insBlocked = reportBlocked.productEvaluations.find((p) => p.productCode === "insurance");
    expect(insBlocked?.accessLevel).not.toBe("FULL_MANAGEMENT");
    expect(insBlocked?.failedChecks).toContain("IRDAI POSP certification missing");

    const staffWithPosp: StaffCredentialsProfile = {
      ...staffWithoutPosp,
      pospCertificateNumber: "POSP-IRDAI-2025-A1B2C3",
      pospVerified: true,
    };

    const reportAllowed = staffProductEligibilityService.evaluateStaffProductEligibility(staffWithPosp);
    const insAllowed = reportAllowed.productEvaluations.find((p) => p.productCode === "insurance");
    expect(insAllowed?.accessLevel).toBe("FULL_MANAGEMENT");
    expect(insAllowed?.canExecuteOrders).toBe(true);
  });

  it("should authorize Upstox Derivatives ONLY when staff holds NISM Series VIII", () => {
    const staffWithNism8: StaffCredentialsProfile = {
      staffId: "stf-004",
      name: "Rajiv Nair",
      email: "rajiv@example.com",
      role: "agent",
      panNumber: "XYZAB1234D",
      panVerified: true,
      kycStatus: "VERIFIED",
      yearsOfExperience: 2,
      certifications: [
        { code: "NISM_VIII", validUntil: "2029-01-01", isVerified: true },
      ],
    };

    const report = staffProductEligibilityService.evaluateStaffProductEligibility(staffWithNism8);
    const fnoEval = report.productEvaluations.find((p) => p.productCode === "equity_derivatives");
    expect(fnoEval?.accessLevel).toBe("FULL_MANAGEMENT");
    expect(fnoEval?.canExecuteOrders).toBe(true);
    expect(fnoEval?.primaryVendors).toContain("UPSTOX");
  });

  it("should authorize Bank Lending & LAS ONLY when staff has active DSA code", () => {
    const staffWithDsa: StaffCredentialsProfile = {
      staffId: "stf-005",
      name: "Sanjay Joshi",
      email: "sanjay@example.com",
      role: "agent",
      panNumber: "GHJKL5678E",
      panVerified: true,
      kycStatus: "VERIFIED",
      dsaCode: "DSA-BAJAJ-9921",
      dsaVerified: true,
      yearsOfExperience: 1,
    };

    const report = staffProductEligibilityService.evaluateStaffProductEligibility(staffWithDsa);
    const loanEval = report.productEvaluations.find((p) => p.productCode === "lending_loans");
    expect(loanEval?.accessLevel).toBe("FULL_MANAGEMENT");
    expect(loanEval?.primaryVendors).toContain("BAJAJ");
    expect(loanEval?.primaryVendors).toContain("IRIS_LAS");
  });
});

