"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackageX, History } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useProductAPI, useStockAPI, useSettingsAPI } from "@/lib/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import type { Product, StockMovement } from "@/types";
import toast from "react-hot-toast";

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(true);
  const [adjustId, setAdjustId] = useState("");
  const [adjustQty, setAdjustQty] = useState(0);

  const productAPI = useProductAPI();
  const stockAPI = useStockAPI();
  const settingsAPI = useSettingsAPI();

  const load = useCallback(async () => {
    try {
      const [p, m, s] = await Promise.all([
        productAPI.getProducts(),
        stockAPI.getStockMovements(50),
        settingsAPI.getSettings(),
      ]);
      setProducts(p);
      setMovements(m);
      setThreshold(s.lowStockThreshold);
    } catch (err) {
      toast.error("Failed to load inventory");
      console.error("Inventory load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStock = useMemo(
    () =>
      products.filter(
        (p) => p.stockQuantity > 0 && p.stockQuantity <= threshold
      ),
    [products, threshold]
  );

  const outOfStock = useMemo(
    () => products.filter((p) => p.stockQuantity < 1),
    [products]
  );

  const handleAdjust = async () => {
    if (!adjustId || !user) return;
    const product = products.find((p) => p.id === adjustId);
    if (!product) return;

    try {
      const prev = product.stockQuantity;
      const newStock = Math.max(0, adjustQty);

      // update product stock via products API
      await productAPI.updateProduct(adjustId, { stockQuantity: newStock });

      // record stock movement via stock API
      await stockAPI.recordStockMovement({
        productId: adjustId,
        productName: product.name,
        type: "adjustment",
        quantityChange: newStock - prev,
        previousStock: prev,
        newStock,
      });

      toast.success("Stock updated");
      setAdjustId("");
      setAdjustQty(0);
      await load();
    } catch (err) {
      console.error("Stock adjust error:", err);
      toast.error("Adjustment failed");
    }
  };

  return (
    <DashboardShell title="Inventory">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
              <PackageX className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-xs text-slate-500">Total Products</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/40">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{lowStock.length}</p>
              <p className="text-xs text-slate-500">Low Stock (≤{threshold})</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/40">
              <PackageX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {outOfStock.length}
              </p>
              <p className="text-xs text-slate-500">Out of Stock</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Adjust Stock</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={adjustId}
              onChange={(e) => {
                setAdjustId(e.target.value);
                const p = products.find((x) => x.id === e.target.value);
                if (p) setAdjustQty(p.stockQuantity);
              }}
              className="input-field min-w-[200px] flex-1"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (current: {p.stockQuantity})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
              className="input-field w-28"
              placeholder="Qty"
            />
            <button type="button" onClick={handleAdjust} className="btn-primary">
              Update Stock
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold text-amber-600 dark:border-slate-800">
              Low Stock Alerts
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {lowStock.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No low stock items</p>
              ) : (
                lowStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between px-4 py-2 text-sm"
                  >
                    <span>{p.name}</span>
                    <span className="font-medium text-amber-600">
                      {p.stockQuantity} left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="card">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold text-red-600 dark:border-slate-800">
              Out of Stock
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {outOfStock.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">All in stock</p>
              ) : (
                outOfStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between px-4 py-2 text-sm"
                  >
                    <span>{p.name}</span>
                    <span className="text-red-600 font-medium">0</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <History className="h-4 w-4" />
            <span className="font-semibold">Stock Movement History</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Change</th>
                  <th className="px-4 py-2 text-right">Before → After</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No movements yet
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const date =
                      m.createdAt instanceof Date
                        ? m.createdAt
                        : m.createdAt.toDate?.();
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2">{m.productName}</td>
                        <td className="px-4 py-2 capitalize">{m.type}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            m.quantityChange < 0
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {m.quantityChange > 0 ? "+" : ""}
                          {m.quantityChange}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {m.previousStock} → {m.newStock}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {date?.toLocaleString() ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
            All Products Stock
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Stock</th>
                  <th className="px-4 py-2 text-right">Value (cost)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-right">{p.stockQuantity}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(p.costPrice * p.stockQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
