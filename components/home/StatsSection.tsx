"use client";

import { motion } from "framer-motion";
import {
  CalendarCheck, Globe, Building2, ShieldCheck,
  Hammer, Sprout,
} from "lucide-react";

const WHY_US = [
  {
    icon: CalendarCheck,
    value: "Est. 2012",
    label: "Over 13 Years of Service",
    desc: "Trusted by builders, farmers, and craftsmen in Paro since 2012 — formerly known as JLW Enterprise.",
    color: "text-brand-orange",
    bg: "bg-brand-orange/10",
  },
  {
    icon: Globe,
    value: "20 Dzongkhags",
    label: "Nationwide Supply",
    desc: "We supply hardware and machinery to all 20 Dzongkhags across Bhutan — for individuals and institutions alike.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Building2,
    value: "Gov. Tenders",
    label: "Government & Bulk Supply",
    desc: "GST certified supplier with experience in government tenders and large-scale bulk procurement.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: ShieldCheck,
    value: "GST Certified",
    label: "Registered & Compliant",
    desc: "Fully licensed business — GST Agent No. P10037232, TPN: JAB09739, LIC No. R1005542.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Hammer,
    value: "90+ Products",
    label: "Wide Range of Hardware",
    desc: "Power tools, hand tools, welding equipment, safety gear, measuring tools and spare parts — all under one roof.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Sprout,
    value: "Agri & Irrigation",
    label: "Farm & Garden Ready",
    desc: "Agricultural machinery, irrigation systems, and garden equipment to support Bhutan's farming community.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
];

export function StatsSection() {
  return (
    <section className="bg-brand-slate py-16 md:py-20 border-y border-white/5">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-2">
            Why Choose Us
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Bhutan&apos;s Trusted Hardware Partner
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {WHY_US.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 hover:bg-white/8 transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                <item.icon className={`h-5 w-5 ${item.color}`} strokeWidth={1.5} />
              </div>
              <div>
                <p className={`text-sm font-black uppercase tracking-wider ${item.color} mb-0.5`}>
                  {item.value}
                </p>
                <p className="text-white font-bold text-base leading-tight mb-1">
                  {item.label}
                </p>
                <p className="text-white/40 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
