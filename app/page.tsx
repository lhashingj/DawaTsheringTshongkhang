import { getAllProducts } from "@/lib/products";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategorySection } from "@/components/home/CategorySection";
import { StatsSection } from "@/components/home/StatsSection";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const products = getAllProducts();

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
