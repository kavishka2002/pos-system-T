"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, ProductFormValues } from "@/components/products/ProductForm";
import { useProductAPI } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";
import toast from "react-hot-toast";

export default function ProductsPage() {
  const productAPI = useProductAPI();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await productAPI.getProducts());
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [productAPI]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode?.includes(q)
    );
  }, [products, search]);

  const handleSubmit = async (values: ProductFormValues, imageFile?: File) => {
    setSaving(true);
    try {
      if (editing) {
        // Update existing product
        await productAPI.updateProduct(editing.id, values);
        if (imageFile) {
          await productAPI.uploadProductImage(editing.id, imageFile);
        }
        toast.success("Product updated");
      } else {
        // Create new product
        const result = await productAPI.createProduct(values, imageFile);
        toast.success("Product added");
      }
      setModalOpen(false);
      setEditing(undefined);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      await productAPI.deleteProduct(product.id);
      toast.success("Deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <DashboardShell title="Products">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="input-field pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Sell</th>
                  <th className="px-4 py-3 text-right font-medium">Special</th>
                  <th className="px-4 py-3 text-right font-medium">Profit</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No products
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{p.name}</p>
                            {p.barcode && (
                              <p className="text-xs text-slate-500">{p.barcode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(p.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(p.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.specialPrice
                          ? formatCurrency(p.specialPrice)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {formatCurrency(p.profitPerItem)}
                      </td>
                      <td className="px-4 py-3 text-right">{p.stockQuantity}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(p);
                              setModalOpen(true);
                            }}
                            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        title={editing ? "Edit Product" : "Add Product"}
        size="lg"
      >
        <ProductForm
          product={editing}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditing(undefined);
          }}
          loading={saving}
        />
      </Modal>
    </DashboardShell>
  );
}
