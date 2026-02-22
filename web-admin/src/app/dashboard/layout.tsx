"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/toast";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  Fingerprint,
  ChevronRight,
  Bell,
  Search,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { name: "Karyawan", href: "/dashboard/karyawan", icon: Users },
  { name: "Kehadiran", href: "/dashboard/kehadiran", icon: Clock },
  { name: "Cuti & Izin", href: "/dashboard/cuti", icon: CalendarDays },
  { name: "Pengaturan", href: "/dashboard/pengaturan", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const currentPage = navigation.find((n) =>
    n.exact ? pathname === n.href : pathname.startsWith(n.href),
  );

  return (
    <ToastProvider>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

        :root {
          --sidebar-w: 256px;
          /* Navy palette */
          --navy-900: #060C1A;
          --navy-800: #0C1428;
          --navy-700: #111C35;
          --navy-600: #172240;
          --navy-500: #1E2D52;
          --navy-border: rgba(255,255,255,0.055);
          --navy-border-2: rgba(255,255,255,0.09);
          /* Blue accent */
          --blue-500: #2563EB;
          --blue-400: #3B82F6;
          --blue-300: #60A5FA;
          --blue-glow: rgba(59,130,246,0.18);
          /* Content area */
          --bg: #F4F6FA;
          --surface: #FFFFFF;
          --surface-2: #F8FAFC;
          --border: #E2E8F0;
          --border-2: #CBD5E1;
          /* Text */
          --text-1: #0F172A;
          --text-2: #475569;
          --text-3: #94A3B8;
          --text-inv: rgba(255,255,255,0.92);
          --text-inv-2: rgba(255,255,255,0.5);
          --text-inv-3: rgba(255,255,255,0.25);
          /* Status colors */
          --green: #16A34A; --green-bg: #F0FDF4; --green-border: #BBF7D0;
          --amber: #D97706; --amber-bg: #FFFBEB; --amber-border: #FDE68A;
          --red: #DC2626; --red-bg: #FEF2F2; --red-border: #FECACA;
          --purple: #7C3AED; --purple-bg: #F5F3FF; --purple-border: #DDD6FE;
          /* Shadows */
          --shadow-xs: 0 1px 2px rgba(15,23,42,0.06);
          --shadow-sm: 0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04);
          --shadow-md: 0 4px 6px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04);
          --shadow-lg: 0 10px 15px rgba(15,23,42,0.08), 0 4px 6px rgba(15,23,42,0.04);
          --shadow-xl: 0 20px 25px rgba(15,23,42,0.1), 0 8px 10px rgba(15,23,42,0.06);
          /* Radius */
          --r-xs: 4px; --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 18px;
          /* Transitions */
          --ease: cubic-bezier(0.4, 0, 0.2, 1);
          --ease-out: cubic-bezier(0, 0, 0.2, 1);
        }

        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--text-1); }
        code, pre, .mono { font-family: 'JetBrains Mono', monospace; }

        /* ═══════════════════════════════════════════════════════
           SIDEBAR
        ═══════════════════════════════════════════════════════ */
        .sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: var(--sidebar-w);
          background: var(--navy-800);
          border-right: 1px solid var(--navy-border);
          display: flex; flex-direction: column;
          z-index: 100;
          transform: translateX(-100%);
          transition: transform 0.24s var(--ease);
        }
        .sidebar.open, @media (min-width: 1024px) { .sidebar { transform: none; } }
        @media (min-width: 1024px) { .sidebar { transform: none; } }

        /* Sidebar subtle gradient */
        .sidebar::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 200px;
          background: linear-gradient(180deg, rgba(37,99,235,0.06) 0%, transparent 100%);
          pointer-events: none;
        }

        /* Logo */
        .sb-logo {
          display: flex; align-items: center; gap: 12px;
          padding: 22px 20px 18px;
          border-bottom: 1px solid var(--navy-border);
          position: relative;
        }
        .sb-logo-mark {
          width: 38px; height: 38px; border-radius: var(--r-md);
          background: linear-gradient(135deg, var(--blue-500), var(--blue-400));
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.3), 0 4px 12px rgba(37,99,235,0.35);
        }
        .sb-logo-text { flex: 1; }
        .sb-logo-primary {
          font-size: 13px; font-weight: 700; color: var(--text-inv);
          letter-spacing: 0.01em; line-height: 1.25;
        }
        .sb-logo-secondary {
          font-size: 10.5px; font-weight: 400; color: var(--text-inv-3);
          letter-spacing: 0.05em; text-transform: uppercase; margin-top: 1px;
        }
        .sb-close {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: rgba(255,255,255,0.06); border: none;
          color: var(--text-inv-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s var(--ease);
        }
        .sb-close:hover { background: rgba(255,255,255,0.1); }
        @media (min-width: 1024px) { .sb-close { display: none; } }

        /* Nav */
        .sb-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }

        .sb-section-label {
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--text-inv-3);
          padding: 10px 8px 6px; margin-top: 4px;
        }

        .sb-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: var(--r-md);
          font-size: 13.5px; font-weight: 500; color: var(--text-inv-2);
          text-decoration: none; cursor: pointer;
          transition: background 0.14s var(--ease), color 0.14s var(--ease);
          position: relative; overflow: hidden;
          border: 1px solid transparent;
        }
        .sb-item:hover {
          background: rgba(255,255,255,0.06);
          color: var(--text-inv);
        }
        .sb-item.active {
          background: rgba(59,130,246,0.15);
          color: var(--blue-300);
          border-color: rgba(59,130,246,0.15);
          font-weight: 600;
        }
        .sb-item.active::before {
          content: '';
          position: absolute; left: 0; top: 6px; bottom: 6px;
          width: 3px; border-radius: 0 3px 3px 0;
          background: var(--blue-400);
        }
        .sb-item svg { opacity: 0.7; flex-shrink: 0; width: 16px; height: 16px; }
        .sb-item.active svg { opacity: 1; }
        .sb-item-spacer { flex: 1; }
        .sb-chevron { width: 14px; height: 14px; opacity: 0.4; }

        /* Sidebar footer */
        .sb-footer { border-top: 1px solid var(--navy-border); padding: 12px; }
        .sb-footer-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--navy-border);
          border-radius: var(--r-md); padding: 12px 12px 10px;
          margin-bottom: 8px;
        }
        .sb-footer-label { font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-inv-3); margin-bottom: 4px; }
        .sb-footer-value { font-size: 12.5px; font-weight: 500; color: var(--text-inv-2); }
        .sb-logout {
          width: 100%; display: flex; align-items: center; gap: 9px;
          padding: 9px 10px; border-radius: var(--r-md);
          background: transparent; border: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13.5px; font-weight: 500; color: var(--text-inv-2);
          cursor: pointer; transition: background 0.14s, color 0.14s;
        }
        .sb-logout:hover { background: rgba(220,38,38,0.12); color: #FCA5A5; }
        .sb-logout svg { opacity: 0.7; width: 15px; height: 15px; }

        /* ═══════════════════════════════════════════════════════
           MAIN CONTENT
        ═══════════════════════════════════════════════════════ */
        .main-wrap {
          min-height: 100vh;
          background: var(--bg);
          transition: padding-left 0.24s var(--ease);
        }
        @media (min-width: 1024px) { .main-wrap { padding-left: var(--sidebar-w); } }

        /* Topbar */
        .topbar {
          position: sticky; top: 0; z-index: 90;
          display: flex; align-items: center; gap: 12px;
          padding: 0 24px; height: 60px;
          background: rgba(244,246,250,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        @media (min-width: 1024px) { .topbar { padding: 0 32px; } }

        .topbar-menu {
          width: 36px; height: 36px; border-radius: var(--r-md);
          background: var(--surface); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-2);
          box-shadow: var(--shadow-xs);
          transition: background 0.13s, border-color 0.13s;
        }
        .topbar-menu:hover { background: var(--surface-2); border-color: var(--border-2); }
        @media (min-width: 1024px) { .topbar-menu { display: none; } }

        .topbar-breadcrumb { display: flex; align-items: center; gap: 6px; }
        .topbar-brand {
          font-size: 12px; font-weight: 600;
          color: var(--text-3); letter-spacing: 0.02em;
          display: none;
        }
        @media (min-width: 640px) { .topbar-brand { display: block; } }
        .topbar-sep { color: var(--text-3); font-size: 12px; display: none; }
        @media (min-width: 640px) { .topbar-sep { display: block; } }
        .topbar-page { font-size: 13.5px; font-weight: 600; color: var(--text-1); }

        .topbar-spacer { flex: 1; }

        .topbar-actions { display: flex; align-items: center; gap: 8px; }

        .topbar-icon-btn {
          width: 36px; height: 36px; border-radius: var(--r-md);
          background: var(--surface); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-2);
          box-shadow: var(--shadow-xs);
          transition: background 0.13s, border-color 0.13s, color 0.13s;
        }
        .topbar-icon-btn:hover {
          background: var(--navy-700); border-color: transparent;
          color: white;
        }

        .topbar-avatar {
          width: 36px; height: 36px; border-radius: var(--r-md);
          background: linear-gradient(135deg, var(--blue-500), var(--blue-400));
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white;
          cursor: pointer;
          box-shadow: 0 0 0 2px white, 0 0 0 3px var(--blue-400);
        }

        /* Date badge */
        .topbar-date {
          display: none;
          font-size: 12px; font-weight: 500; color: var(--text-2);
          background: var(--surface); border: 1px solid var(--border);
          padding: 5px 12px; border-radius: 999px;
          box-shadow: var(--shadow-xs);
        }
        @media (min-width: 768px) { .topbar-date { display: flex; align-items: center; gap: 6px; } }

        /* Page content */
        .page-main { padding: 24px 20px; }
        @media (min-width: 768px) { .page-main { padding: 28px 24px; } }
        @media (min-width: 1280px) { .page-main { padding: 32px 36px; } }

        /* ═══════════════════════════════════════════════════════
           BACKDROP
        ═══════════════════════════════════════════════════════ */
        .backdrop {
          display: none; position: fixed; inset: 0;
          background: rgba(6,12,26,0.6);
          backdrop-filter: blur(2px);
          z-index: 90;
          animation: bdin 0.2s var(--ease);
        }
        .backdrop.show { display: block; }
        @media (min-width: 1024px) { .backdrop { display: none !important; } }
        @keyframes bdin { from { opacity: 0; } to { opacity: 1; } }

        /* ═══════════════════════════════════════════════════════
           GLOBAL UTILITIES
        ═══════════════════════════════════════════════════════ */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
        }
        .card-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .card-title { font-size: 14.5px; font-weight: 700; color: var(--text-1); }
        .card-sub { font-size: 12px; color: var(--text-3); margin-top: 1px; }
        .card-body { padding: 20px; }

        /* Status pills */
        .pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 9px; border-radius: 999px;
          font-size: 11.5px; font-weight: 600;
          white-space: nowrap;
        }
        .pill-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .pill-present { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
        .pill-late { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
        .pill-absent { background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); }
        .pill-leave { background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-border); }
        .pill-pending { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
        .pill-approved { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
        .pill-rejected { background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); }
        .pill-cancelled { background: #F8FAFC; color: var(--text-3); border: 1px solid var(--border); }

        /* Avatar */
        .avatar-sm {
          width: 36px; height: 36px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; flex-shrink: 0;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
      `}</style>

      {/* Backdrop */}
      <div
        className={`backdrop${sidebarOpen ? " show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sb-logo">
          <div className="sb-logo-mark">
            <Fingerprint size={19} color="white" strokeWidth={1.75} />
          </div>
          <div className="sb-logo-text">
            <div className="sb-logo-primary">JTI Innovation</div>
            <div className="sb-logo-secondary">Admin Presensi</div>
          </div>
          <button className="sb-close" onClick={() => setSidebarOpen(false)}>
            <X size={14} />
          </button>
        </div>

        <nav className="sb-nav">
          <div className="sb-section-label">Menu Utama</div>
          {navigation.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sb-item${isActive ? " active" : ""}`}
              >
                <item.icon size={16} />
                {item.name}
                <span className="sb-item-spacer" />
                {isActive && <ChevronRight size={13} className="sb-chevron" />}
              </Link>
            );
          })}
        </nav>

        <div className="sb-footer">
          <div className="sb-footer-card">
            <div className="sb-footer-label">Sistem</div>
            <div className="sb-footer-value">v2.0 · Tefa JTI Innovation</div>
          </div>
          <button className="sb-logout" onClick={handleLogout}>
            <LogOut size={15} />
            Keluar dari Sistem
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-wrap">
        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={16} />
          </button>

          <div className="topbar-breadcrumb">
            <span className="topbar-brand">JTI Innovation</span>
            <ChevronRight
              size={13}
              className="topbar-sep"
              style={{ color: "var(--text-3)" }}
            />
            <span className="topbar-page">
              {currentPage?.name || "Dashboard"}
            </span>
          </div>

          <span className="topbar-spacer" />

          <div className="topbar-actions">
            {mounted && (
              <div className="topbar-date">
                <Clock size={12} color="var(--blue-400)" />
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
            <button className="topbar-icon-btn" title="Notifikasi">
              <Bell size={15} />
            </button>
            <div className="topbar-avatar" title="Admin">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
