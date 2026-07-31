import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  Timestamp,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateProductStock } from "@/lib/firestore/products";
import { addStockMovement } from "@/lib/firestore/stock";
import { getShopSettings, updateShopSettings } from "@/lib/firestore/settings";
import { generateInvoiceNumber } from "@/lib/utils";
import type { Sale, SaleItem, CartItem, BillDiscount } from "@/types";

const SALES_COL = "sales";
const SALE_ITEMS_COL = "sale_items";

function mapSale(id: string, data: Record<string, unknown>): Sale {
  return {
    id,
    invoiceNumber: data.invoiceNumber as string,
    items: (data.items as SaleItem[]) || [],
    subtotal: data.subtotal as number,
    discountType: data.discountType as Sale["discountType"],
    discountValue: data.discountValue as number,
    discountAmount: data.discountAmount as number,
    grandTotal: data.grandTotal as number,
    amountReceived: data.amountReceived as number,
    balance: data.balance as number,
    totalCost: data.totalCost as number,
    totalProfit: data.totalProfit as number,
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
  };
}

export async function getSales(): Promise<Sale[]> {
  const q = query(collection(db, SALES_COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapSale(d.id, d.data()));
}

export async function getSalesInRange(
  start: Date,
  end: Date
): Promise<Sale[]> {
  const q = query(
    collection(db, SALES_COL),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapSale(d.id, d.data()));
}

export interface CheckoutPayload {
  items: CartItem[];
  subtotal: number;
  discount: BillDiscount;
  discountAmount: number;
  grandTotal: number;
  amountReceived: number;
  balance: number;
  totalCost: number;
  totalProfit: number;
  userId: string;
}

export async function completeCheckout(
  payload: CheckoutPayload
): Promise<{ saleId: string; invoiceNumber: string }> {
  const settings = await getShopSettings();
  const invoiceNumber = generateInvoiceNumber(settings.invoiceCounter);
  await updateShopSettings({ invoiceCounter: settings.invoiceCounter + 1 });

  const saleItems: SaleItem[] = payload.items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    costPrice: item.costPrice,
    priceType: item.priceType,
    lineTotal: item.lineTotal,
    lineProfit: item.lineProfit,
  }));

  const saleRef = await addDoc(collection(db, SALES_COL), {
    invoiceNumber,
    type: "sale",
    items: saleItems,
    subtotal: payload.subtotal,
    discountType: payload.discount.type,
    discountValue: payload.discount.value,
    discountAmount: payload.discountAmount,
    grandTotal: payload.grandTotal,
    amountReceived: payload.amountReceived,
    balance: payload.balance,
    totalCost: payload.totalCost,
    totalProfit: payload.totalProfit,
    createdAt: serverTimestamp(),
    createdBy: payload.userId,
  });

  const batch = writeBatch(db);

  for (const item of payload.items) {
    const productRef = doc(db, "products", item.productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) continue;

    const prevStock = productSnap.data().stockQuantity as number;
    const newStock = Math.max(0, prevStock - item.quantity);

    await updateProductStock(item.productId, newStock);

    await addStockMovement({
      productId: item.productId,
      productName: item.name,
      type: "sale",
      quantityChange: -item.quantity,
      previousStock: prevStock,
      newStock,
      referenceId: saleRef.id,
      createdBy: payload.userId,
    });

    const itemRef = doc(collection(db, SALE_ITEMS_COL));
    batch.set(itemRef, {
      saleId: saleRef.id,
      invoiceNumber,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      priceType: item.priceType,
      lineTotal: item.lineTotal,
      lineProfit: item.lineProfit,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return { saleId: saleRef.id, invoiceNumber };
}
