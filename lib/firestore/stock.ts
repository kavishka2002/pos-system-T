import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StockMovement } from "@/types";
import { Timestamp } from "firebase/firestore";

const COL = "stock_movements";

export async function addStockMovement(
  data: Omit<StockMovement, "id" | "createdAt">
): Promise<void> {
  await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getStockMovements(
  max = 100
): Promise<StockMovement[]> {
  const q = query(
    collection(db, COL),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      productId: data.productId,
      productName: data.productName,
      type: data.type,
      quantityChange: data.quantityChange,
      previousStock: data.previousStock,
      newStock: data.newStock,
      referenceId: data.referenceId,
      note: data.note,
      createdAt: data.createdAt as Timestamp,
      createdBy: data.createdBy,
    };
  });
}
