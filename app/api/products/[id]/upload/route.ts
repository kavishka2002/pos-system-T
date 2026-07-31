import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth } from "@/lib/firebase-admin";

/**
 * POST /api/products/[id]/upload
 * Upload an image for a product
 * Body: FormData with "image" file
 * Returns: { success: boolean, data: { imageUrl: string }, error?: string }
 */
export async function POST(
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

    const formData = await req.formData();
    const imageFile = formData.get("image") as File | undefined;

    if (!imageFile) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }

    // Currently server-side image upload is not implemented.
    // Return 501 Not Implemented so client can handle fallback.
    return NextResponse.json({ success: false, error: "Server image upload not implemented" }, { status: 501 });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 }
    );
  }
}
