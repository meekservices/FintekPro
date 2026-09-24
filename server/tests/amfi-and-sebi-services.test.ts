import { describe, it, expect } from "vitest";
import { amfiValidationService } from "../services/amfi-validation-service";
import { sebiIntermediaryService } from "../services/sebi-intermediary-service";

describe("AMFI Validation Service", () => {
  it("rejects invalid ARN format", async () => {
    await expect(
      amfiValidationService.validateArn({ arnCode: "INVALID_ARN" })
    ).rejects.toThrow("Invalid ARN format");
  });

  it("validates and normalizes authentic ARN", async () => {
    const result = await amfiValidationService.validateArn({
      arnCode: "ARN123456",
      candidateName: "FintekPro Partner",
    });

    expect(result.verified).toBe(true);
    expect(result.arnCode).toBe("ARN-123456");
    expect(result.status).toBe("ACTIVE");
    expect(result.cadre).toBe("Individual");
    expect(result.distributorName).toBe("FintekPro Partner");

    // Expiry must be 3 years out
    const fromYear = new Date(result.validFrom).getFullYear();
    const tillYear = new Date(result.validTill).getFullYear();
    expect(tillYear - fromYear).toBe(3);
  });

  it("validates EUIN format", async () => {
    const euin = await amfiValidationService.validateEuin({
      euinNumber: "E123456",
      arnCode: "ARN-123456",
    });

    expect(euin.verified).toBe(true);
    expect(euin.euinNumber).toBe("E123456");
    expect(euin.status).toBe("ACTIVE");
  });
});

describe("SEBI Intermediary Registry Service", () => {
  it("rejects malformed SEBI registration numbers", async () => {
    await expect(
      sebiIntermediaryService.verifyIntermediary({ registrationNumber: "INVALID" })
    ).rejects.toThrow("Invalid SEBI Registration Number format");
  });

  it("correctly identifies and validates RIA (Investment Adviser)", async () => {
    const result = await sebiIntermediaryService.verifyIntermediary({
      registrationNumber: "INA000012345",
      candidateName: "Alpha RIA Advisory",
    });

    expect(result.verified).toBe(true);
    expect(result.category).toBe("RIA");
    expect(result.categoryName).toContain("Investment Adviser");
    expect(result.status).toBe("ACTIVE");
    expect(result.validTill).toBe("PERPETUAL");
  });

  it("correctly identifies and validates RA (Research Analyst)", async () => {
    const result = await sebiIntermediaryService.verifyIntermediary({
      registrationNumber: "INH000098765",
    });

    expect(result.verified).toBe(true);
    expect(result.category).toBe("RA");
    expect(result.categoryName).toContain("Research Analyst");
  });
});
