import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { calcProfitPerItem } from "@/lib/utils";
import type { Product } from "@/types";

const COL = "products";

function mapProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    name: data.name as string,
    category: data.category as string,
    costPrice: data.costPrice as number,
    sellingPrice: data.sellingPrice as number,
    specialPrice: data.specialPrice as number | undefined,
    profitPerItem: data.profitPerItem as number,
    stockQuantity: data.stockQuantity as number,
    barcode: data.barcode as string | undefined,
    imageUrl: data.imageUrl as string | undefined,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function getProducts(): Promise<Product[]> {
  const q = query(collection(db, COL), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapProduct(d.id, d.data()));
}

export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return mapProduct(snap.id, snap.data());
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p.barcode === barcode) ?? null;
}

export interface ProductInput {
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  specialPrice?: number;
  stockQuantity: number;
  barcode?: string;
  imageUrl?: string;
}

export async function addProduct(input: ProductInput): Promise<string> {
  const profitPerItem = calcProfitPerItem(input.sellingPrice, input.costPrice);
  const docRef = await addDoc(collection(db, COL), {
    ...input,
    specialPrice: input.specialPrice || null,
    profitPerItem,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<void> {
  const existing = await getProduct(id);
  if (!existing) throw new Error("Product not found");

  const sellingPrice = input.sellingPrice ?? existing.sellingPrice;
  const costPrice = input.costPrice ?? existing.costPrice;
  const profitPerItem = calcProfitPerItem(sellingPrice, costPrice);

  await updateDoc(doc(db, COL, id), {
    ...input,
    profitPerItem,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function updateProductStock(
  id: string,
  newQuantity: number
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    stockQuantity: newQuantity,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProductImage(
  file: File,
  productId: string
): Promise<string> {
  const storageRef = ref(storage, `products/${productId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
