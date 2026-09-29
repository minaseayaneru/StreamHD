'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Film, Link as LinkIcon, Settings, LogOut, Menu, X, User, Tv } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState('Admin');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const headers = {};
        if (typeof window !== 'undefined') {
          const savedToken = localStorage.getItem('shindora_session_token');
          if (savedToken) {
            headers['Authorization'] = `Bearer ${savedToken}`;
          }
        }
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          headers,
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            if (data.user) setUser(data.user);
            if (data.token) {
              try { localStorage.setItem('shindora_session_token', data.token); } catch (e) {}
            }
            setAuthLoading(false);
          } else {
            router.replace('/login');
          }
        } else {
          router.replace('/login');
        }
      } catch (err) {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/login';
    } catch (e) {
      window.location.href = '/login';
    }
  };

  const navItems = [
    { name: 'Video Links', href: '/dashboard', icon: LinkIcon },
    { name: 'VAST Ads', href: '/dashboard/vast-ads', icon: Tv },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border min-h-screen">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Film className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">ShinDora CDN</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard/links'));
            const Icon = item.icon;
            const testId = item.name === 'Settings' ? 'nav-settings' : item.name === 'VAST Ads' ? 'nav-vast-ads' : 'nav-video-links';
            return (
              <Link
                key={item.name}
                href={item.href}
                data-testid={testId}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border space-y-4">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-primary-foreground font-semibold">
              <User className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs text-muted-foreground font-semibold">Logged in as</span>
              <span className="text-sm font-medium truncate">{user || 'Admin'}</span>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive gap-3 px-4 py-2"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <span className="font-bold text-md tracking-tight">ShinDora CDN</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-foreground focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" />
      )}

      {/* Mobile Side Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border p-6 transition-transform transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-6 border-b border-border mb-6">
          <div className="flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            <span className="font-bold text-md tracking-tight">ShinDora CDN</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard/links'));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col truncate">
              <span className="text-xs text-muted-foreground">Logged in as</span>
              <span className="text-sm font-medium truncate">{user || 'Admin'}</span>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive gap-3"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-x-hidden min-h-screen">
        {authLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Film className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
