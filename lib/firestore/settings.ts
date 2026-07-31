import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ShopSettings } from "@/types";

const SETTINGS_ID = "shop";

const defaultSettings: Omit<ShopSettings, "id"> = {
  shopName: "Smart Retail Shop",
  address: "123 Main Street, Colombo",
  contactNumber: "+94 11 234 5678",
  receiptFooter: "Thank you for shopping with us!",
  lowStockThreshold: 10,
  invoiceCounter: 1,
};

export async function getShopSettings(): Promise<ShopSettings> {
  const ref = doc(db, "settings", SETTINGS_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...defaultSettings, updatedAt: serverTimestamp() });
    return { id: SETTINGS_ID, ...defaultSettings };
  }
  return { id: SETTINGS_ID, ...defaultSettings, ...snap.data() } as ShopSettings;
}

export async function updateShopSettings(
  data: Partial<Omit<ShopSettings, "id">>
): Promise<void> {
  const ref = doc(db, "settings", SETTINGS_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...defaultSettings, ...data, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }
}

export async function incrementInvoiceCounter(): Promise<string> {
  const settings = await getShopSettings();
  const next = (settings.invoiceCounter || 1) + 1;
  await updateShopSettings({ invoiceCounter: next });
  return String(settings.invoiceCounter || 1);
}
