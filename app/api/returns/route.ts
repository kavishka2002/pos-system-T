import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";

const SALES_COL = "sales";
const SALE_ITEMS_COL = "sale_items";
const STOCK_MOVEMENTS = "stock_movements";
const SETTINGS_ID = "shop";

function generateReturnInvoiceNumber(counter: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `RTN-${y}${m}${d}-${String(counter).padStart(5, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const { originalSaleId, originalInvoiceNumber, items } = body as {
      originalSaleId: string;
      originalInvoiceNumber: string;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        priceType: string;
        lineTotal: number;
        lineProfit: number;
      }>;
    };

    if (!originalSaleId || !originalInvoiceNumber || !items?.length) {
      return NextResponse.json(
        { success: false, error: "Invalid return payload" },
        { status: 400 }
      );
    }

    const originalSaleSnap = await adminDb.collection(SALES_COL).doc(originalSaleId).get();
    if (!originalSaleSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Original sale not found" },
        { status: 404 }
      );
    }

    const originalSale = originalSaleSnap.data();
    if (originalSale?.type === "return") {
      return NextResponse.json(
        { success: false, error: "Cannot return a return bill" },
        { status: 400 }
      );
    }

    const validItems = items.filter((item) => item.quantity > 0);
    if (!validItems.length) {
      return NextResponse.json(
        { success: false, error: "No items selected for return" },
        { status: 400 }
      );
    }

    const settingsRef = adminDb.collection("settings").doc(SETTINGS_ID);
    const settingsSnap = await settingsRef.get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() : { invoiceCounter: 1 };
    const invoiceNumber = generateReturnInvoiceNumber(settingsData?.invoiceCounter || 1);
    await settingsRef.set(
      {
        ...(settingsData || {}),
        invoiceCounter: (settingsData?.invoiceCounter || 1) + 1,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    const saleItems = validItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      priceType: item.priceType,
      lineTotal: item.lineTotal,
      lineProfit: item.lineProfit,
    }));

    const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = saleItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const totalProfit = saleItems.reduce((sum, item) => sum + item.lineProfit, 0);
    const grandTotal = subtotal;

    // allow caller to pass customer and refund info
    const customerName = (body.customerName as string) || null;
    const refundAmount = typeof body.refundAmount === "number" ? body.refundAmount : 0;
    const customerOwes = typeof body.customerOwes === "number" ? body.customerOwes : 0;

    const saleRef = await adminDb.collection(SALES_COL).add({
      invoiceNumber,
      type: "return",
      originalSaleId,
      originalInvoiceNumber,
      items: saleItems,
      subtotal,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      grandTotal,
      // For returns the recorded amountReceived is 0; refunds are tracked separately
      amountReceived: 0,
      balance: 0,
      totalCost,
      totalProfit,
      customerName,
      refundAmount,
      customerOwes,
      createdAt: new Date(),
      createdBy: decodedToken.uid,
    });

    const batch = adminDb.batch();

    for (const item of saleItems) {
      const productRef = adminDb.collection("products").doc(item.productId);
      const productSnap = await productRef.get();
      const prevStock = productSnap.exists ? (productSnap.data()?.stockQuantity || 0) : 0;
      const newStock = prevStock + item.quantity;
      if (productSnap.exists) {
        batch.update(productRef, { stockQuantity: newStock, updatedAt: new Date() });
      }

      const mvRef = adminDb.collection(STOCK_MOVEMENTS).doc();
      batch.set(mvRef, {
        productId: item.productId,
        productName: item.productName,
        type: "restock",
        quantityChange: item.quantity,
        previousStock: prevStock,
        newStock,
        referenceId: saleRef.id,
        createdBy: decodedToken.uid,
        createdAt: new Date(),
      });

      const siRef = adminDb.collection(SALE_ITEMS_COL).doc();
      batch.set(siRef, {
        saleId: saleRef.id,
        invoiceNumber,
        originalSaleId,
        productId: item.productId,
        productName: item.productName,
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
    console.error("Error creating return sale:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create return" },
      { status: 500 }
    );
  }
}
