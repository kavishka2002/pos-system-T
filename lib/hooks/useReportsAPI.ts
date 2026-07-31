import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ReportData = {
  summary: {
    revenue: number;
    cost: number;
    profit: number;
    transactions: number;
  };
  series?: Record<string, number>;
  days?: string[];
};

/**
 * Hook for fetching report data from server
 */
export function useReportsAPI() {
  const { user, signOut } = useAuth();

  return useMemo(
    () => {
      const getToken = async (forceRefresh = false): Promise<string> => {
        if (!user) throw new Error("User not authenticated");
        return user.getIdToken(forceRefresh);
      };

      const requestWithTokenRetry = async <T>(input: RequestInfo, init: RequestInit, retried = false): Promise<T> => {
        const response = await fetch(input, init);
        if (response.ok) {
          return response.json().then((res) => res.data as T);
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
            return retryResponse.json().then((res) => res.data as T);
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

      const getReport = async (opts: { range?: string; start?: string; end?: string }): Promise<ReportData> => {
        if (!user) throw new Error("User not authenticated");

        const params = new URLSearchParams();
        if (opts.range) params.set("range", opts.range);
        if (opts.start) params.set("start", opts.start);
        if (opts.end) params.set("end", opts.end);

        const token = await getToken();
        return requestWithTokenRetry<ReportData>(`/api/reports?${params.toString()}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      };

      return { getReport };
    },
    [user, signOut]
  );
}
