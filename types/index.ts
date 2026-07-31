import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  specialPrice?: number;
  profitPerItem: number;
  stockQuantity: number;
  barcode?: string;
  imageUrl?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export type PriceType = "normal" | "special";

export interface CartItem {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  priceType: PriceType;
  lineTotal: number;
  lineProfit: number;
}

export type BillDiscountType = "percentage" | "fixed" | "none";

export interface BillDiscount {
  type: BillDiscountType;
  value: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  priceType: PriceType;
  lineTotal: number;
  lineProfit: number;
}

export type SaleType = "sale" | "return";

export interface Sale {
  id: string;
  invoiceNumber: string;
  type?: SaleType;
  originalSaleId?: string;
  originalInvoiceNumber?: string;
  items: SaleItem[];
  subtotal: number;
  discountType: BillDiscountType;
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  amountReceived: number;
  balance: number;
  totalCost: number;
  totalProfit: number;
  // Optional fields for returns
  customerName?: string;
  refundAmount?: number; // amount returned to customer (positive)
  customerOwes?: number; // amount customer needs to pay (positive)
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: "sale" | "adjustment" | "restock";
  quantityChange: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  note?: string;
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface ShopSettings {
  id: string;
  shopName: string;
  address: string;
  contactNumber: string;
  logoUrl?: string;
  receiptFooter: string;
  lowStockThreshold: number;
  invoiceCounter: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  createdAt: Timestamp | Date;
}
