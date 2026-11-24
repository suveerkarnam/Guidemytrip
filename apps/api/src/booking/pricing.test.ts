import { describe, expect, it } from "vitest";
import { calculatePrice } from "./pricing";
import { rankGuides } from "./ranking";
import { validateDateRange, validateLanguages, validateTourists } from "./validation";
import { discoverySchema } from "./routes";

describe("booking rules", () => {
  it("calculates backend price and GST", () => { expect(calculatePrice("1000", "5", 2)).toEqual({ baseAmount: "2000.00", gstAmount: "100.00", totalAmount: "2100.00", currency: "INR" }); });
  it("rejects invalid dates, tourists, and language selections", () => { expect(() => validateDateRange("2020-01-01", "2020-01-02")).toThrow("DATE_IN_PAST"); expect(() => validateTourists(5, 4, 6)).toThrow("PACKAGE_CAPACITY_EXCEEDED"); expect(() => validateLanguages(["en", "en"])).toThrow("INVALID_LANGUAGE_PREFERENCES"); });
  it("keeps language preference match ahead of rating in ranking", () => { const ranked = rankGuides([{ id: "rating", languageMatches: 1, preferenceCount: 3, rating: 5, experienceYears: 10, hasAvailability: true }, { id: "language", languageMatches: 3, preferenceCount: 3, rating: 4, experienceYears: 2, hasAvailability: true }]); expect(ranked[0]!.id).toBe("language"); });
  it("accepts ordered languages from both query strings and JSON booking bodies", () => {
    const base = { destinationSlug: "hampi", packageId: "5767d15b-ba50-48ac-95aa-07565b4db306", from: "2026-11-28", to: "2026-11-29", tourists12Plus: 2 };
    const languageIds = ["a6a893e2-4c14-4cc5-bfd4-ae299263e362", "9df8ee7b-5729-4000-8c22-069cad1da069", "00b7f506-8c84-47e7-a200-ea7844a5d8ad"];
    expect(discoverySchema.parse({ ...base, languageIds }).languageIds).toEqual(languageIds);
    expect(discoverySchema.parse({ ...base, languageIds: languageIds.join(",") }).languageIds).toEqual(languageIds);
  });
});
