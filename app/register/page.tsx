"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowRight, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

interface RegisterForm {
  email: string;
  password: string;
  displayName?: string;
}

export default function RegisterPage() {
  const { user, loading, register: authRegister } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm<RegisterForm>();

  useEffect(() => {
    if (!loading && user) {
      router.push("/pos");
    }
  }, [user, loading, router]);

  const onSubmit = async (data: RegisterForm) => {
    setSubmitting(true);
    try {
      await authRegister(data.email, data.password, data.displayName);
      toast.success("Account created");
      router.push("/pos");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">Create a new account to manage your store</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name (optional)</label>
            <input type="text" {...register("displayName")} className="input-field" placeholder="Shop name or your name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input type="email" {...register("email", { required: true })} className="input-field" placeholder="you@shop.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input type="password" {...register("password", { required: true })} className="input-field" />
          </div>
          <button type="submit" disabled={submitting || loading} className="btn-primary w-full py-3">
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
