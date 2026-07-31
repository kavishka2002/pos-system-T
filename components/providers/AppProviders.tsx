"use client";

import { ReactNode, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { useThemeStore } from "@/stores/themeStore";

function ThemeSync({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeSync>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: "text-sm",
            style: {
              background: "var(--card)",
              color: "var(--foreground)",
            },
          }}
        />
      </ThemeSync>
    </AuthProvider>
  );
}
