import { AuthError } from "../auth/service.js";

export function parseBookingDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AuthError(`INVALID_${field.toUpperCase()}`, 422);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AuthError(`INVALID_${field.toUpperCase()}`, 422);
  return date;
}

export function validateDateRange(from: string, to: string) {
  const startDate = parseBookingDate(from, "from_date");
  const endDate = parseBookingDate(to, "to_date");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (startDate < today) throw new AuthError("DATE_IN_PAST", 422);
  if (endDate < startDate) throw new AuthError("INVALID_DATE_RANGE", 422);
  return { startDate, endDate };
}

export function validateTourists(tourists: number, packageCapacity: number, guideCapacity: number) {
  if (!Number.isInteger(tourists) || tourists < 1) throw new AuthError("INVALID_TOURIST_COUNT", 422);
  if (tourists > packageCapacity) throw new AuthError("PACKAGE_CAPACITY_EXCEEDED", 422);
  if (tourists > guideCapacity) throw new AuthError("GUIDE_CAPACITY_EXCEEDED", 422);
}

export function validateLanguages(languageIds: string[]) {
  if (languageIds.length < 1 || languageIds.length > 3 || new Set(languageIds).size !== languageIds.length) throw new AuthError("INVALID_LANGUAGE_PREFERENCES", 422);
}

export function overlapPredicate(startDate: Date, endDate: Date) { return { startDate: { lt: endDate }, endDate: { gt: startDate } }; }
