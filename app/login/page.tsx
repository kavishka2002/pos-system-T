"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowRight, Store, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { user, loading, signIn, signInWithGoogle, signInAsGuest } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { register, handleSubmit } = useForm<LoginForm>();

  useEffect(() => {
    if (!loading && user) {
      router.push("/pos");
    }
  }, [user, loading, router]);

  const redirectToDashboard = async () => {
    router.push("/pos");
  };

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      await signIn(data.email, data.password);
      toast.success("Welcome back!");
      await redirectToDashboard();
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google");
      await redirectToDashboard();
    } catch {
      toast.error("Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  // demo sign-in removed

  // Render the login form immediately so the page is usable
  // while Firebase auth initializes. Inputs are disabled while loading.

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Smart Retail POS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage sales & inventory
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              {...register("email", { required: true })}
              className="input-field"
              disabled={submitting}
              placeholder="cashier@shop.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              type="password"
              {...register("password", { required: true })}
              className="input-field"
              disabled={submitting}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="btn-primary w-full py-3"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="btn-secondary w-full py-3 text-slate-700 dark:text-slate-200"
          >
            <span className="flex items-center justify-center gap-2">
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                className="h-5 w-5"
              />
              {googleLoading ? "Signing in with Google..." : "Continue with Google"}
            </span>
          </button>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            New here? <a href="/register" className="font-medium text-emerald-600">Create an account</a>
          </p>
        </form>
      </div>
    </div>
  );
}
