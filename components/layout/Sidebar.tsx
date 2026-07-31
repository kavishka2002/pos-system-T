"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  Warehouse,
  BarChart3,
  Settings,
  LogOut,
  Store,
  FileMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

const nav = [
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/returns", label: "Returns", icon: FileMinus },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-64">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-5 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Smart Retail
          </p>
          <p className="text-xs text-slate-500">POS System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <LogOut className="h-5 w-5" />
        Logout
      </button>
    </aside>
  );
}
