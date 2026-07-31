import { NextRequest, NextResponse } from "next/server";
import { calcProfitPerItem } from "@/lib/utils";
import { db as adminDb, auth as adminAuth } from "@/lib/firebase-admin";

const COL = "products";

/**
 * GET /api/products
 * Retrieve all products
 * Returns: { success: boolean, data: Product[], error?: string }
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    const snap = await adminDb.collection(COL).where("createdBy", "==", decoded.uid).get();
    const products = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    products.sort((a: any, b: any) => ((a.name || "") as string).localeCompare((b.name || "") as string));
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product with optional image upload
 * Body: FormData with product fields and optional "image" file
 * Returns: { success: boolean, data: { id: string, imageUrl?: string }, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    const formData = await req.formData();
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const costPrice = parseFloat(formData.get("costPrice") as string);
    const sellingPrice = parseFloat(formData.get("sellingPrice") as string);
    const specialPrice = formData.get("specialPrice")
      ? parseFloat(formData.get("specialPrice") as string)
      : undefined;
    const stockQuantity = parseInt(formData.get("stockQuantity") as string);
    const barcode = (formData.get("barcode") as string) || undefined;

    if (!name || !category || isNaN(costPrice) || isNaN(sellingPrice) || isNaN(stockQuantity)) {
      return NextResponse.json({ success: false, error: "Missing or invalid required fields" }, { status: 400 });
    }

    const profitPerItem = calcProfitPerItem(sellingPrice, costPrice);

    const docRef = await adminDb.collection(COL).add({
      name,
      category,
      costPrice,
      sellingPrice,
      specialPrice: specialPrice ?? null,
      stockQuantity,
      barcode: barcode ?? null,
      profitPerItem,
      createdBy: decoded.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { id: docRef.id } }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create product" }, { status: 500 });
  }
}
