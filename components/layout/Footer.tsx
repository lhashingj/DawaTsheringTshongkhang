import Link from "next/link";
import { Wrench, Phone, MapPin, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-brand-slate text-white">
      {/* Signboard-inspired banner */}
      <div className="bg-brand-blue border-b-2 border-brand-gold/50 relative overflow-hidden">
        {/* Subtle grid overlay matching the physical signboard */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="container py-5 text-center relative z-10">
          {/* Gold corner accents */}
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-brand-gold/60" />
            <span className="text-brand-gold text-xs font-bold tracking-[0.3em] uppercase">Est. 2012</span>
            <span className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-brand-gold/60" />
          </div>
          <p className="text-white font-black text-xl sm:text-2xl tracking-widest uppercase leading-tight">
            Dawa Tshering Tshongkhang
          </p>
          <p className="text-brand-gold/90 text-xs font-semibold tracking-[0.25em] uppercase mt-1">
            Nyamaizampa, Paro · Bhutan · Ph. 17716895
          </p>
        </div>
      </div>

      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-brand-blue flex items-center justify-center ring-1 ring-brand-gold/30">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-black text-base leading-none">DTT Hardware</p>
                <p className="text-white/40 text-xs mt-0.5">Dawa Tshering Tshongkhang</p>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Your trusted supplier for power tools, agricultural machinery, hand tools,
              safety equipment, and irrigation systems in Paro, Bhutan.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-brand-gold/70 mb-5">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Home" },
                { href: "/products", label: "All Products" },
                { href: "#categories", label: "Categories" },
                { href: "/about", label: "About Us" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-brand-gold transition-colors text-sm font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-brand-gold/70 mb-5">
              Contact Us
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-brand-blue-light shrink-0 mt-0.5" style={{ color: "#4a90d9" }} />
                <span className="text-white/60 text-sm">
                  Nyamaizampa, Paro<br />Bhutan
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#4a90d9" }} />
                <div className="flex flex-col gap-0.5">
                  <a href="tel:+97517716895" className="text-white/60 hover:text-white text-sm transition-colors">
                    17716895
                  </a>
                  <a href="tel:+97517711469" className="text-white/60 hover:text-white text-sm transition-colors">
                    17711469
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0" style={{ color: "#4a90d9" }} />
                <a href="mailto:tsheringdemajlw@gmail.com" className="text-white/60 hover:text-white text-sm transition-colors break-all">
                  tsheringdemajlw@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0" style={{ color: "#4a90d9" }} />
                <span className="text-white/60 text-sm">Mon–Sun: 9:00 AM – 7:00 PM</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-blue/30">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Dawa Tshering Tshongkhang. All rights reserved.
          </p>
          <p className="text-white/20 text-xs">Built with Next.js</p>
        </div>
      </div>
    </footer>
  );
}
