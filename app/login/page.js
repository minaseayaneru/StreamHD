'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Film, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  // Kosongkan state awal agar kredensial tidak terekspos di client JS bundle
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    }
    checkSession();
  }, [router]);

  const handleLogin = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const userInput = (typeof document !== 'undefined' ? document.getElementById('username')?.value : '') || username;
    const passInput = (typeof document !== 'undefined' ? document.getElementById('password')?.value : '') || password;

    const cleanUsername = (userInput || '').trim();
    const cleanPassword = (passInput || '').trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Silakan masukkan username dan password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          username: cleanUsername, 
          password: cleanPassword, 
          remember 
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          try {
            localStorage.setItem('shindora_session_token', data.token);
            localStorage.setItem('shindora_session_user', data.user || 'Admin');
          } catch (e) {}
        }
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Login gagal. Coba lagi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8" suppressHydrationWarning>
      <div className="w-full max-w-md space-y-8" suppressHydrationWarning>
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Film className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
            ShinDora CDN
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Masuk untuk mengelola link video VK, OK.ru, Sibnet & generator embed
          </p>
        </div>

        <Card className="border-border bg-card shadow-lg" suppressHydrationWarning>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(e);
            }}
            id="login-form"
            data-testid="login-form"
            suppressHydrationWarning
          >
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
              <CardDescription>
                Masukkan username dan password admin Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <User className="h-4 w-4" />
                  </span>
                  <Input
                    id="username"
                    name="username"
                    data-testid="login-username-input"
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    id="password"
                    name="password"
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="remember"
                  name="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  suppressHydrationWarning
                  className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <Label htmlFor="remember" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                  Ingat Saya / Simpan Login
                </Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                id="login-submit-btn"
                data-testid="login-submit-btn"
                type="button"
                onClick={handleLogin}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Sign In'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
