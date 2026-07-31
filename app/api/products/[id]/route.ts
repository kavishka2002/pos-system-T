import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import { calcProfitPerItem } from "@/lib/utils";
import type { ProductInput } from "@/lib/firestore/products";

/**
 * GET /api/products/[id]
 * Retrieve a specific product
 * Returns: { success: boolean, data: Product, error?: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // require auth
    const authHeader = _req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const snap = await adminDb.collection("products").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (data.createdBy !== decoded.uid) {
      return NextResponse.json({ success: false, error: "Not authorized to view this product" }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: { id: snap.id, ...data } });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch product",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Update a product
 * Body: JSON with product fields to update
 * Returns: { success: boolean, error?: string }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify authentication token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const productUpdate: Partial<ProductInput> & { profitPerItem?: number } = {};

    // Only include fields that are provided
    if (body.name !== undefined) productUpdate.name = body.name;
    if (body.category !== undefined) productUpdate.category = body.category;
    if (body.costPrice !== undefined) productUpdate.costPrice = body.costPrice;
    if (body.sellingPrice !== undefined) productUpdate.sellingPrice = body.sellingPrice;
    if (body.specialPrice !== undefined) productUpdate.specialPrice = body.specialPrice;
    if (body.stockQuantity !== undefined) productUpdate.stockQuantity = body.stockQuantity;
    if (body.barcode !== undefined) productUpdate.barcode = body.barcode;
    if (body.imageUrl !== undefined) productUpdate.imageUrl = body.imageUrl;

    if (Object.keys(productUpdate).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Recalculate profitPerItem if prices changed
    if (productUpdate.sellingPrice !== undefined || productUpdate.costPrice !== undefined) {
      const docRef = adminDb.collection("products").doc(id);
      const existingSnap = await docRef.get();
      const existing = existingSnap.data() || {};
      // ensure ownership
      if (existing.createdBy && authHeader) {
        const token2 = authHeader.substring(7);
        const decoded2 = await adminAuth.verifyIdToken(token2);
        if (existing.createdBy !== decoded2.uid) {
          return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
        }
      }
      const selling = productUpdate.sellingPrice ?? existing.sellingPrice;
      const cost = productUpdate.costPrice ?? existing.costPrice;
      productUpdate.profitPerItem = calcProfitPerItem(selling, cost);
      await docRef.update({ ...productUpdate, updatedAt: new Date() });
    } else {
      await adminDb.collection("products").doc(id).update({ ...productUpdate, updatedAt: new Date() });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update product",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete a product
 * Returns: { success: boolean, error?: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify authentication token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // ensure ownership before delete
    const docSnap = await adminDb.collection("products").doc(id).get();
    const data = docSnap.data() || {};
    const decoded = await adminAuth.verifyIdToken(token);
    if (data.createdBy && data.createdBy !== decoded.uid) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    await adminDb.collection("products").doc(id).delete();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete product",
      },
      { status: 500 }
    );
  }
}
