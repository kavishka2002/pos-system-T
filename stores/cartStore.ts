import { create } from "zustand";
import type { CartItem, BillDiscount, PriceType, Product } from "@/types";
import { calcBillDiscount } from "@/lib/utils";

interface CartState {
  items: CartItem[];
  discount: BillDiscount;
  amountReceived: number;
  addProduct: (product: Product, priceType?: PriceType) => void;
  removeItem: (productId: string, priceType: PriceType) => void;
  updateQuantity: (
    productId: string,
    priceType: PriceType,
    quantity: number
  ) => void;
  setPriceType: (productId: string, priceType: PriceType) => void;
  setDiscount: (discount: BillDiscount) => void;
  setAmountReceived: (amount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getGrandTotal: () => number;
  getBalance: () => number;
  getTotalCost: () => number;
  getTotalProfit: () => number;
}

function unitPriceFor(product: Product, priceType: PriceType): number {
  if (
    priceType === "special" &&
    product.specialPrice != null &&
    product.specialPrice > 0
  ) {
    return product.specialPrice;
  }
  return product.sellingPrice;
}

function lineTotals(
  quantity: number,
  unitPrice: number,
  costPrice: number
): { lineTotal: number; lineProfit: number } {
  const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
  const lineProfit =
    Math.round(quantity * (unitPrice - costPrice) * 100) / 100;
  return { lineTotal, lineProfit };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: { type: "none", value: 0 },
  amountReceived: 0,

  addProduct: (product, priceType = "normal") => {
    const pt =
      priceType === "special" &&
      product.specialPrice != null &&
      product.specialPrice > 0
        ? "special"
        : "normal";
    const unitPrice = unitPriceFor(product, pt);
    const { items } = get();
    const existing = items.find(
      (i) => i.productId === product.id && i.priceType === pt
    );

    if (existing) {
      if (existing.quantity >= product.stockQuantity) return;
      get().updateQuantity(product.id, pt, existing.quantity + 1);
      return;
    }

    if (product.stockQuantity < 1) return;

    const { lineTotal, lineProfit } = lineTotals(1, unitPrice, product.costPrice);

    set({
      items: [
        ...items,
        {
          productId: product.id,
          name: product.name,
          category: product.category,
          quantity: 1,
          costPrice: product.costPrice,
          unitPrice,
          priceType: pt,
          lineTotal,
          lineProfit,
        },
      ],
    });
  },

  removeItem: (productId, priceType) => {
    set({
      items: get().items.filter(
        (i) => !(i.productId === productId && i.priceType === priceType)
      ),
    });
  },

  updateQuantity: (productId, priceType, quantity) => {
    if (quantity < 1) {
      get().removeItem(productId, priceType);
      return;
    }
    set({
      items: get().items.map((item) => {
        if (item.productId !== productId || item.priceType !== priceType)
          return item;
        const { lineTotal, lineProfit } = lineTotals(
          quantity,
          item.unitPrice,
          item.costPrice
        );
        return { ...item, quantity, lineTotal, lineProfit };
      }),
    });
  },

  setPriceType: (productId, newPriceType) => {
    const { items } = get();
    const item = items.find((i) => i.productId === productId);
    if (!item) return;

    get().removeItem(productId, item.priceType);
    // Re-add handled by caller with product data on POS page
  },

  setDiscount: (discount) => set({ discount }),
  setAmountReceived: (amount) => set({ amountReceived: amount }),

  clearCart: () =>
    set({
      items: [],
      discount: { type: "none", value: 0 },
      amountReceived: 0,
    }),

  getSubtotal: () =>
    get().items.reduce((sum, i) => sum + i.lineTotal, 0),

  getDiscountAmount: () =>
    calcBillDiscount(get().getSubtotal(), get().discount),

  getGrandTotal: () => {
    const sub = get().getSubtotal();
    return Math.round((sub - get().getDiscountAmount()) * 100) / 100;
  },

  getBalance: () => {
    const received = get().amountReceived;
    const grand = get().getGrandTotal();
    return Math.round((received - grand) * 100) / 100;
  },

  getTotalCost: () =>
    get().items.reduce(
      (sum, i) => sum + Math.round(i.quantity * i.costPrice * 100) / 100,
      0
    ),

  getTotalProfit: () => {
    const itemProfit = get().items.reduce((sum, i) => sum + i.lineProfit, 0);
    const billDiscount = get().getDiscountAmount();
    return Math.round((itemProfit - billDiscount) * 100) / 100;
  },
}));
