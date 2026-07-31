"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-2xl rounded-lg bg-white p-8 shadow dark:bg-slate-800">
          <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-300">This is a placeholder dashboard page at /dashboard.</p>
        </div>
      </div>
    </AuthGuard>
  );
}
