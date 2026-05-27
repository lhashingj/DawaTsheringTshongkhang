"use client";

import { motion } from "framer-motion";
import {
  MapPin, Phone, Clock, Award, Calendar, Shield,
  FileText, Wrench, ChevronRight, Mail, Building2, Globe,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>

        {/* Hero — dark bg extends behind transparent fixed header */}
        <section className="industrial-grid-bg pt-36 md:pt-44 pb-20 md:pb-28">
          <div className="container">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
              className="max-w-3xl"
            >
              <motion.p
                variants={fadeUp}
                className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-3"
              >
                Est. 2012 · Paro, Bhutan
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="text-4xl md:text-5xl font-black text-white leading-tight mb-4"
              >
                About{" "}
                <span className="text-gradient">Dawa Tshering</span>
                <br />Tshongkhang
              </motion.h1>
              <motion.p
                variants={fadeUp}
                className="text-white/60 text-lg leading-relaxed"
              >
                From a small hardware venture to Paro&apos;s trusted name in tools,
                machinery, and safety equipment — serving professionals and
                families since 2012.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Browse Products <ChevronRight className="h-4 w-4" />
                </Link>
                <a
                  href="tel:+97517716895"
                  className="inline-flex items-center gap-2 border border-white/20 hover:border-brand-orange text-white/80 hover:text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  <Phone className="h-4 w-4" /> Call Us
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-16 md:py-20 bg-slate-900">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              >
                <motion.p variants={fadeUp} className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-2">
                  Our Story
                </motion.p>
                <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
                  Over a decade of trust
                </motion.h2>
                <motion.p variants={fadeUp} className="text-slate-400 leading-relaxed mb-4">
                  Dawa Tshering Tshongkhang was founded in 2012 as <strong className="text-white">JLW Enterprise</strong>,
                  a small hardware outlet serving the local community of Nyamaizampa, Paro.
                  Over the years the business grew in scope and reputation, and was rebranded
                  to <strong className="text-white">Dawa Tshering Tshongkhang</strong> —
                  a name chosen to be more accessible and memorable for every customer,
                  regardless of background.
                </motion.p>
                <motion.p variants={fadeUp} className="text-slate-400 leading-relaxed">
                  Today we stock a wide range of power tools, agricultural machinery,
                  hand tools, safety equipment, irrigation systems, welding supplies,
                  and garden equipment — all at fair prices with knowledgeable service.
                </motion.p>
              </motion.div>

              {/* Timeline */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
                className="space-y-4"
              >
                {[
                  { year: "2012", label: "Founded as JLW Enterprise — TPN effective 13 Nov 2012", icon: Calendar },
                  { year: "2015", label: "Expanded product range to agricultural machinery", icon: Wrench },
                  { year: "2025", label: "Rebranded to Dawa Tshering Tshongkhang", icon: Award },
                  { year: "2026", label: "GST registered — certified agent No. P10037232 (effective 1 Jan 2026)", icon: Shield },
                  { year: "Now", label: "90+ products, trusted across Paro & beyond", icon: Award },
                ].map((item) => (
                  <motion.div
                    key={item.year}
                    variants={fadeUp}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-brand-orange" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-brand-orange uppercase tracking-wider">{item.year}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{item.label}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Government Supply & Tenders */}
        <section className="py-16 md:py-20 bg-brand-slate">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="text-center mb-12"
            >
              <motion.p variants={fadeUp} className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-2">
                Bulk & Institutional Supply
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
                Government Supply &amp; Tenders
              </motion.h2>
              <motion.p variants={fadeUp} className="text-white/50 text-lg max-w-2xl mx-auto">
                We supply hardware, tools, machinery, and safety equipment in bulk
                to government agencies, contractors, and institutions across Bhutan.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="grid sm:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: Building2,
                  title: "Government Tenders",
                  desc: "Experienced in government procurement processes. We participate in and fulfil tenders for tools, equipment, and machinery.",
                },
                {
                  icon: Globe,
                  title: "All 20 Dzongkhags",
                  desc: "We can supply to all 20 Dzongkhags across Bhutan. Nationwide reach backed by reliable logistics and quality products.",
                },
                {
                  icon: Award,
                  title: "Bulk Orders",
                  desc: "Special pricing for bulk and institutional orders. Contact us to discuss your requirements and get a competitive quote.",
                },
              ].map((item) => (
                <motion.div
                  key={item.title}
                  variants={fadeUp}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-orange/20 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-brand-orange" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-black text-white text-lg mb-2">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a
                href="mailto:tsheringdemajlw@gmail.com"
                className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email for Bulk / Tender Enquiries
              </a>
              <a
                href="tel:+97517716895"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-brand-orange text-white/80 hover:text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call: 17716895 / 17711469
              </a>
            </motion.div>
          </div>
        </section>

        {/* Registration & Compliance */}
        <section className="py-16 bg-slate-900 border-y border-slate-700/60">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="text-center mb-10"
            >
              <motion.p variants={fadeUp} className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-2">
                Legal & Compliance
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Registered &amp; Certified
              </motion.h2>
              <motion.p variants={fadeUp} className="text-slate-400 text-base mt-3 max-w-2xl leading-relaxed mx-auto">
                Dawa Tshering Tshongkhang is a fully registered business operating
                under all applicable Bhutanese trade and tax regulations.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto"
            >
              {[
                {
                  icon: Shield,
                  label: "GST Certified Agent",
                  value: "No. P10037232",
                  desc: "Effective 1 January 2026",
                },
                {
                  icon: FileText,
                  label: "Taxpayer Number",
                  value: "TPN: JAB09739",
                  desc: "Effective 13 November 2012",
                },
                {
                  icon: Award,
                  label: "Trade Licence",
                  value: "LIC No. R1005542",
                  desc: "Authorised to trade",
                },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  variants={fadeUp}
                  className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-brand-orange" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{item.label}</p>
                  <p className="text-lg font-black text-white">{item.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Contact & Map */}
        <section className="py-16 md:py-20 bg-slate-900">
          <div className="container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              className="text-center mb-10"
            >
              <motion.p variants={fadeUp} className="text-brand-orange font-bold text-sm uppercase tracking-widest mb-2">
                Visit Us
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Find Our Shop
              </motion.h2>
              <motion.p variants={fadeUp} className="text-slate-400 text-base mt-3 max-w-2xl leading-relaxed mx-auto">
                We&apos;re located at Nyamaizampa, Paro, Bhutan. Come visit us or give us a call.
              </motion.p>
            </motion.div>

            <div className="grid md:grid-cols-5 gap-8 items-start">
              {/* Contact details */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                className="md:col-span-2 space-y-4"
              >
                {[
                  {
                    icon: MapPin,
                    label: "Address",
                    content: "Nyamaizampa, Paro\nBhutan",
                  },
                  {
                    icon: Phone,
                    label: "Phone",
                    content: "17716895 / 17711469",
                    href: "tel:+97517716895",
                  },
                  {
                    icon: Mail,
                    label: "Email",
                    content: "tsheringdemajlw@gmail.com",
                    href: "mailto:tsheringdemajlw@gmail.com",
                  },
                  {
                    icon: Clock,
                    label: "Business Hours",
                    content: "Monday – Sunday\n9:00 AM – 7:00 PM",
                  },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    variants={fadeUp}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-brand-orange" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="text-sm font-semibold text-white hover:text-brand-orange transition-colors break-all">
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-white whitespace-pre-line">{item.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}

                <motion.div variants={fadeUp} className="flex flex-col gap-2 mt-2">
                  <a
                    href="tel:+97517716895"
                    className="flex items-center justify-center gap-2 w-full bg-brand-orange hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call: 17716895
                  </a>
                  <a
                    href="tel:+97517711469"
                    className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call: 17711469
                  </a>
                </motion.div>
              </motion.div>

              {/* Google Maps embed */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="md:col-span-3 rounded-2xl overflow-hidden border border-slate-700"
              >
                <iframe
                  title="DTT Hardware Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3541.544518161304!2d89.41759268073797!3d27.421136015362194!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39e19d001f3ee1c1%3A0xb97b5314e22d6a91!2sDawa%20Tshering%20Shop!5e0!3m2!1sen!2sus!4v1778399852642!5m2!1sen!2sus"
                  width="100%"
                  height="400"
                  style={{ border: 0, display: "block" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </motion.div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
