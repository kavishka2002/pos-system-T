import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import { generateInvoiceNumber } from "@/lib/utils";
import type { CheckoutPayload } from "@/lib/firestore/sales";

const SALES_COL = "sales";
const SALE_ITEMS_COL = "sale_items";
const STOCK_MOVEMENTS = "stock_movements";
const SETTINGS_ID = "shop";

/**
 * GET /api/sales
 * Retrieve all sales
 * Returns: { success: boolean, data: Sale[], error?: string }
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const snap = await adminDb.collection(SALES_COL).where("createdBy", "==", decoded.uid).get();
    const sales = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    sales.sort((a: any, b: any) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
    return NextResponse.json({ success: true, data: sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch sales" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales
 * Complete a checkout and create a sale
 * Body: CheckoutPayload
 * Returns: { success: boolean, data: { saleId: string, invoiceNumber: string }, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const payload: CheckoutPayload = { ...body, userId: decodedToken.uid };

    // Load settings and generate invoice
    const settingsRef = adminDb.collection("settings").doc(SETTINGS_ID);
    const settingsSnap = await settingsRef.get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() : { invoiceCounter: 1 };
    const invoiceNumber = generateInvoiceNumber(settingsData?.invoiceCounter || 1);
    await settingsRef.set({ ...(settingsData || {}), invoiceCounter: (settingsData?.invoiceCounter || 1) + 1, updatedAt: new Date() }, { merge: true });

    // Create sale document
    const saleItems = payload.items.map((item: any) => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      priceType: item.priceType,
      lineTotal: item.lineTotal,
      lineProfit: item.lineProfit,
    }));

    const saleRef = await adminDb.collection(SALES_COL).add({
      invoiceNumber,
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
      createdAt: new Date(),
      createdBy: payload.userId,
    });

    const batch = adminDb.batch();

    for (const item of payload.items) {
      const productRef = adminDb.collection("products").doc(item.productId);
      const productSnap = await productRef.get();
      if (!productSnap.exists) continue;
      const prevStock = productSnap.data()?.stockQuantity || 0;
      const newStock = Math.max(0, prevStock - item.quantity);

      batch.update(productRef, { stockQuantity: newStock, updatedAt: new Date() });

      // stock movement
      const mvRef = adminDb.collection(STOCK_MOVEMENTS).doc();
      batch.set(mvRef, {
        productId: item.productId,
        productName: item.name,
        type: "sale",
        quantityChange: -item.quantity,
        previousStock: prevStock,
        newStock,
        referenceId: saleRef.id,
        createdBy: payload.userId,
        createdAt: new Date(),
      });

      // sale item
      const siRef = adminDb.collection(SALE_ITEMS_COL).doc();
      batch.set(siRef, {
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
        createdAt: new Date(),
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, data: { saleId: saleRef.id, invoiceNumber } }, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create sale",
      },
      { status: 500 }
    );
  }
}
