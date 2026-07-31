"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Minus,
  Plus,
  Trash2,
  CreditCard,
  ScanBarcode,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReceiptModal } from "@/components/pos/ReceiptModal";
import { useProductAPI, useSettingsAPI, useSalesAPI } from "@/lib/hooks";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product, Sale, ShopSettings, PriceType } from "@/types";
import toast from "react-hot-toast";

export default function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const amountReceived = useCartStore((s) => s.amountReceived);
  const addProduct = useCartStore((s) => s.addProduct);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const setAmountReceived = useCartStore((s) => s.setAmountReceived);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount);
  const getGrandTotal = useCartStore((s) => s.getGrandTotal);
  const getBalance = useCartStore((s) => s.getBalance);
  const getTotalCost = useCartStore((s) => s.getTotalCost);
  const getTotalProfit = useCartStore((s) => s.getTotalProfit);

  const productAPI = useProductAPI();
  const settingsAPI = useSettingsAPI();
  const salesAPI = useSalesAPI();

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        productAPI.getProducts(),
        settingsAPI.getSettings(),
      ]);
      setProducts(p);
      setSettings(s);
    } catch (err) {
      console.error("Load products error:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [productAPI, settingsAPI]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(cats).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchCat = category === "All" || p.category === category;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, search, category]);

  const handleBarcodeScan = useCallback(
    (code: string) => {
      const normalized = code.trim();
      if (!normalized) return;
      setDetectedBarcode(normalized);
      setBarcodeInput(normalized);
      const product = products.find((p) => p.barcode === normalized);
      if (!product) {
        setCameraError("Product not found");
        return;
      }
      if (product.stockQuantity < 1) {
        setCameraError("Product is out of stock");
        return;
      }
      addProduct(product);
      toast.success(`Added ${product.name}`);
      setBarcodeInput("");
      setScanModalOpen(false);
      setScanning(false);
      if (scanRafRef.current) {
        cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    },
    [addProduct, products]
  );

  const handleBarcode = () => {
    const code = barcodeInput.trim();
    if (!code) return;
    const product = products.find((p) => p.barcode === code);
    if (product) {
      if (product.stockQuantity < 1) {
        toast.error("Out of stock");
        return;
      }
      addProduct(product);
      toast.success(`Added ${product.name}`);
      setBarcodeInput("");
    } else {
      toast.error("Product not found");
    }
  };

  const closeScanner = useCallback(() => {
    setScanModalOpen(false);
    setScanning(false);
    setCameraError(null);
    setDetectedBarcode(null);
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const openScanner = useCallback(async () => {
    setCameraError(null);
    setDetectedBarcode(null);
    setScanModalOpen(true);

    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setCameraError(
        "Camera barcode scanning is not supported by this browser. Please enter the barcode manually."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      barcodeDetectorRef.current = new BarcodeDetectorCtor({
        formats: [
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "code_93",
          "upc_a",
          "upc_e",
          "qr_code",
        ],
      });
      setScanning(true);
    } catch (err) {
      console.error(err);
      setCameraError(
        "Unable to access the camera. Please allow camera permission or use manual barcode entry."
      );
    }
  }, []);

  useEffect(() => {
    if (!scanning || !barcodeDetectorRef.current || !videoRef.current) return;

    let active = true;

    const scanFrame = async () => {
      if (!active || !videoRef.current) return;
      try {
        const results = await barcodeDetectorRef.current.detect(videoRef.current);
        if (results.length > 0) {
          const code = results[0].rawValue;
          if (code) {
            handleBarcodeScan(code);
            return;
          }
        }
      } catch (err) {
        console.error("Barcode scan failed:", err);
      }
      scanRafRef.current = requestAnimationFrame(scanFrame);
    };

    scanFrame();

    return () => {
      active = false;
      if (scanRafRef.current) {
        cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
    };
  }, [scanning, handleBarcodeScan]);

  const togglePriceType = (productId: string, current: PriceType) => {
    const product = products.find((p) => p.id === productId);
    const item = items.find((i) => i.productId === productId);
    if (!product || !item) return;
    const newType: PriceType = current === "normal" ? "special" : "normal";
    if (newType === "special" && (!product.specialPrice || product.specialPrice <= 0)) {
      toast.error("No special price set");
      return;
    }
    removeItem(productId, item.priceType);
    addProduct(product, newType);
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const grand = getGrandTotal();
    if (amountReceived < grand) {
      toast.error("Insufficient amount received");
      return;
    }
    if (!user) return;

    setCheckoutLoading(true);
    try {
      const { saleId, invoiceNumber } = await salesAPI.checkout({
        items,
        subtotal: getSubtotal(),
        discount,
        discountAmount: getDiscountAmount(),
        grandTotal: grand,
        amountReceived,
        balance: getBalance(),
        totalCost: getTotalCost(),
        totalProfit: getTotalProfit(),
      });

      const sale: Sale = {
        id: saleId,
        invoiceNumber,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          costPrice: i.costPrice,
          priceType: i.priceType,
          lineTotal: i.lineTotal,
          lineProfit: i.lineProfit,
        })),
        subtotal: getSubtotal(),
        discountType: discount.type,
        discountValue: discount.value,
        discountAmount: getDiscountAmount(),
        grandTotal: grand,
        amountReceived,
        balance: getBalance(),
        totalCost: getTotalCost(),
        totalProfit: getTotalProfit(),
        createdAt: new Date(),
        createdBy: user.uid,
      };

      clearCart();
      await load();
      setCompletedSale(sale);
      setReceiptOpen(true);
      toast.success("Sale completed!");
    } catch (e) {
      console.error(e);
      toast.error("Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const subtotal = getSubtotal();
  const discountAmt = getDiscountAmount();
  const grandTotal = getGrandTotal();
  const balance = getBalance();

  return (
    <DashboardShell title="Point of Sale">
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="input-field pl-9"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field w-auto min-w-[120px]"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBarcode()}
                placeholder="Barcode or scan code"
                className="input-field w-40"
              />
              <button
                type="button"
                onClick={handleBarcode}
                className="btn-secondary px-3"
                title="Add barcode"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openScanner}
                className="btn-secondary px-3"
                title="Open camera barcode scanner"
              >
                <ScanBarcode className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="card min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center text-slate-500 py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No products found</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {filtered.map((product) => {
                  const out = product.stockQuantity < 1;
                  const low =
                    settings &&
                    product.stockQuantity > 0 &&
                    product.stockQuantity <= settings.lowStockThreshold;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={out}
                      onClick={() => {
                        if (out) return;
                        addProduct(product);
                        toast.success(`Added ${product.name}`);
                      }}
                      className={cn(
                        "flex flex-col rounded-lg border p-2 text-left transition hover:border-emerald-500 hover:shadow-md disabled:opacity-50",
                        out
                          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                          : low
                            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                            : "border-slate-200 dark:border-slate-700"
                      )}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="mb-2 h-16 w-full rounded object-cover"
                        />
                      ) : (
                        <div className="mb-2 flex h-16 items-center justify-center rounded bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">
                          No image
                        </div>
                      )}
                      <p className="line-clamp-2 text-xs font-semibold text-slate-900 dark:text-white">
                        {product.name}
                      </p>
                      <p className="text-xs text-emerald-600 font-medium">
                        {formatCurrency(product.sellingPrice)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Stock: {product.stockQuantity}
                        {out && " · OUT"}
                        {low && !out && " · LOW"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[380px] lg:shrink-0">
          <div className="card flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
              Cart ({items.length})
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">
                  Cart is empty
                </p>
              ) : (
                items.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  const hasSpecial =
                    product?.specialPrice != null && product.specialPrice > 0;
                  return (
                    <div
                      key={`${item.productId}-${item.priceType}`}
                      className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1">
                          {item.name}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(item.productId, item.priceType)
                          }
                          className="text-red-500 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {hasSpecial && (
                        <div className="mt-1 flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              item.priceType !== "normal" &&
                              togglePriceType(item.productId, item.priceType)
                            }
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-medium",
                              item.priceType === "normal"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700"
                            )}
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              item.priceType !== "special" &&
                              togglePriceType(item.productId, item.priceType)
                            }
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-medium",
                              item.priceType === "special"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-200 dark:bg-slate-700"
                            )}
                          >
                            Special
                          </button>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.priceType,
                                item.quantity - 1
                              )
                            }
                            className="rounded bg-slate-100 p-1 dark:bg-slate-800"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const p = products.find(
                                (x) => x.id === item.productId
                              );
                              if (p && item.quantity >= p.stockQuantity) {
                                toast.error("Not enough stock");
                                return;
                              }
                              updateQuantity(
                                item.productId,
                                item.priceType,
                                item.quantity + 1
                              );
                            }}
                            className="rounded bg-slate-100 p-1 dark:bg-slate-800"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        @ {formatCurrency(item.unitPrice)} / unit
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <p className="text-sm font-semibold">Bill Discount</p>
            <div className="flex gap-2">
              <select
                value={discount.type}
                onChange={(e) =>
                  setDiscount({
                    type: e.target.value as typeof discount.type,
                    value: discount.value,
                  })
                }
                className="input-field flex-1"
              >
                <option value="none">No discount</option>
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed Rs.</option>
              </select>
              {discount.type !== "none" && (
                <input
                  type="number"
                  value={discount.value || ""}
                  onChange={(e) =>
                    setDiscount({
                      ...discount,
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input-field w-24"
                  placeholder="0"
                />
              )}
            </div>

            <div className="space-y-1 text-sm border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span className="text-emerald-600">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Amount Received
              </label>
              <input
                type="number"
                step="0.01"
                value={amountReceived || ""}
                onChange={(e) =>
                  setAmountReceived(parseFloat(e.target.value) || 0)
                }
                className="input-field"
              />
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Balance</span>
              <span
                className={balance >= 0 ? "text-emerald-600" : "text-red-600"}
              >
                {formatCurrency(balance)}
              </span>
            </div>

            <button
              type="button"
              disabled={checkoutLoading || items.length === 0}
              onClick={handleCheckout}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <CreditCard className="h-5 w-5" />
              {checkoutLoading ? "Processing..." : "Complete Sale"}
            </button>
          </div>
        </div>
      </div>

      {scanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold">Scan Barcode</h2>
                <p className="text-xs text-slate-500">Allow camera access and point your phone at the product barcode.</p>
              </div>
              <button
                type="button"
                onClick={closeScanner}
                className="rounded-full bg-slate-200 p-2 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-2xl bg-slate-950">
                <video
                  ref={videoRef}
                  className="h-72 w-full object-cover"
                  muted
                  playsInline
                />
              </div>
              {cameraError ? (
                <p className="mt-3 text-sm text-red-500">{cameraError}</p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Scanning for a barcode. If your phone cannot access the camera, use manual entry instead.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Last barcode</span>
                  <span className="font-semibold">{detectedBarcode || "Waiting..."}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="text-emerald-600">{cameraError ? "Error" : "Ready"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {completedSale && settings && (
        <ReceiptModal
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          sale={completedSale}
          settings={settings}
        />
      )}
    </DashboardShell>
  );
}
