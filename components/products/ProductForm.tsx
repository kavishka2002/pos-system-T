"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { Product } from "@/types";
import { DEFAULT_CATEGORIES } from "@/lib/utils";
import { calcProfitPerItem } from "@/lib/utils";

export interface ProductFormValues {
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  specialPrice?: number;
  stockQuantity: number;
  barcode?: string;
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (values: ProductFormValues, imageFile?: File) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ProductForm({
  product,
  onSubmit,
  onCancel,
  loading,
}: ProductFormProps) {
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    defaultValues: product
      ? {
          name: product.name,
          category: product.category,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          specialPrice: product.specialPrice,
          stockQuantity: product.stockQuantity,
          barcode: product.barcode,
        }
      : {
          name: "",
          category: DEFAULT_CATEGORIES[0],
          costPrice: 0,
          sellingPrice: 0,
          stockQuantity: 0,
        },
  });

  const cost = watch("costPrice") || 0;
  const sell = watch("sellingPrice") || 0;
  const profit = calcProfitPerItem(sell, cost);

  const stopScanner = () => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const handleDetectedBarcode = (code: string) => {
    const normalized = code.trim();
    if (!normalized) return;
    setDetectedBarcode(normalized);
    setValue("barcode", normalized);
    stopScanner();
  };

  const openScanner = async () => {
    setCameraError(null);
    setDetectedBarcode(null);

    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setCameraError(
        "Camera barcode scanning is not supported by this browser. Please enter the barcode manually."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      barcodeDetectorRef.current = new BarcodeDetectorCtor({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "code_93", "upc_a", "upc_e", "qr_code"],
      });
      setScanning(true);
    } catch (err) {
      console.error(err);
      setCameraError(
        "Unable to access the camera. Please allow camera permission or use manual barcode entry."
      );
    }
  };

  useEffect(() => {
    if (!scanning || !barcodeDetectorRef.current || !videoRef.current) return;

    let active = true;

    const scanFrame = async () => {
      if (!active || !videoRef.current) return;
      try {
        const results = await barcodeDetectorRef.current.detect(videoRef.current);
        if (results.length > 0) {
          const code = results[0].rawValue;
          if (code) {
            handleDetectedBarcode(code);
            return;
          }
        }
      } catch (err) {
        console.error("Barcode scan failed:", err);
        setCameraError("Barcode scan failed. Please try again or enter the code manually.");
      }

      scanRafRef.current = requestAnimationFrame(scanFrame);
    };

    scanFrame();

    return () => {
      active = false;
      if (scanRafRef.current) {
        cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
    };
  }, [scanning]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(v, imageFile))}
      className="space-y-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Product Name *
        </label>
        <input
          {...register("name", { required: "Required" })}
          className="input-field"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Category *</label>
          <select {...register("category")} className="input-field">
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Barcode (optional)
          </label>
          <div className="flex gap-2">
            <input
              {...register("barcode")}
              className="input-field min-w-0"
              placeholder="Scan or type barcode"
            />
            <button
              type="button"
              onClick={openScanner}
              className="btn-secondary whitespace-nowrap"
            >
              Scan
            </button>
          </div>
          {detectedBarcode && (
            <p className="mt-1 text-sm text-slate-600">
              Detected barcode: {detectedBarcode}
            </p>
          )}
          {cameraError && (
            <p className="mt-1 text-sm text-red-500">{cameraError}</p>
          )}
          {scanning && (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Camera scanning...</p>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="btn-secondary text-xs px-2 py-1"
                >
                  Stop
                </button>
              </div>
              <video
                ref={videoRef}
                className="h-60 w-full rounded bg-black object-cover"
              />
              <p className="text-xs text-slate-500">
                Point your camera at the barcode. Scanning will auto-fill the barcode field.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Cost Price *</label>
          <input
            type="number"
            step="0.01"
            {...register("costPrice", {
              required: true,
              valueAsNumber: true,
              min: 0,
            })}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Selling Price *
          </label>
          <input
            type="number"
            step="0.01"
            {...register("sellingPrice", {
              required: true,
              valueAsNumber: true,
              min: 0,
            })}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Special Price
          </label>
          <input
            type="number"
            step="0.01"
            {...register("specialPrice", { valueAsNumber: true })}
            className="input-field"
            placeholder="Optional"
          />
        </div>
      </div>
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        Profit per item: Rs. {profit.toFixed(2)}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Stock *</label>
          <input
            type="number"
            {...register("stockQuantity", {
              required: true,
              valueAsNumber: true,
              min: 0,
            })}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Image (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0])}
            className="input-field py-2"
          />
          {product?.imageUrl && !imageFile && (
            <img
              src={product.imageUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded object-cover"
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : product ? "Update" : "Add Product"}
        </button>
      </div>
    </form>
  );
}
