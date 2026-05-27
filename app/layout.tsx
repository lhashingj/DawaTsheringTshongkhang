import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dawatsheringshop.com"),
  title: "Dawa Tshering Tshongkhang | Hardware & Tools",
  description:
    "Your trusted supplier for power tools, agricultural machinery, hand tools, safety equipment, and irrigation systems in Paro, Bhutan.",
  keywords: "hardware, tools, Paro, Bhutan, agricultural machinery, power tools",
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body>
        <AuthProvider>
          <CartProvider>
            {children}
            <ChatWidgetLoader />
            <WhatsAppButton />
            <Toaster />
            <SpeedInsights />
            <Analytics />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
