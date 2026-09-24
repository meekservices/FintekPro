import { describe, it, expect } from "vitest";
import { nismDigiLockerService } from "../services/nism-digilocker-service";

describe("NISM DigiLocker Pull Service", () => {
  it("rejects invalid PAN formats with zero-trust validation", async () => {
    await expect(
      nismDigiLockerService.pullCertificate({
        enrolmentNumber: "NISM-20230008472",
        pan: "INVALIDPAN",
      })
    ).rejects.toThrow("Invalid PAN format");
  });

  it("rejects empty or too-short enrolment numbers", async () => {
    await expect(
      nismDigiLockerService.pullCertificate({
        enrolmentNumber: "123",
        pan: "ABCDE1234F",
      })
    ).rejects.toThrow("Invalid NISM Enrolment Number");
  });

  it("deterministically generates and verifies test certificate with 3-year expiry", async () => {
    const cert = await nismDigiLockerService.pullCertificate({
      enrolmentNumber: "NISM-20230008472",
      pan: "ABCDE1234F",
      candidateName: "Test Advisor",
    });

    expect(cert.verified).toBe(true);
    expect(cert.pan).toBe("ABCDE1234F");
    expect(cert.enrolmentNumber).toBe("NISM-20230008472");
    expect(cert.examSeries).toBe("series_v_a");
    expect(cert.result).toBe("PASS");
    expect(cert.digilockerUri).toContain("in.gov.nism-NISMC-");

    // Verify 3-year expiry rule
    const examYear = new Date(cert.examDate).getFullYear();
    const expiryYear = new Date(cert.expiryDate).getFullYear();
    expect(expiryYear - examYear).toBe(3);
  });

  it("detects Series X-A (Investment Adviser) from enrolment pattern", () => {
    const cert = nismDigiLockerService.generateVerifiedTestCertificate(
      "NISM-XA-2023991",
      "ABCDE1234F",
      "RIA Advisor"
    );

    expect(cert.examSeries).toBe("series_x_a");
    expect(cert.examTitle).toContain("Investment Adviser (Level 1)");
    expect(cert.verified).toBe(true);
  });
});
