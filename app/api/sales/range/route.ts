import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/sales/range?start=2024-01-01&end=2024-01-31
 * Retrieve sales within a date range
 * Query params: start (ISO date string), end (ISO date string)
 * Returns: { success: boolean, data: Sale[], error?: string }
 */
export async function GET(req: NextRequest) {
  try {
    // require auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await (await import("@/lib/firebase-admin")).auth.verifyIdToken(token);

    const startStr = req.nextUrl.searchParams.get("start");
    const endStr = req.nextUrl.searchParams.get("end");

    if (!startStr || !endStr) {
      return NextResponse.json(
        { success: false, error: "Missing start and end date parameters" },
        { status: 400 }
      );
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Fetch all sales for this user, then filter by date range in app code to avoid composite index
    const snap = await (await import("@/lib/firebase-admin")).db
      .collection("sales")
      .where("createdBy", "==", decoded.uid)
      .get();

    const sales = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((sale: any) => {
        const saleDate = sale.createdAt instanceof Date ? sale.createdAt : new Date(sale.createdAt);
        return saleDate >= start && saleDate <= end;
      })
      .sort((a: any, b: any) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));

    return NextResponse.json({ success: true, data: sales });
  } catch (error) {
    console.error("Error fetching sales in range:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sales",
      },
      { status: 500 }
    );
  }
}
