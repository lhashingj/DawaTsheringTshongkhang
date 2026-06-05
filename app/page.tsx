import { getAllProducts } from "@/lib/products";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategorySection } from "@/components/home/CategorySection";
import { StatsSection } from "@/components/home/StatsSection";

export const revalidate = 60;

export default async function HomePage() {
  const products = await getAllProducts();

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <BentoGrid products={products} />
        <CategorySection />
      </main>
      <Footer />
    </>
  );
}
