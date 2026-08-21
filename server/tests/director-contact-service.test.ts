/**
 * Unit tests for director-contact-logic.ts
 *
 * Tests the pure pipeline functions in isolation — zero infrastructure mocking
 * needed since director-contact-logic.ts has no DB, Redis, or HTTP dependencies.
 *
 * Covers all 7 scenarios from the product specification.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeIndianMobile,
  isValidIndianMobile,
  scoreDirector,
  runDirectorContactPipeline,
  type DirectorInput,
} from "../services/director-contact-logic";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeDirector(
  overrides: Partial<DirectorInput> & { din: string; name: string; designation: string },
): DirectorInput {
  return {
    is_active: true,
    ...overrides,
  };
}

// ── normalizeIndianMobile ─────────────────────────────────────────────────────

describe("normalizeIndianMobile", () => {
  it("normalizes a 10-digit number", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("+919876543210");
  });

  it("normalizes with leading 0", () => {
    expect(normalizeIndianMobile("09876543210")).toBe("+919876543210");
  });

  it("normalizes with 91 prefix", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("+919876543210");
  });

  it("normalizes with +91 prefix (already E.164)", () => {
    expect(normalizeIndianMobile("+919876543210")).toBe("+919876543210");
  });

  it("strips spaces and hyphens before normalizing", () => {
    expect(normalizeIndianMobile("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianMobile("987-654-3210")).toBe("+919876543210");
  });

  it("returns null for too-short numbers", () => {
    expect(normalizeIndianMobile("12345")).toBeNull();
  });

  it("returns null for numbers starting with invalid digit (5 or below)", () => {
    expect(normalizeIndianMobile("5876543210")).toBeNull();
    expect(normalizeIndianMobile("1234567890")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeIndianMobile("")).toBeNull();
  });
});

// ── scoreDirector ─────────────────────────────────────────────────────────────

describe("scoreDirector", () => {
  it("scores a promoter flag at 100 regardless of designation", () => {
    expect(scoreDirector("Director", true).score).toBe(100);
    expect(scoreDirector("Director", true).category).toBe("promoter");
  });

  it("scores Managing Director at 95", () => {
    expect(scoreDirector("Managing Director").score).toBe(95);
  });

  it("scores CEO at 95", () => {
    expect(scoreDirector("Chief Executive Officer").score).toBe(95);
  });

  it("scores CFO at 85", () => {
    expect(scoreDirector("Chief Financial Officer").score).toBe(85);
  });

  it("scores Independent Director at 40", () => {
    expect(scoreDirector("Independent Director").score).toBe(40);
  });

  it("scores plain Director at 60 (fallback)", () => {
    const result = scoreDirector("Director");
    expect(result.score).toBe(60);
    expect(result.category).toBe("director");
  });

  it("is case-insensitive", () => {
    expect(scoreDirector("MANAGING DIRECTOR").score).toBe(95);
  });
});

// ── runDirectorContactPipeline ────────────────────────────────────────────────

describe("runDirectorContactPipeline", () => {

  // T1 — Three valid contacts
  it("T1: assigns Primary/Secondary/Tertiary when all 3 top directors have mobiles", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Rajesh Kumar",  designation: "Managing Director", mobile: "9876543210" }),
      makeDirector({ din: "D2", name: "Anita Sharma",  designation: "CFO",               mobile: "8765432109" }),
      makeDirector({ din: "D3", name: "Arun Verma",    designation: "Director",          mobile: "7654321098" }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(3);
    expect(result.contacts[0].tier).toBe("primary");
    expect(result.contacts[0].name).toBe("Rajesh Kumar");
    expect(result.contacts[1].tier).toBe("secondary");
    expect(result.contacts[1].name).toBe("Anita Sharma");
    expect(result.contacts[2].tier).toBe("tertiary");
    expect(result.contacts[2].name).toBe("Arun Verma");
    expect(result.enrichmentStatus).toBeUndefined(); // enrichmentStatus is a service concern
    expect(result.contactableDirectors).toBe(3);
  });

  // T2 — Third-ranked director has no mobile, fourth qualifies
  it("T2: skips director with no mobile; picks next contactable for Tertiary", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Rajesh Kumar", designation: "Managing Director", mobile: "9876543210" }),
      makeDirector({ din: "D2", name: "Anita Sharma",  designation: "CFO",              mobile: "8765432109" }),
      makeDirector({ din: "D3", name: "Priya Mehta",   designation: "CEO",              mobile: undefined }),  // no mobile — score 95 but no contact
      makeDirector({ din: "D4", name: "Arun Verma",    designation: "Director",         mobile: "7654321098" }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(3);
    // Priya has score 95 but no mobile — must be SKIPPED
    expect(result.contacts.find(c => c.name === "Priya Mehta")).toBeUndefined();
    expect(result.contacts[2].name).toBe("Arun Verma");
    expect(result.contacts[2].tier).toBe("tertiary");

    // Priya must be in allDirectors with not_found
    const priya = result.allDirectors.find(d => d.name === "Priya Mehta");
    expect(priya?.mobileStatus).toBe("not_found");
    // Priya is still ranked 1 or 2 by score (CEO=95, MD=95, tiebreak by appointment)
    expect(priya!.priorityRank).toBeLessThanOrEqual(2);
  });

  // T3 — Highest-ranked director has no mobile
  it("T3: skips top-ranked director with no mobile; next contactable becomes Primary", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Vikram Shah",  designation: "Director", is_promoter: true, mobile: undefined }),
      makeDirector({ din: "D2", name: "Rajesh Kumar", designation: "Managing Director",            mobile: "9876543210" }),
      makeDirector({ din: "D3", name: "Anita Sharma", designation: "CFO",                          mobile: "8765432109" }),
      makeDirector({ din: "D4", name: "Arun Verma",   designation: "Director",                     mobile: "7654321098" }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(3);
    // Vikram (promoter, score 100) must NOT be Primary — no mobile
    expect(result.contacts[0].name).toBe("Rajesh Kumar");
    expect(result.contacts[0].tier).toBe("primary");

    // Vikram is still rank 1 in the full universe
    const vikram = result.allDirectors.find(d => d.name === "Vikram Shah");
    expect(vikram?.priorityRank).toBe(1);
    expect(vikram?.mobileStatus).toBe("not_found");
  });

  // T4 — Duplicate mobile (normalized deduplication)
  it("T4: deduplicates normalized mobiles; higher-ranked director keeps the slot", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Rajesh Kumar", designation: "Managing Director", mobile: "+919876543210" }),
      makeDirector({ din: "D2", name: "Anita Sharma",  designation: "CFO",              mobile: "9876543210" }),   // same as D1 normalized
      makeDirector({ din: "D3", name: "Arun Verma",    designation: "Director",         mobile: "8765432109" }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(2); // Only 2 unique phones
    expect(result.contacts[0].name).toBe("Rajesh Kumar");
    expect(result.contacts[0].mobile).toBe("+919876543210");
    expect(result.contacts[1].name).toBe("Arun Verma");
    expect(result.contacts[1].tier).toBe("secondary");

    // Anita must be marked duplicate, not in contacts
    const anita = result.allDirectors.find(d => d.name === "Anita Sharma");
    expect(anita?.mobileStatus).toBe("duplicate");
    expect(result.contacts.find(c => c.name === "Anita Sharma")).toBeUndefined();
  });

  // T5 — Only two contactable directors
  it("T5: assigns Primary+Secondary only when only 2 directors have mobiles", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Rajesh Kumar", designation: "Managing Director", mobile: "9876543210" }),
      makeDirector({ din: "D2", name: "Anita Sharma",  designation: "CFO",              mobile: "8765432109" }),
      makeDirector({ din: "D3", name: "Priya Mehta",   designation: "Director",         mobile: undefined }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(2);
    expect(result.contacts[0].tier).toBe("primary");
    expect(result.contacts[1].tier).toBe("secondary");
    expect(result.contacts.find(c => c.tier === "tertiary")).toBeUndefined();
    expect(result.totalDirectors).toBe(3);
    expect(result.contactableDirectors).toBe(2);
  });

  // T6 — No contactable directors
  it("T6: returns empty contacts when no director has a mobile; full universe still stored", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "Rajesh Kumar", designation: "Managing Director", mobile: undefined }),
      makeDirector({ din: "D2", name: "Anita Sharma",  designation: "CFO",              mobile: undefined }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    expect(result.contacts).toHaveLength(0);
    expect(result.contactableDirectors).toBe(0);
    expect(result.totalDirectors).toBe(2);
    // All directors in universe with not_found
    expect(result.allDirectors.every(d => d.mobileStatus === "not_found")).toBe(true);
  });

  // T7 — CredHive returns empty array (edge case: no directors on record)
  it("T7: handles empty directors array gracefully", () => {
    const result = runDirectorContactPipeline([], NOW);
    expect(result.contacts).toHaveLength(0);
    expect(result.totalDirectors).toBe(0);
    expect(result.allDirectors).toHaveLength(0);
  });

  // Mobile normalization in output
  it("normalizes all stored mobiles to E.164 format", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "A", designation: "MD",  mobile: "09876543210" }),
      makeDirector({ din: "D2", name: "B", designation: "CFO", mobile: "919876543219" }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);

    for (const contact of result.contacts) {
      expect(contact.mobile).toMatch(/^\+91\d{10}$/);
    }
  });

  // Priority rank preservation
  it("stores priorityRank for every director regardless of mobile status", () => {
    const directors: DirectorInput[] = [
      makeDirector({ din: "D1", name: "A", designation: "MD",       mobile: "9876543210" }),
      makeDirector({ din: "D2", name: "B", designation: "Director", mobile: undefined }),
    ];

    const result = runDirectorContactPipeline(directors, NOW);
    const ranks = result.allDirectors.map(d => d.priorityRank).sort();
    expect(ranks).toEqual([1, 2]);
  });
});
