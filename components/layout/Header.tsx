"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Menu, X, Phone, MapPin, Mail, LogIn, LogOut, UserCircle, User, LayoutDashboard,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/#categories", label: "Categories" },
  { href: "/about", label: "About" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-brand-slate/95 backdrop-blur-md shadow-xl shadow-black/20"
            : "bg-transparent"
        )}
      >
        {/* Top bar */}
        <div className="hidden md:block bg-brand-blue/20 border-b border-brand-blue/30">
          <div className="container flex items-center justify-between py-1.5 text-xs text-white/60">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Nyamaizampa, Paro, Bhutan
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                17716895 / 17711469
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                tsheringdemajlw@gmail.com
              </span>
            </div>
            <span className="font-medium text-white/40 tracking-wider uppercase text-[10px]">
              Professional Hardware & Tools
            </span>
          </div>
        </div>

        {/* Main nav */}
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg group-hover:scale-105 transition-transform shrink-0 bg-white">
              <Image src="/logo.png" width={36} height={36} alt="DTT Logo" className="w-full h-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white font-black text-sm leading-none tracking-tight">
                DTT Hardware
              </p>
              <p className="text-white/40 text-[10px] font-medium tracking-wider">
                PARO, BHUTAN
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative hidden md:block">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <UserCircle className="h-4 w-4" />
                  <span className="text-xs max-w-[160px] truncate">{user.user_metadata?.name ?? user.email}</span>
                </Button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-10 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
                      >
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-orange transition-colors"
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </Link>
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-orange transition-colors border-t border-slate-50"
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            Admin Dashboard
                          </Link>
                        )}
                        <button
                          onClick={() => { signOut(); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-500 transition-colors border-t border-slate-50 cursor-pointer"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10">
                  <LogIn className="h-4 w-4" />
                  <span className="text-xs">Sign In</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-white hover:bg-white/10 hover:text-white"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart (${totalItems} items)`}
            >
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center shadow"
                  >
                    {totalItems > 9 ? "9+" : totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden bg-brand-slate border-t border-white/10 md:hidden"
            >
              <nav className="container py-4 flex flex-col gap-1">
                {NAV_LINKS.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-sm font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3 px-4">
                  <Phone className="h-4 w-4 text-brand-orange" />
                  <span className="text-sm text-white/60 font-medium">17716895</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 px-4">
                  {user ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-1 pb-2">
                        <UserCircle className="h-4 w-4 text-brand-orange shrink-0" />
                        <span className="text-sm text-white/70 font-medium truncate max-w-[180px]">
                          {user.user_metadata?.name ?? user.email}
                        </span>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <User className="h-4 w-4" />
                        My Profile
                      </Link>
                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={() => { signOut(); setMobileOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full gap-2 cursor-pointer" size="sm">
                        <LogIn className="h-4 w-4" />
                        Sign In
                      </Button>
                    </Link>
                  )}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
