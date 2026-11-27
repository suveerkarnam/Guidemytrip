import { Prisma } from "@prisma/client";

export type PriceBreakdown = { baseAmount: string; gstAmount: string; totalAmount: string; currency: "INR" };

export function calculatePrice(basePrice: string | number | Prisma.Decimal, gstRate: string | number | Prisma.Decimal, tourists: number): PriceBreakdown {
  const baseAmount = new Prisma.Decimal(basePrice).mul(tourists);
  const gstAmount = baseAmount.mul(new Prisma.Decimal(gstRate)).div(100);
  return { baseAmount: baseAmount.toFixed(2), gstAmount: gstAmount.toFixed(2), totalAmount: baseAmount.plus(gstAmount).toFixed(2), currency: "INR" };
}
