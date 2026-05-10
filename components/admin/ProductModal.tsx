"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Product, ProductCategory } from "@/types";

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
};

export function ProductModal({ open, onClose, product, onSaved }: ProductModalProps) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
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
      });
    } else {
      setForm(BLANK);
    }
  }, [product, open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const saved: Product = await res.json();
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
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value as ProductCategory)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
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
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="rounded accent-brand-orange w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">
              Feature on homepage
            </span>
          </label>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
