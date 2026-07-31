import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import type { ShopSettings } from "@/types";

const SETTINGS_ID = "shop";

const defaultSettings: Omit<ShopSettings, "id"> = {
  shopName: "Smart Retail Shop",
  address: "123 Main Street, Colombo",
  contactNumber: "+94 11 234 5678",
  logoUrl: "",
  receiptFooter: "Thank you for shopping with us!",
  lowStockThreshold: 10,
  invoiceCounter: 1,
};

async function getAdminShopSettings(): Promise<ShopSettings> {
  const ref = adminDb.collection("settings").doc(SETTINGS_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...defaultSettings, updatedAt: new Date() });
    return { id: SETTINGS_ID, ...defaultSettings };
  }
  return { id: SETTINGS_ID, ...defaultSettings, ...snap.data() } as ShopSettings;
}

async function updateAdminShopSettings(
  data: Partial<Omit<ShopSettings, "id">>
): Promise<void> {
  const ref = adminDb.collection("settings").doc(SETTINGS_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...defaultSettings, ...data, updatedAt: new Date() });
  } else {
    await ref.update({ ...data, updatedAt: new Date() });
  }
}

/**
 * GET /api/settings
 * Retrieve shop settings
 * Returns: { success: boolean, data: ShopSettings, error?: string }
 */
export async function GET() {
  try {
    const settings = await getAdminShopSettings();
    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update shop settings
 * Body: Partial<ShopSettings> (without id)
 * Returns: { success: boolean, error?: string }
 */
export async function PUT(req: NextRequest) {
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
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const updateData: Partial<Omit<ShopSettings, "id">> = {};

    // Only include fields that are provided
    if (body.shopName !== undefined) updateData.shopName = body.shopName;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.contactNumber !== undefined) updateData.contactNumber = body.contactNumber;
    if (body.receiptFooter !== undefined) updateData.receiptFooter = body.receiptFooter;
    if (body.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.lowStockThreshold;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.invoiceCounter !== undefined) updateData.invoiceCounter = body.invoiceCounter;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    await updateAdminShopSettings(updateData);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
