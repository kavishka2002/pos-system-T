import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Sale, CartItem, BillDiscount, PriceType } from "@/types";

export interface CheckoutData {
  items: CartItem[];
  subtotal: number;
  discount: BillDiscount;
  discountAmount: number;
  grandTotal: number;
  amountReceived: number;
  balance: number;
  totalCost: number;
  totalProfit: number;
}

/**
 * Hook for sales API operations
 */
export function useSalesAPI() {
  const { user, signOut } = useAuth();

  return useMemo(() => {
    const getToken = async (forceRefresh = false): Promise<string> => {
      if (!user) throw new Error("User not authenticated");
      return user.getIdToken(forceRefresh);
    };

    const requestWithTokenRetry = async <T>(input: RequestInfo, init: RequestInit, retried = false): Promise<T> => {
      const response = await fetch(input, init);
      if (response.ok) {
        return response.json().then((res) => res.data);
      }
      const errorBody = await response.json().catch(() => ({}));
      const apiError = errorBody.error || response.statusText;

      if (!retried && apiError === "Invalid token") {
        const token = await getToken(true);
        const retryResponse = await fetch(input, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${token}`,
          },
        });
        if (retryResponse.ok) {
          return retryResponse.json().then((res) => res.data);
        }
        try {
          await signOut();
        } catch (signOutError) {
          console.warn("Failed to sign out after invalid token:", signOutError);
        }
        throw new Error("Session expired. Please sign out and sign in again.");
      }

      throw new Error(apiError || "Failed request");
    };

    const getSales = async (): Promise<Sale[]> => {
      const token = await getToken();
      return requestWithTokenRetry<Sale[]>("/api/sales", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    const getSalesInRange = async (start: Date, end: Date): Promise<Sale[]> => {
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const token = await getToken();
      return requestWithTokenRetry<Sale[]>(`/api/sales/range?start=${startStr}&end=${endStr}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    const checkout = async (data: CheckoutData): Promise<{ saleId: string; invoiceNumber: string }> => {
      const token = await getToken();

      return requestWithTokenRetry<{ saleId: string; invoiceNumber: string }>("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
    };

    const createReturn = async (
      payload: {
        originalSaleId: string;
        originalInvoiceNumber: string;
        customerName?: string | null;
        refundAmount?: number;
        customerOwes?: number;
        items: Array<{
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          costPrice: number;
          priceType: PriceType;
          lineTotal: number;
          lineProfit: number;
        }>;
      }
    ): Promise<{ saleId: string; invoiceNumber: string }> => {
      const token = await getToken();

      return requestWithTokenRetry<{ saleId: string; invoiceNumber: string }>("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    };

    return {
      getSales,
      getSalesInRange,
      checkout,
      createReturn,
    };
  }, [user]);
}
