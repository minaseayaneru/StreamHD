'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Film, Shield, Link as LinkIcon, Radio, Sparkles, ArrowRight, Subtitles, Download, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          setAuthenticated(true);
        }
      } catch (err) {}
    }
    checkSession();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Film className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">ShinDora CDN</span>
          </div>

          <Link href={authenticated ? '/dashboard' : '/login'}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5">
              {authenticated ? 'Dashboard' : 'Masuk Admin Panel'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 py-16 sm:py-24">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Full Stream Proxy Bypasser, VAST Ads & Download Generator
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight">
            ShinDora CDN & Video Player Engine
          </h1>
          
          <p className="text-muted-foreground text-md sm:text-xl max-w-2xl leading-relaxed">
            Extractor cerdas untuk video Streamtape, Doodstream, LuluStream, Vidara, MP4Upload, TurboViPlay, TurboNewVid, FC2Stream, VK Video, OK.ru, dan Sibnet. Mengalirkan konten berkualitas tinggi secara real-time langsung melalui serverless proxy pipe tanpa hambatan CORS, lengkap dengan jadwal iklan VAST custom midroll, AdBlock Detector, dan Direct Download Link Generator.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href={authenticated ? '/dashboard' : '/login'}>
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 flex items-center gap-2">
                Buka Dashboard Admin
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl pt-16">
            <div className="bg-card border border-border p-6 rounded-xl flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">VK Video & Clips</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mengekstrak direct URL MP4 dan HLS menggunakan integrasi VK API Service Token resmi secara instan.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-xl flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Direct Download</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generator link unduh langsung otomatis dengan resolusi multi-kualitas (1080p, 720p, 480p, 360p).
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-xl flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">AdBlock Detector</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Proteksi pemutaran dengan overlay peringatan AdBlock di JW Player dan Video.js.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-xl flex flex-col items-center text-center space-y-3 shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Custom VAST Midroll</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pengaturan penayangan iklan VAST pada menit kustom (misal: 03:00, 05:00) yang presisi.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-card/30">
        <div className="container max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ShinDora CDN. Dilengkapi dengan Video.js & JWPlayer SDK, VK API, and ImageKit.
        </div>
      </footer>
    </div>
  );
}

export default App;
