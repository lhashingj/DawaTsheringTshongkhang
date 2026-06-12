import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const metadata: Metadata = {
  title: "Admin Dashboard | DTT Hardware",
  robots: "noindex,nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
