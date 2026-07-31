import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import type { StockMovement } from "@/types";

const COL = "stock_movements";

/**
 * GET /api/stock
 * Retrieve stock movements
 * Query params: ?limit=100
 * Returns: { success: boolean, data: StockMovement[], error?: string }
 */
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
    const snap = await adminDb.collection(COL).orderBy("createdAt", "desc").limit(limit).get();
    const movements = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ success: true, data: movements });
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stock movements",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock
 * Record a stock movement
 * Body: { productId: string, productName: string, type: 'in'|'out'|'adjustment', quantityChange: number, previousStock: number, newStock: number, referenceId?: string, note?: string }
 * Returns: { success: boolean, error?: string }
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

    const movementData = {
      productId: body.productId,
      productName: body.productName,
      type: body.type,
      quantityChange: body.quantityChange,
      previousStock: body.previousStock,
      newStock: body.newStock,
      referenceId: body.referenceId || null,
      note: body.note || null,
      createdBy: decodedToken.uid,
      createdAt: new Date(),
    };

    await adminDb.collection(COL).add(movementData);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error recording stock movement:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record stock movement",
      },
      { status: 500 }
    );
  }
}
