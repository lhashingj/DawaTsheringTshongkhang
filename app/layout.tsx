import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Dawa Tshering Tshongkhang | Hardware & Tools",
  description:
    "Your trusted supplier for power tools, agricultural machinery, hand tools, safety equipment, and irrigation systems in Paro, Bhutan.",
  keywords: "hardware, tools, Paro, Bhutan, agricultural machinery, power tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            {children}
            <ChatWidget />
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
