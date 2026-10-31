import { describe, it, expect } from "vitest";
import {
  teamDesignationService,
  CandidateProfile,
  STANDARD_DESIGNATIONS,
} from "../services/team-designation-service";

describe("TeamDesignationService - Candidate Eligibility & IRIS Alignment", () => {
  it("should list all standard designations with valid statutory basis and IRIS classification", () => {
    const designations = teamDesignationService.getAllDesignations();
    expect(designations.length).toBeGreaterThanOrEqual(8);

    const rm = designations.find((d) => d.id === "relationship_manager");
    expect(rm).toBeDefined();
    expect(rm?.irisClassification).toBe("rm");
    expect(rm?.requiresEuin).toBe(true);
    expect(rm?.requiredCertifications).toContain("NISM_V_A");
    expect(rm?.canExecuteTransactions).toBe(true);

    const leadAssociate = designations.find((d) => d.id === "lead_associate");
    expect(leadAssociate).toBeDefined();
    expect(leadAssociate?.irisClassification).toBe("internal_only");
    expect(leadAssociate?.requiresEuin).toBe(false);
    expect(leadAssociate?.canExecuteTransactions).toBe(false);
  });

  it("should evaluate a fully qualified candidate as ELIGIBLE for Relationship Manager", () => {
    const candidate: CandidateProfile = {
      name: "Rohit Sharma",
      email: "rohit.sharma@example.com",
      mobile: "9876543210",
      panNumber: "ABCDE1234F",
      panVerified: true,
      kycStatus: "VERIFIED",
      euinNumber: "E123456",
      euinVerified: true,
      highestEducation: "bachelors",
      yearsOfExperience: 2,
      certifications: [
        {
          code: "NISM_V_A",
          name: "NISM Series V-A Mutual Fund Distributors",
          certificateNumber: "NISM-2024-12345",
          validUntil: "2028-12-31",
          isVerified: true,
        },
      ],
    };

    const report = teamDesignationService.evaluateCandidateEligibility(candidate, "relationship_manager");
    expect(report.isEligible).toBe(true);
    expect(report.overallScore).toBeGreaterThanOrEqual(80);
    expect(report.canExecuteTransactions).toBe(true);
    expect(report.irisSyncReady).toBe(true);
    expect(report.gates.identityAndKyc.passed).toBe(true);
    expect(report.gates.regulatoryId.passed).toBe(true);
    expect(report.gates.certifications.passed).toBe(true);
    expect(report.gates.experienceAndEducation.passed).toBe(true);
    expect(report.failedCriteria.length).toBe(0);
  });

  it("should reject a candidate WITHOUT EUIN for Relationship Manager and recommend Lead Associate", () => {
    const candidate: CandidateProfile = {
      name: "Amit Patel",
      email: "amit.patel@example.com",
      mobile: "9876543211",
      panNumber: "PQRST5678K",
      panVerified: true,
      kycStatus: "VERIFIED",
      // No EUIN
      highestEducation: "bachelors",
      yearsOfExperience: 1,
      certifications: [],
    };

    const report = teamDesignationService.evaluateCandidateEligibility(candidate, "relationship_manager");
    expect(report.isEligible).toBe(false);
    expect(report.canExecuteTransactions).toBe(false);
    expect(report.irisSyncReady).toBe(false);
    expect(report.gates.regulatoryId.passed).toBe(false);
    expect(report.gates.certifications.passed).toBe(false);
    expect(report.failedCriteria).toContain("EUIN is mandatory for this designation per SEBI/AMFI");
    expect(report.remediationSteps.length).toBeGreaterThan(0);

    // Alternative recommendations should include lead_associate
    const leadOption = report.alternativeEligibleDesignations.find((a) => a.designationId === "lead_associate");
    expect(leadOption).toBeDefined();
    expect(leadOption?.canExecuteTransactions).toBe(false);
  });

  it("should evaluate candidate eligibility for SEBI Registered Investment Adviser", () => {
    const candidate: CandidateProfile = {
      name: "Dr. Sunita Rao",
      email: "sunita.rao@example.com",
      mobile: "9876543212",
      panNumber: "XYZAB9876C",
      panVerified: true,
      kycStatus: "VERIFIED",
      euinNumber: "E654321",
      sebiRegNo: "INA000012345",
      highestEducation: "professional", // Postgrad/CA/CFA
      yearsOfExperience: 5,
      certifications: [
        { code: "NISM_X_A", name: "Investment Adviser Level 1" },
        { code: "NISM_X_B", name: "Investment Adviser Level 2" },
      ],
    };

    const report = teamDesignationService.evaluateCandidateEligibility(candidate, "investment_advisor");
    expect(report.isEligible).toBe(true);
    expect(report.irisClassification).toBe("employee");
    expect(report.canExecuteTransactions).toBe(true);
    expect(report.gates.certifications.passed).toBe(true);
  });

  it("should evaluate candidate eligibility for Compliance Officer", () => {
    const candidate: CandidateProfile = {
      name: "Vikas Malhotra",
      email: "vikas.malhotra@example.com",
      mobile: "9876543213",
      panNumber: "LMNOP4321D",
      panVerified: true,
      kycStatus: "VERIFIED",
      highestEducation: "professional",
      yearsOfExperience: 4,
      certifications: [
        { code: "NISM_III_A", name: "Securities Intermediaries Compliance" },
      ],
    };

    const report = teamDesignationService.evaluateCandidateEligibility(candidate, "compliance_officer");
    expect(report.isEligible).toBe(true);
    expect(report.irisClassification).toBe("employee");
    expect(report.canExecuteTransactions).toBe(false); // Compliance does not transact
  });
});

