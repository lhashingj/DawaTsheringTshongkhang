'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, BookOpen, BarChart3, ArrowLeft, Wallet } from 'lucide-react';
import { BackupButton } from './BackupButton';

const navItems = [
  { href: '/admin/accounting',         label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/admin/accounting/pos',     label: 'Point of Sale',   icon: ShoppingCart    },
  { href: '/admin/accounting/ledgers', label: 'Ledgers',         icon: BookOpen        },
  { href: '/admin/accounting/cash',    label: 'Cash & Returns',  icon: Wallet          },
  { href: '/admin/accounting/reports', label: 'Reports & Export', icon: BarChart3      },
];

export function AccountingNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-0 overflow-x-auto no-scrollbar w-full">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 py-4 px-3 text-slate-400 hover:text-white text-sm whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin
          </Link>
          <div className="w-px h-6 bg-slate-700 mx-1 shrink-0" />
          <span className="text-orange-400 font-semibold text-sm px-3 py-4 whitespace-nowrap shrink-0">
            Accounting
          </span>
          <div className="w-px h-6 bg-slate-700 mx-1 shrink-0" />
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 py-4 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                pathname === href
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          <div className="ml-auto shrink-0 py-2 pr-1">
            <BackupButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
