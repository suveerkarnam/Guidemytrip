import { describe, expect, it } from "vitest";
import { calculatePrice } from "./pricing";
import { rankGuides } from "./ranking";
import { validateDateRange, validateLanguages, validateTourists } from "./validation";

describe("booking rules", () => {
  it("calculates backend price and GST", () => { expect(calculatePrice("1000", "5", 2)).toEqual({ baseAmount: "2000.00", gstAmount: "100.00", totalAmount: "2100.00", currency: "INR" }); });
  it("rejects invalid dates, tourists, and language selections", () => { expect(() => validateDateRange("2020-01-01", "2020-01-02")).toThrow("DATE_IN_PAST"); expect(() => validateTourists(5, 4, 6)).toThrow("PACKAGE_CAPACITY_EXCEEDED"); expect(() => validateLanguages(["en", "en"])).toThrow("INVALID_LANGUAGE_PREFERENCES"); });
  it("keeps language preference match ahead of rating in ranking", () => { const ranked = rankGuides([{ id: "rating", languageMatches: 1, preferenceCount: 3, rating: 5, experienceYears: 10, hasAvailability: true }, { id: "language", languageMatches: 3, preferenceCount: 3, rating: 4, experienceYears: 2, hasAvailability: true }]); expect(ranked[0]!.id).toBe("language"); });
});
