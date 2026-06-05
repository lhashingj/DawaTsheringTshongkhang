"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Phone, MapPin, ShieldCheck, Truck, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Quality Assured", sub: "All major brands" },
  { icon: Truck, label: "Same-Day Available", sub: "In-store pickup, Paro" },
  { icon: Wrench, label: "Expert Advice", sub: "Est. 2012, Paro" },
];


export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] flex flex-col justify-center industrial-grid-bg overflow-hidden">
      {/* Gradient fade to next section */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-brand-slate pointer-events-none" />
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-orange/6 rounded-full blur-3xl pointer-events-none" />


      <div className="container relative z-10 pt-28 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
              Nyamaizampa, Paro, Bhutan
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Dawa Tshering{" "}
            <span className="relative inline-block">
              <span className="text-gradient">Tshongkhang</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-brand-orange origin-left"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
          >
            Professional hardware, power tools, agricultural machinery, and safety
            equipment. Serving Bhutan&apos;s farmers, builders, and craftsmen since day one.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            <Button asChild size="lg" className="gap-2 shadow-2xl shadow-orange-500/30 cursor-pointer">
              <Link href="/products">
                Browse All Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white gap-2 cursor-pointer"
            >
              <a href="tel:+97517716895">
                <Phone className="h-4 w-4" />
                Call: 17716895
              </a>
            </Button>
          </motion.div>

          {/* Location badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 flex items-center justify-center gap-2 text-white/50 text-sm"
          >
            <MapPin className="h-3.5 w-3.5 text-brand-orange" />
            <span>Nyamaizampa, Paro · Ph. 17716895</span>
          </motion.div>
        </div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
        >
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 backdrop-blur-sm px-4 py-4 hover:bg-white/10 transition-colors duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-orange/20 flex items-center justify-center shrink-0 ring-1 ring-brand-orange/10">
                <item.icon className="h-5 w-5 text-brand-orange" strokeWidth={2} />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">{item.label}</p>
                <p className="text-white/55 text-xs mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <span className="text-white/30 text-xs tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-0.5 h-6 bg-gradient-to-b from-brand-orange to-transparent rounded-full"
        />
      </motion.div>
    </section>
  );
}
