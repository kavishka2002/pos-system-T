import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  isWithinInterval,
} from "date-fns";
import type { Sale, Product } from "@/types";

export function filterSalesByPeriod(
  sales: Sale[],
  period: "today" | "week" | "month" | "year"
): Sale[] {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case "today":
      start = startOfDay(now);
      end = endOfDay(now);
      break;
    case "week":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "month":
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case "year":
      start = startOfYear(now);
      end = endOfYear(now);
      break;
  }

  return sales.filter((s) => {
    const d =
      s.createdAt instanceof Date
        ? s.createdAt
        : s.createdAt.toDate?.() ?? new Date();
    return isWithinInterval(d, { start, end });
  });
}

function getSaleMultiplier(sale: Sale) {
  return sale.type === "return" ? -1 : 1;
}

export function calcSalesMetrics(sales: Sale[]) {
  const revenue = sales.reduce((s, sale) => s + sale.grandTotal * getSaleMultiplier(sale), 0);
  const cost = sales.reduce((s, sale) => s + sale.totalCost * getSaleMultiplier(sale), 0);
  const profit = sales.reduce((s, sale) => s + sale.totalProfit * getSaleMultiplier(sale), 0);
  return { revenue, cost, profit, count: sales.length };
}

export interface ProductSalesStat {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export function getBestSellingProducts(sales: Sale[]): ProductSalesStat[] {
  const map = new Map<string, ProductSalesStat>();

  for (const sale of sales) {
    const multiplier = getSaleMultiplier(sale);
    for (const item of sale.items) {
      const quantityDelta = item.quantity * multiplier;
      const revenueDelta = item.lineTotal * multiplier;
      const existing = map.get(item.productId);
      if (existing) {
        existing.quantitySold += quantityDelta;
        existing.revenue += revenueDelta;
      } else {
        map.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          quantitySold: quantityDelta,
          revenue: revenueDelta,
        });
      }
    }
  }

  return Array.from(map.values())
    .filter((stat) => stat.quantitySold > 0)
    .sort((a, b) => b.quantitySold - a.quantitySold);
}

export function getDailyProfitLast7Days(sales: Sale[]) {
  const days: { date: string; profit: number; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const start = startOfDay(day);
    const end = endOfDay(day);
    const daySales = sales.filter((s) => {
      const d =
        s.createdAt instanceof Date
          ? s.createdAt
          : s.createdAt.toDate?.() ?? new Date();
      return isWithinInterval(d, { start, end });
    });
    const metrics = calcSalesMetrics(daySales);
    days.push({
      date: day.toLocaleDateString("en-LK", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      profit: metrics.profit,
      revenue: metrics.revenue,
    });
  }
  return days;
}

export function getLowStockProducts(
  products: Product[],
  threshold: number
): Product[] {
  return products.filter(
    (p) => p.stockQuantity > 0 && p.stockQuantity <= threshold
  );
}

export function getOutOfStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.stockQuantity < 1);
}
