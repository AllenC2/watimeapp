'use client';

import { Calendar, History, Settings, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WhatsAppStatusPill from './WhatsAppStatusPill';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        <MessageCircle size={22} color="#25D366" />
        WP Dashboard
      </Link>
      <nav>
        <Link href="/" className={pathname === '/' ? 'active' : ''}>
          <Calendar size={16} />
          <span>Agenda</span>
        </Link>
        <Link href="/programar" className={pathname === '/programar' ? 'active' : ''}>
          <History size={16} />
          <span>Programar</span>
        </Link>
        <a href="#">
          <Settings size={16} />
          <span>Configuración</span>
        </a>
      </nav>
      <WhatsAppStatusPill />
    </header>
  );
}
