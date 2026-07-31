"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  BarChart2,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useReportsAPI, useSalesAPI, useProductAPI, useSettingsAPI } from "@/lib/hooks";
import {
  calcSalesMetrics,
  getBestSellingProducts,
  getLowStockProducts,
  getOutOfStockProducts,
} from "@/lib/reports";
import type { Sale } from "@/types";

type Period = "today" | "week" | "month" | "year";

const periods: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const reportsAPI = useReportsAPI();
  const salesAPI = useSalesAPI();
  const productAPI = useProductAPI();
  const settingsAPI = useSettingsAPI();

  const [summary, setSummary] = useState<{ revenue: number; cost: number; profit: number; transactions: number } | null>(null);
  const [series, setSeries] = useState<Record<string, number>>({});
  const [days, setDays] = useState<string[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const load = useCallback(async (p: Period) => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setReportError(null);
    try {
      const [r, prodList, settings] = await Promise.all([
        reportsAPI.getReport({ range: p }),
        productAPI.getProducts(),
        settingsAPI.getSettings(),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      setSummary(r.summary);
      setSeries(r.series || {});
      setDays(r.days || []);
      setThreshold(settings.lowStockThreshold);
      setProducts(prodList);

      // fetch sales in range for best selling computation
      const start = r.days?.[0] ? new Date(r.days[0]) : undefined;
      const end = r.days?.length ? new Date(r.days[r.days.length - 1]) : undefined;
      if (start && end) {
        const s = await salesAPI.getSalesInRange(start, end);
        if (requestId !== loadRequestIdRef.current) return;
        setSales(s);
      } else {
        setSales([]);
      }
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error("Reports load error:", err);
      setReportError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
    }
  }, [reportsAPI, productAPI, settingsAPI, salesAPI]);

  useEffect(() => {
    if (!authLoading && user) {
      setReportError(null);
      void load(period);
    }
  }, [authLoading, load, period, user]);

  const [products, setProducts] = useState<Awaited<ReturnType<typeof productAPI.getProducts>>>([] as any);

  const metrics = summary ?? { revenue: 0, cost: 0, profit: 0, transactions: 0 };

  const allMetrics = useMemo(() => calcSalesMetrics(sales), [sales]);
  const monthMetrics = allMetrics; // placeholder
  const todayMetrics = allMetrics; // placeholder

  const bestSelling = useMemo(() => getBestSellingProducts(sales).slice(0, 10), [sales]);

  // build daily chart from series/days
  const dailyChart = useMemo(() => {
    return (days || []).map((d) => ({ date: d, revenue: series[d] || 0 }));
  }, [days, series]);
  const maxBar = Math.max(...dailyChart.map((d) => d.revenue), 1);

  const lowStock = getLowStockProducts(products, threshold);
  const outOfStock = getOutOfStockProducts(products);

  return (
    <DashboardShell title="Reports">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                period === p.key
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {authLoading ? (
          <p className="text-slate-500">Waiting for authentication...</p>
        ) : loading ? (
          <p className="text-slate-500">Loading reports...</p>
        ) : reportError ? (
          <p className="text-red-500">{reportError}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Revenue"
                value={formatCurrency(metrics.revenue)}
                sub={`${metrics.transactions} sales`}
              />
              <StatCard
                icon={ShoppingBag}
                label="Cost"
                value={formatCurrency(metrics.cost)}
                color="text-slate-600"
              />
              <StatCard
                icon={TrendingUp}
                label="Profit"
                value={formatCurrency(metrics.profit)}
                color="text-emerald-600"
              />
              <StatCard
                icon={BarChart2}
                label="Transactions"
                value={String(metrics.transactions)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="card p-4">
                <p className="text-sm text-slate-500">Daily Profit (Today)</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(todayMetrics.profit)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-slate-500">Monthly Profit</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(monthMetrics.profit)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-slate-500">Total Profit (All Time)</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(allMetrics.profit)}
                </p>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="mb-4 font-semibold">Last 7 Days Revenue</h2>
              <div className="flex items-end gap-2 h-40">
                {dailyChart.map((d) => (
                  <div
                    key={d.date}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t bg-emerald-500 transition-all min-h-[4px]"
                      style={{
                        height: `${(d.revenue / maxBar) * 100}%`,
                      }}
                      title={formatCurrency(d.revenue)}
                    />
                    <span className="text-[10px] text-slate-500 text-center leading-tight">
                      {d.date.split(",")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card">
                <div className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
                  Best Selling Products ({periods.find((p) => p.key === period)?.label})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bestSelling.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No sales data</p>
                  ) : (
                    bestSelling.map((item, i) => (
                      <div
                        key={item.productId}
                        className="flex justify-between px-4 py-2 text-sm"
                      >
                        <span>
                          {i + 1}. {item.productName}
                        </span>
                        <span className="text-slate-500">
                          {item.quantitySold} sold ·{" "}
                          {formatCurrency(item.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="card">
                  <div className="border-b border-amber-200 px-4 py-3 font-semibold text-amber-600 dark:border-amber-900">
                    Low Stock ({lowStock.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {lowStock.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500">None</p>
                    ) : (
                      lowStock.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between px-4 py-2 text-sm"
                        >
                          <span>{p.name}</span>
                          <span>{p.stockQuantity}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="border-b border-red-200 px-4 py-3 font-semibold text-red-600 dark:border-red-900">
                    Out of Stock ({outOfStock.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {outOfStock.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500">None</p>
                    ) : (
                      outOfStock.map((p) => (
                        <div key={p.id} className="px-4 py-2 text-sm">
                          {p.name}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-slate-900 dark:text-white",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn("text-xl font-bold", color)}>{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}
