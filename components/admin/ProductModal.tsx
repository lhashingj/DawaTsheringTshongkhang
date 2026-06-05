"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, X, ImageIcon } from "lucide-react";
import { db, inventoryCRUD } from "@/lib/accounting-db";
import type { UnitType } from "@/lib/accounting-db";
import type { Product, ProductCategory } from "@/types";

function mapUnit(unit: string): UnitType {
  switch (unit.toLowerCase()) {
    case "set": return "SET";
    case "metre": case "meter": return "MTR";
    case "litre": case "liter": return "LTR";
    case "kg": case "kilogram": return "KG";
    case "box": return "BOX";
    case "pair": return "PAIR";
    default: return "EACH";
  }
}

const CATEGORIES: ProductCategory[] = [
  "Power Tools",
  "Agricultural Machinery",
  "Hand Tools",
  "Safety Equipment",
  "Irrigation & Water",
  "Spare Parts",
  "Garden & Landscaping",
  "Welding Equipment",
  "Measuring Tools",
];

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved: (product: Product) => void;
}

type FormState = {
  name: string;
  category: ProductCategory;
  price: string;
  stock: string;
  description: string;
  unit: string;
  sku: string;
  featured: boolean;
  image: string;
};

const BLANK: FormState = {
  name: "",
  category: "Hand Tools",
  price: "",
  stock: "",
  description: "",
  unit: "piece",
  sku: "",
  featured: false,
  image: "",
};

export function ProductModal({ open, onClose, product, onSaved }: ProductModalProps) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const isEdit = Boolean(product);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        price: String(product.price),
        stock: String(product.stock),
        description: product.description,
        unit: product.unit,
        sku: product.sku,
        featured: product.featured,
        image: product.image ?? "",
      });
    } else {
      setForm(BLANK);
    }
  }, [product, open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: data });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      set("image", url);
      toast({ title: "Image uploaded!", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      setFileKey((k) => k + 1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price || !form.stock) {
      toast({ title: "Name, price, and stock are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          price: Number(form.price),
          stock: Number(form.stock),
          description: form.description,
          unit: form.unit,
          sku: form.sku || form.name.replace(/\s+/g, "-").toUpperCase().slice(0, 20),
          featured: form.featured,
          image: form.image || null,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const saved: Product = await res.json();
      // Sync to accounting inventory
      try {
        const invItem = await db.inventory.filter(i => i.itemCode === saved.sku).first();
        if (!isEdit) {
          if (!invItem) {
            await inventoryCRUD.create({
              itemCode: saved.sku,
              description: saved.name,
              unit: mapUnit(saved.unit),
              baseRate: saved.price,
              stockQty: saved.stock,
              reorderLevel: 5,
              lastUpdated: new Date(),
              notes: saved.category,
            });
          }
        } else if (invItem?.id) {
          await inventoryCRUD.update(invItem.id, {
            description: saved.name,
            unit: mapUnit(saved.unit),
            baseRate: saved.price,
            stockQty: saved.stock,
            lastUpdated: new Date(),
            notes: saved.category,
          });
        }
      } catch { /* best-effort */ }
      onSaved(saved);
      toast({
        title: isEdit ? "Product updated!" : "Product created!",
        description: saved.name,
        variant: "success",
      });
      onClose();
    } catch {
      toast({ title: "Failed to save product.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Editing: ${product?.name}` : "Fill in the details for the new product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Angle Grinder 750W"
              className="h-11"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value as ProductCategory)}
                className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="piece, pair, set…"
                className="h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Nu.) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock">Stock *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                placeholder="0"
                className="h-11"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Auto-generated if blank"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
              placeholder="Brief product description…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Product Image</Label>
            {form.image && (
              <div className="relative w-full h-36 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                <img src={form.image} alt="Preview" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => set("image", "")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!form.image && (
              <div className="w-full h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-400">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">No image set</span>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="Paste image URL…"
                className="h-11 flex-1 text-sm"
              />
              <label
                htmlFor="product-image-upload"
                aria-disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 h-11 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors aria-disabled:opacity-50 aria-disabled:pointer-events-none whitespace-nowrap select-none"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
              </label>
              <input
                key={fileKey}
                id="product-image-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={handleImageUpload}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="rounded accent-brand-orange w-5 h-5 shrink-0"
            />
            <span className="text-sm font-medium text-slate-700">
              Feature on homepage
            </span>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-11">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
