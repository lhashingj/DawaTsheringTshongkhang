export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  description: string;
  featured: boolean;
  unit: string;
  sku: string;
  image?: string;
}

export type ProductCategory =
  | "Power Tools"
  | "Agricultural Machinery"
  | "Hand Tools"
  | "Safety Equipment"
  | "Irrigation & Water"
  | "Spare Parts"
  | "Garden & Landscaping"
  | "Welding Equipment"
  | "Measuring Tools";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

export interface Database {
  products: Product[];
}
