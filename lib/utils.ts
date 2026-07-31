import { clsx, type ClassValue } from "clsx";
import type { BillDiscount, BillDiscountType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function calcProfitPerItem(
  sellingPrice: number,
  costPrice: number
): number {
  return Math.round((sellingPrice - costPrice) * 100) / 100;
}

export function calcBillDiscount(
  subtotal: number,
  discount: { type: BillDiscountType; value: number }
): number {
  if (discount.type === "none" || discount.value <= 0) return 0;
  if (discount.type === "percentage") {
    return Math.round(subtotal * (Math.min(discount.value, 100) / 100) * 100) / 100;
  }
  return Math.min(discount.value, subtotal);
}

export function generateInvoiceNumber(counter: number): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `INV-${y}${m}${d}-${String(counter).padStart(5, "0")}`;
}

export const DEFAULT_CATEGORIES = [
  "Groceries",
  "Beverages",
  "Snacks",
  "Dairy",
  "Household",
  "Personal Care",
  "Electronics",
  "Other",
];
