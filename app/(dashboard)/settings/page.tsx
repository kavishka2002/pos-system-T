"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useSettingsAPI } from "@/lib/hooks";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import toast from "react-hot-toast";

interface SettingsForm {
  shopName: string;
  address: string;
  contactNumber: string;
  receiptFooter: string;
  lowStockThreshold: number;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();
  const settingsAPI = useSettingsAPI();

  const load = useCallback(async () => {
    try {
      const s = await settingsAPI.getSettings();
      reset({
        shopName: s.shopName,
        address: s.address,
        contactNumber: s.contactNumber,
        receiptFooter: s.receiptFooter,
        lowStockThreshold: s.lowStockThreshold,
      });
      setLogoUrl(s.logoUrl);
    } catch (error) {
      console.error("Settings load error:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [reset, settingsAPI]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: SettingsForm) => {
    setSaving(true);
    try {
      await settingsAPI.updateSettings({
        ...data,
        logoUrl,
      });
      toast.success("Settings saved");
    } catch (error) {
      console.error("Settings save error:", error);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `settings/logo-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLogoUrl(url);
      toast.success("Logo uploaded — save settings to apply");
    } catch {
      toast.error("Logo upload failed");
    }
  };

  if (loading) {
    return (
      <DashboardShell title="Settings">
        <p className="text-slate-500">Loading...</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Shop Settings">
      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Shop Name</label>
            <input {...register("shopName", { required: true })} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Address</label>
            <textarea
              {...register("address", { required: true })}
              rows={2}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Contact Number
            </label>
            <input
              {...register("contactNumber", { required: true })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Logo</label>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Shop logo"
                className="mb-2 h-16 w-auto rounded"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="input-field py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Receipt Footer Message
            </label>
            <textarea
              {...register("receiptFooter")}
              rows={2}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Low Stock Threshold
            </label>
            <input
              type="number"
              min={1}
              {...register("lowStockThreshold", {
                required: true,
                valueAsNumber: true,
              })}
              className="input-field w-32"
            />
            <p className="mt-1 text-xs text-slate-500">
              Products at or below this quantity trigger low stock alerts
            </p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
