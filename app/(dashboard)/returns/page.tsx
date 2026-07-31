"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RotateCcw, ArrowRight, FileMinus, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useSalesAPI } from "@/lib/hooks";
import { formatCurrency, cn } from "@/lib/utils";
import type { Sale } from "@/types";
import toast from "react-hot-toast";

export default function ReturnsPage() {
  const salesAPI = useSalesAPI();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [newInvoice, setNewInvoice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState<string>("");

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesAPI.getSales();
      setSales(data);
      setNewInvoice(null);
    } catch (error) {
      console.error("Failed to load bills:", error);
      toast.error("Unable to load sales records");
    } finally {
      setLoading(false);
    }
  }, [salesAPI]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    const query = search.toLowerCase().trim();
    return sales.filter((sale) =>
      sale.invoiceNumber.toLowerCase().includes(query) ||
      (sale.originalInvoiceNumber?.toLowerCase() ?? "").includes(query)
    );
  }, [sales, search]);

  const returnedQuantities = useMemo(() => {
    if (!selectedSale) return new Map<string, number>();

    const map = new Map<string, number>();
    for (const sale of sales) {
      if (sale.type !== "return" || sale.originalSaleId !== selectedSale.id) continue;
      for (const item of sale.items) {
        map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
      }
    }

    return map;
  }, [sales, selectedSale]);

  const returnItems = useMemo(() => {
    if (!selectedSale) return [];
    return selectedSale.items.map((item) => {
      const returned = returnedQuantities.get(item.productId) || 0;
      const available = Math.max(0, item.quantity - returned);
      const quantity = Math.min(returnQuantities[item.productId] || 0, available);
      const selectedLineTotal = item.unitPrice * quantity;
      const selectedLineProfit = quantity > 0 ? (item.lineProfit / item.quantity) * quantity : 0;
      return {
        ...item,
        available,
        returned,
        quantity,
        selectedLineTotal,
        selectedLineProfit,
      };
    });
  }, [selectedSale, returnQuantities, returnedQuantities]);

  const totalReturnAmount = returnItems.reduce(
    (sum, item) => sum + item.selectedLineTotal,
    0
  );
  const selectedCount = returnItems.filter((item) => item.quantity > 0).length;

  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    setReturnQuantities(
      Object.fromEntries(sale.items.map((item) => [item.productId, 0]))
    );
    setNewInvoice(null);
  };

  const handleQtyChange = (productId: string, value: number) => {
    setReturnQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, value),
    }));
  };

  const handleReturn = () => {
    if (!selectedSale) return;
    const items = returnItems.filter((item) => item.quantity > 0);
    if (!items.length) {
      toast.error("Select at least one item to return");
      return;
    }
    // prefill customer name input from original sale if present
    setCustomerNameInput(selectedSale.customerName || "");
    setConfirmOpen(true);
  };

  const confirmReturn = async () => {
    if (!selectedSale) return;
    const items = returnItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        priceType: item.priceType,
        lineTotal: item.unitPrice * item.quantity,
        lineProfit: item.selectedLineProfit || 0,
      }));

    const originalTotal = selectedSale.grandTotal || 0;
    const originalPaid = selectedSale.amountReceived || 0;
    const returnedValue = totalReturnAmount;
    const owedAfterReturn = originalTotal - returnedValue;
    const refund = Math.round((originalPaid - owedAfterReturn) * 100) / 100;
    const refundAmount = refund > 0 ? refund : 0;
    const customerOwes = refund < 0 ? Math.abs(refund) : 0;

    setSaving(true);
    try {
      const result = await salesAPI.createReturn({
        originalSaleId: selectedSale.id,
        originalInvoiceNumber: selectedSale.invoiceNumber,
        customerName: customerNameInput || undefined,
        refundAmount,
        customerOwes,
        items,
      });

      toast.success(`Return bill created: ${result.invoiceNumber}`);
      setNewInvoice(result.invoiceNumber);
      setConfirmOpen(false);
      await loadSales();
      setSelectedSale(null);
      setReturnQuantities({});
    } catch (error) {
      console.error("Return bill error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Return Bills">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-50 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill number..."
              className="input-field pl-9"
            />
          </div>
          <button
            type="button"
            onClick={loadSales}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh bills
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-4 font-semibold dark:border-slate-800">
              Recent bills
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Loading bills...
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No bills found
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => {
                      const date =
                        sale.createdAt instanceof Date
                          ? sale.createdAt
                          : sale.createdAt.toDate?.() ?? new Date();
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-[11px] font-semibold uppercase",
                                sale.type === "return"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              )}
                            >
                              {sale.type === "return" ? "Return" : "Sale"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(sale.grandTotal)}
                          </td>
                          <td className="px-4 py-3">
                            {date.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleSelectSale(sale)}
                              className="btn-secondary px-3 py-1.5 text-xs"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-lg font-semibold">Selected bill</h2>
              </div>

              {!selectedSale ? (
                <p className="text-sm text-slate-500">Select a bill to return items.</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-sm text-slate-500">Invoice</p>
                    <p className="text-base font-semibold">{selectedSale.invoiceNumber}</p>
                    {selectedSale.originalInvoiceNumber && (
                      <p className="text-xs text-slate-500">
                        Original Invoice: {selectedSale.originalInvoiceNumber}
                      </p>
                    )}
                  </div>
                  {selectedSale.type === "return" ? (
                    <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
                      This is a return invoice and cannot be returned again.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                            <tr>
                              <th className="px-3 py-2">Product</th>
                              <th className="px-3 py-2">Returned</th>
                              <th className="px-3 py-2">Qty</th>
                              <th className="px-3 py-2">Refund</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {returnItems.map((item) => (
                              <tr key={item.productId}>
                                <td className="px-3 py-2">{item.productName}</td>
                                <td className="px-3 py-2 text-slate-500">
                                  {item.returned}/{item.quantity}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.available}
                                    value={item.quantity || 0}
                                    onChange={(e) =>
                                      handleQtyChange(
                                        item.productId,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="input-field w-20"
                                  />
                                  <p className="text-xs text-slate-400">
                                    available: {item.available}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatCurrency(item.selectedLineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between text-sm">
                          <span>Credit amount</span>
                          <span className="font-semibold">
                            {formatCurrency(totalReturnAmount)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={saving || selectedCount === 0}
                          onClick={handleReturn}
                          className="btn-primary mt-4 w-full"
                        >
                          {saving ? "Processing return..." : "Create Return Bill"}
                        </button>
                        {newInvoice && (
                          <p className="mt-3 text-sm text-emerald-600">
                            New return invoice created: {newInvoice}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Return">
        <div className="space-y-3">
          <div>
            <label className="block text-sm">Customer name</label>
            <input
              value={customerNameInput}
              onChange={(e) => setCustomerNameInput(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <p className="text-sm">Original total: {formatCurrency(selectedSale?.grandTotal || 0)}</p>
            <p className="text-sm">Already paid: {formatCurrency(selectedSale?.amountReceived || 0)}</p>
            <p className="text-sm">Returned value: {formatCurrency(totalReturnAmount)}</p>
            <p className="text-sm font-semibold">
              {(() => {
                const originalTotal = selectedSale?.grandTotal || 0;
                const originalPaid = selectedSale?.amountReceived || 0;
                const owedAfterReturn = originalTotal - totalReturnAmount;
                const refund = Math.round((originalPaid - owedAfterReturn) * 100) / 100;
                if (refund > 0) return `Amount to be refunded to customer: ${formatCurrency(refund)}`;
                if (refund < 0) return `Customer needs to pay additional balance: ${formatCurrency(Math.abs(refund))}`;
                return `No refund or additional balance required`;
              })()}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmReturn} className="btn-primary flex-1">
              Confirm return
            </button>
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
