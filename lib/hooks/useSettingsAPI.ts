import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ShopSettings } from "@/types";

/**
 * Hook for settings API operations
 */
export function useSettingsAPI() {
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

    const getSettings = async (): Promise<ShopSettings> => {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch settings");
      }

      return response.json().then((res) => res.data);
    };

    const updateSettings = async (
      data: Partial<Omit<ShopSettings, "id">>
    ): Promise<void> => {
      const token = await getToken();

      await requestWithTokenRetry<void>("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
    };

    return {
      getSettings,
      updateSettings,
    };
  }, [user, signOut]);
}
