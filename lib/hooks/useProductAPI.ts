import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Product } from "@/types";

export interface ProductFormData {
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  specialPrice?: number;
  stockQuantity: number;
  barcode?: string;
}

/**
 * Hook for product API operations
 */
export function useProductAPI() {
  const { user, signOut } = useAuth();

  return useMemo(() => {
    const getToken = async (forceRefresh = false): Promise<string> => {
      if (!user) throw new Error("User not authenticated");
      return user.getIdToken(forceRefresh);
    };

    const requestWithTokenRetry = async <T>(
      input: RequestInfo,
      init: RequestInit,
      retried = false
    ): Promise<T> => {
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

        throw new Error(
          "Session expired. Please sign out and sign in again to refresh your authentication token."
        );
      }

      throw new Error(apiError || "Failed request");
    };

    const createProduct = async (
      data: ProductFormData,
      imageFile?: File
    ): Promise<{ id: string; imageUrl?: string }> => {
      const token = await getToken();
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      return requestWithTokenRetry<{ id: string; imageUrl?: string }>("/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
    };

    const getProducts = async (): Promise<Product[]> => {
      const token = await getToken();
      return requestWithTokenRetry<Product[]>("/api/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    const getProduct = async (id: string): Promise<Product> => {
      const token = await getToken();
      return requestWithTokenRetry<Product>(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    const updateProduct = async (
      id: string,
      data: Partial<ProductFormData>
    ): Promise<void> => {
      const token = await getToken();

      await requestWithTokenRetry<void>(`/api/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
    };

    const deleteProduct = async (id: string): Promise<void> => {
      const token = await getToken();

      await requestWithTokenRetry<void>(`/api/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    };

    const uploadProductImage = async (
      id: string,
      imageFile: File
    ): Promise<string> => {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", imageFile);

      const result = await requestWithTokenRetry<{ imageUrl: string }>(`/api/products/${id}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      return result.imageUrl;
    };

    return {
      createProduct,
      getProducts,
      getProduct,
      updateProduct,
      deleteProduct,
      uploadProductImage,
    };
  }, [user]);
}
