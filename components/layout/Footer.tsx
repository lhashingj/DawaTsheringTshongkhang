import Link from "next/link";
import { Wrench, Phone, MapPin, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-brand-slate text-white">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-brand-orange flex items-center justify-center">
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
            <h4 className="font-bold text-sm uppercase tracking-wider text-white/40 mb-5">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Home" },
                { href: "/products", label: "All Products" },
                { href: "#categories", label: "Categories" },
                { href: "/about", label: "About Us" },
                { href: "/admin", label: "Admin Dashboard" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-brand-orange transition-colors text-sm font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-white/40 mb-5">
              Contact Us
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-brand-orange shrink-0 mt-0.5" />
                <span className="text-white/60 text-sm">
                  Nyamaizampa, Paro<br />Bhutan
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-brand-orange shrink-0 mt-0.5" />
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
                <Mail className="h-4 w-4 text-brand-orange shrink-0" />
                <a href="mailto:tsheringdemajlw@gmail.com" className="text-white/60 hover:text-white text-sm transition-colors break-all">
                  tsheringdemajlw@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-brand-orange shrink-0" />
                <span className="text-white/60 text-sm">Mon–Sun: 9:00 AM – 7:00 PM</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Dawa Tshering Tshongkhang. All rights reserved.
          </p>
          <p className="text-white/20 text-xs">Built with Next.js 14</p>
        </div>
      </div>
    </footer>
  );
}
