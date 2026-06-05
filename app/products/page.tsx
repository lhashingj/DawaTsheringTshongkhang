import { getAllProducts } from "@/lib/products";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductsClient } from "@/components/products/ProductsClient";

export const revalidate = 60;

export default async function ProductsPage() {
  const products = await getAllProducts();

  return (
    <>
      <Header />
      <ProductsClient products={products} />
      <Footer />
    </>
  );
}
