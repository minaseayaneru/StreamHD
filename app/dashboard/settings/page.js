'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Image as ImageIcon,
  Lock,
  CheckCircle2,
  Shield,
  Info,
  Film,
  Key,
  Cloud,
  ShieldAlert,
  Download
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();

  // ============================================================
  // IMAGEKIT SETTINGS
  // ============================================================

  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [urlEndpoint, setUrlEndpoint] = useState('');
  const [hasPrivateKey, setHasPrivateKey] = useState(false);
  const [savingIk, setSavingIk] = useState(false);

  // ============================================================
  // PLAYER SETTINGS
  // ============================================================

  const [playerType, setPlayerType] = useState('videojs');
  const [autoplay, setAutoplay] = useState(true);
  const [isAdblockEnabled, setIsAdblockEnabled] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);

  // ============================================================
  // CDN SETTINGS
  // ============================================================

  const [cdnUrl, setCdnUrl] = useState('');
  const [downloadCdnUrl, setDownloadCdnUrl] = useState('');
  const [isCustomDownloadCdnEnabled, setIsCustomDownloadCdnEnabled] =
    useState(false);

  const [savingCdn, setSavingCdn] = useState(false);

  // ============================================================
  // ADMIN SETTINGS
  // ============================================================

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // ============================================================
  // LOAD CURRENT SETTINGS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const headers = {};
        if (typeof window !== 'undefined') {
          const savedToken = localStorage.getItem('shindora_session_token');
          if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;
        }
        const res = await fetch('/api/settings', {
          credentials: 'include',
          headers,
          cache: 'no-store'
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (cancelled) {
          return;
        }

        // ImageKit
        setPublicKey(data.imagekit?.publicKey || '');
        setUrlEndpoint(data.imagekit?.urlEndpoint || '');

        const privateExists =
          data.imagekit?.hasPrivateKey === true;

        setHasPrivateKey(privateExists);

        if (privateExists) {
          setPrivateKey('●●●●●');
        } else {
          setPrivateKey('');
        }

        // Player
        setPlayerType(
          data.player?.playerType || 'videojs'
        );

        setAutoplay(
          data.player?.autoplay !== undefined
            ? Boolean(data.player.autoplay)
            : true
        );

        setIsAdblockEnabled(
          data.player?.isAdblockEnabled !== undefined
            ? Boolean(data.player.isAdblockEnabled)
            : false
        );

        // CDN STREAM CLOUDFLARE
        setCdnUrl(
          data.general?.cdnUrl || ''
        );

        // CDN DOWNLOAD CLOUDFLARE
        setDownloadCdnUrl(
          data.general?.downloadCdnUrl || ''
        );

        setIsCustomDownloadCdnEnabled(
          data.general?.isCustomDownloadCdnEnabled !== undefined
            ? Boolean(
                data.general.isCustomDownloadCdnEnabled
              )
            : false
        );

        /*
         * VK TOKEN TIDAK DIBACA DARI DATABASE.
         *
         * TOKEN HANYA:
         *
         * VK_SERVICE_TOKEN
         *
         * dari environment server.
         */

        // Admin
        setUsername(
          data.admin?.username || 'admin'
        );
      } catch (err) {
        console.error(
          '[Settings] Failed to load:',
          err
        );
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // SAVE IMAGEKIT
  // ============================================================

  const handleSaveImageKit = async (e) => {
    e.preventDefault();
    setSavingIk(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          settingsType: 'imagekit',
          publicKey,
          privateKey,
          urlEndpoint
        })
      });

      if (res.ok) {
        toast({
          title: 'ImageKit Diperbarui!',
          description:
            'Pengaturan ImageKit SDK berhasil disimpan.'
        });

        if (
          privateKey &&
          privateKey !== '●●●●●'
        ) {
          setHasPrivateKey(true);
          setPrivateKey('●●●●●');
        }
      } else {
        const errData = await res.json();

        alert(
          errData.error ||
            'Gagal menyimpan pengaturan ImageKit.'
        );
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSavingIk(false);
    }
  };

  // ============================================================
  // SAVE PLAYER
  // ============================================================

  const handleSavePlayerType = async (e) => {
    e.preventDefault();
    setSavingPlayer(true);

    try {
      const settingsRes = await fetch(
        '/api/settings',
        {
          credentials: 'include',
          cache: 'no-store'
        }
      );

      let currentVastEnabled = false;
      let currentVastTags = [];

      if (settingsRes.ok) {
        const fullSettings =
          await settingsRes.json();

        currentVastEnabled =
          fullSettings.player?.vastEnabled !== undefined
            ? fullSettings.player.vastEnabled
            : false;

        currentVastTags =
          fullSettings.player?.vastTags || [];
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          settingsType: 'player',
          playerType,
          autoplay,
          isAdblockEnabled,
          vastEnabled: currentVastEnabled,
          vastTags: currentVastTags
        })
      });

      if (res.ok) {
        toast({
          title: 'Preferensi Player Diperbarui!',
          description:
            'Pengaturan Player Engine dan AdBlock Detector berhasil disimpan.'
        });
      } else {
        const errData = await res.json();

        alert(
          errData.error ||
            'Gagal menyimpan preferensi player.'
        );
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSavingPlayer(false);
    }
  };

  // ============================================================
  // SAVE CDN
  // ============================================================

  const handleSaveCdn = async (e) => {
    e.preventDefault();
    setSavingCdn(true);

    try {
      /*
       * VK SERVICE TOKEN TIDAK DIKIRIM KE DATABASE.
       *
       * CDN URL TETAP DIKIRIM DAN DISIMPAN:
       *
       * cdnUrl
       * downloadCdnUrl
       * isCustomDownloadCdnEnabled
       *
       * cdnUrl = Cloudflare Worker Stream
       * downloadCdnUrl = Cloudflare Worker Download
       */

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          settingsType: 'general',

          // CLOUDFLARE STREAM WORKER
          cdnUrl,

          // CLOUDFLARE DOWNLOAD WORKER
          downloadCdnUrl,

          // TOGGLE DEDICATED DOWNLOAD WORKER
          isCustomDownloadCdnEnabled
        })
      });

      if (res.ok) {
        toast({
          title: 'Konfigurasi CDN Diperbarui!',
          description:
            'Pengaturan CDN Stream dan Dedicated Download CDN berhasil disimpan.'
        });
      } else {
        const errData = await res.json();

        alert(
          errData.error ||
            'Gagal menyimpan pengaturan CDN.'
        );
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSavingCdn(false);
    }
  };

  // ============================================================
  // SAVE ADMIN
  // ============================================================

  const handleSaveAdminPassword = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Password tidak cocok',
        description:
          'Password baru dan konfirmasi password harus sama.',
        variant: 'destructive'
      });

      return;
    }

    setSavingAdmin(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          settingsType: 'admin',
          username,
          password
        })
      });

      if (res.ok) {
        toast({
          title: 'Akun Admin Diperbarui!',
          description:
            'Username dan password admin berhasil diperbarui.'
        });

        setPassword('');
        setConfirmPassword('');
      } else {
        const errData = await res.json();

        alert(
          errData.error ||
            'Gagal mengganti akun admin.'
        );
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSavingAdmin(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">

      {/* HEADER */}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Pengaturan Sistem
        </h1>

        <p className="text-muted-foreground mt-1">
          Konfigurasi ImageKit SDK, AdBlock Detector,
          Dedicated Cloudflare Download CDN, dan VK API Key
        </p>
      </div>

      <Tabs defaultValue="player" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="player" data-testid="tab-player" className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            Player Engine
          </TabsTrigger>
          <TabsTrigger value="cdn" data-testid="tab-cdn" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            General / CDN
          </TabsTrigger>
          <TabsTrigger value="imagekit" data-testid="tab-imagekit" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            ImageKit SDK
          </TabsTrigger>
          <TabsTrigger value="admin" data-testid="tab-admin" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Admin Account
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLAYER */}
        <TabsContent value="player" className="space-y-6">
          <Card className="border-border bg-card max-w-3xl">
            <form onSubmit={handleSavePlayerType}>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" />
                  Default Player Engine & AdBlock Detector
                </CardTitle>

                <CardDescription>
                  Pilih pemutar video default dan kelola
                  pengaturan proteksi iklan anti-AdBlock
                  pada halaman player (/v/[slug])
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">

                <div className="space-y-2">
                  <Label htmlFor="defaultPlayerType">
                    Pilihan Player Engine
                  </Label>

                  <select
                    id="defaultPlayerType"
                    value={playerType}
                    onChange={(e) =>
                      setPlayerType(e.target.value)
                    }
                    className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:ring-primary focus:border-primary font-medium"
                  >
                    <option value="videojs">
                      Video.js Player Engine (Resolution Switcher + Subtitles)
                    </option>

                    <option value="jwplayer">
                      JW Player Engine (Premium SDK with +10s/-10s Buttons + Subtitles)
                    </option>
                  </select>
                </div>

                {/* AUTOPLAY */}

                <div className="space-y-2">
                  <Label htmlFor="autoplaySelect">
                    Autoplay Video
                  </Label>

                  <select
                    id="autoplaySelect"
                    value={
                      autoplay
                        ? 'true'
                        : 'false'
                    }
                    onChange={(e) =>
                      setAutoplay(
                        e.target.value === 'true'
                      )
                    }
                    className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:ring-primary focus:border-primary font-medium"
                  >
                    <option value="true">
                      Aktif (Autoplay Otomatis)
                    </option>

                    <option value="false">
                      Nonaktif (Klik untuk Putar)
                    </option>
                  </select>

                  <p className="text-[10px] text-muted-foreground">
                    Secara universal beroperasi di JW Player
                    dan Video.js dengan muting fallback otomatis
                    dari browser.
                  </p>
                </div>

                {/* ADBLOCK */}

                <div className="pt-3 border-t border-border">

                  <div
                    onClick={() =>
                      setIsAdblockEnabled(
                        !isAdblockEnabled
                      )
                    }
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  >

                    <div className="space-y-1 pr-4 select-none">

                      <div className="flex items-center gap-2">

                        <ShieldAlert className="h-4 w-4 text-amber-500" />

                        <span className="text-sm font-semibold text-foreground">
                          AdBlock Detection
                        </span>

                      </div>

                      <p className="text-xs text-muted-foreground">
                        Aktifkan untuk memblokir/memberi
                        peringatan pengguna yang menggunakan
                        AdBlock
                      </p>

                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >
                      <Switch
                        id="adblock-switch"
                        data-testid="adblock-switch-toggle"
                        aria-label="AdBlock Detection"
                        checked={isAdblockEnabled}
                        onCheckedChange={
                          setIsAdblockEnabled
                        }
                      />
                    </div>

                  </div>

                  <div className="mt-2 text-[11px] text-muted-foreground flex gap-1.5 items-start">

                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />

                    <span>
                      {isAdblockEnabled
                        ? '🟢 Deteksi AdBlock aktif: Pemutar JW Player dan Video.js akan menampilkan overlay peringatan jika ekstensi AdBlock terdeteksi aktif.'
                        : '⚪ Deteksi AdBlock nonaktif: Video akan diputar lancar tanpa hambatan overlay peringatan meskipun pengguna memakai AdBlock.'}
                    </span>

                  </div>

                </div>

              </CardContent>

              <CardFooter className="border-t border-border pt-4">

                <Button
                  id="save-player-btn"
                  data-testid="save-player-settings-btn"
                  type="submit"
                  disabled={savingPlayer}
                  className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {savingPlayer
                    ? 'Menyimpan...'
                    : 'Simpan Preferensi Player'}
                </Button>

              </CardFooter>

            </form>
          </Card>
        </TabsContent>

        {/* TAB 2: CDN & VK API */}
        <TabsContent value="cdn" className="space-y-6">
          <Card className="border-border bg-card max-w-3xl">
            <form onSubmit={handleSaveCdn}>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />

                  Pengaturan VK API & CDN Cloudflare
                </CardTitle>

                <CardDescription>
                  Konfigurasi VK Service Token dan
                  Cloudflare Worker CDN
                  (Stream & Dedicated Download CDN)
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">

                {/* VK TOKEN */}

                <div className="space-y-2">

                  <Label htmlFor="vkServiceToken">
                    VK API Key / Service Token / Secure Key
                  </Label>

                  <Input
                    id="vkServiceToken"
                    type="password"
                    placeholder="6ec1097b..."
                    value=""
                    readOnly
                    disabled
                    className="bg-background border-border text-foreground font-mono cursor-not-allowed"
                  />

                  <p className="text-[10px] text-muted-foreground">
                    Service token / Secure key resmi VKontakte
                    dikonfigurasi melalui environment variable
                    <code className="ml-1">
                      VK_SERVICE_TOKEN
                    </code>
                  </p>

                </div>

                {/* CLOUDFLARE STREAM WORKER */}

                <div className="space-y-2 pt-2 border-t border-border">

                  <Label htmlFor="cdnUrl">
                    CDN / Cloudflare Worker Stream URL
                  </Label>

                  <Input
                    id="cdnUrl"
                    data-testid="cdn-stream-url-input"
                    type="url"
                    placeholder="https://cdn.domainkamu.com"
                    value={cdnUrl}
                    onChange={(e) =>
                      setCdnUrl(e.target.value)
                    }
                    className="bg-background border-border text-foreground font-mono text-xs"
                  />

                  <p className="text-[10px] text-muted-foreground">
                    Worker yang menangani direct streaming video
                    (video player embed) untuk bypass transfer
                    origin Vercel.
                  </p>

                </div>

                {/* DEDICATED CLOUDFLARE DOWNLOAD WORKER */}

                <div className="space-y-3 pt-2 border-t border-border">

                  <div
                    onClick={() =>
                      setIsCustomDownloadCdnEnabled(
                        !isCustomDownloadCdnEnabled
                      )
                    }
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  >

                    <div className="space-y-0.5 pr-4 select-none">

                      <div className="flex items-center gap-2">

                        <Download className="h-4 w-4 text-emerald-500" />

                        <span className="text-xs font-semibold text-foreground">
                          Gunakan Dedicated Download CDN
                        </span>

                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        Jika toggle MATI, sistem akan menggunakan
                        domain CDN Stream utama sebagai fallback.
                      </p>

                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                    >
                      <Switch
                        id="download-cdn-toggle"
                        data-testid="download-cdn-switch-toggle"
                        aria-label="Gunakan Dedicated Download CDN"
                        checked={
                          isCustomDownloadCdnEnabled
                        }
                        onCheckedChange={
                          setIsCustomDownloadCdnEnabled
                        }
                      />
                    </div>

                  </div>

                  <div className="space-y-1.5">

                    <Label htmlFor="downloadCdnUrl">
                      CDN / Cloudflare Worker Download URL
                    </Label>

                    <Input
                      id="downloadCdnUrl"
                      data-testid="cdn-download-url-input"
                      type="url"
                      placeholder="https://download-cdn.domainkamu.com"
                      value={downloadCdnUrl}
                      onChange={(e) =>
                        setDownloadCdnUrl(
                          e.target.value
                        )
                      }
                      className="bg-background border-border text-foreground font-mono text-xs"
                    />

                    <p className="text-[10px] text-muted-foreground">
                      Domain Worker khusus yang menangani header
                      attachment/force download untuk menghemat
                      bandwidth Vercel.
                    </p>

                  </div>

                </div>

              </CardContent>

              <CardFooter className="border-t border-border pt-4">

                <Button
                  id="save-cdn-btn"
                  data-testid="save-cdn-settings-btn"
                  type="submit"
                  disabled={savingCdn}
                  className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {savingCdn
                    ? 'Menyimpan...'
                    : 'Simpan Pengaturan CDN'}
                </Button>

              </CardFooter>

            </form>
          </Card>
        </TabsContent>

        {/* TAB 3: IMAGEKIT */}
        <TabsContent value="imagekit" className="space-y-6">
          <Card className="border-border bg-card max-w-3xl">
            <form onSubmit={handleSaveImageKit}>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  ImageKit SDK Settings
                </CardTitle>

                <CardDescription>
                  Masukkan detail ImageKit API Anda untuk
                  mengizinkan upload poster thumbnail dan
                  file subtitle (.vtt / .srt) secara langsung
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="publicKey">
                    Public Key
                  </Label>

                  <Input
                    id="publicKey"
                    type="text"
                    placeholder="e.g. public_S6h4B..."
                    value={publicKey}
                    onChange={(e) =>
                      setPublicKey(e.target.value)
                    }
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="privateKey">
                    Private Key
                  </Label>

                  <Input
                    id="privateKey"
                    type="password"
                    placeholder="e.g. private_Fv92k..."
                    value={privateKey}
                    onChange={(e) =>
                      setPrivateKey(e.target.value)
                    }
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urlEndpoint">
                    URL Endpoint
                  </Label>

                  <Input
                    id="urlEndpoint"
                    type="url"
                    placeholder="e.g. https://ik.imagekit.io/username"
                    value={urlEndpoint}
                    onChange={(e) =>
                      setUrlEndpoint(e.target.value)
                    }
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

                <div className="bg-muted/40 rounded-lg p-3 border border-border/50 flex gap-2.5 items-start mt-4">

                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />

                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Kredensial disimpan dengan aman di database.
                    Private Key digunakan untuk membuat token
                    tanda tangan berumur pendek untuk upload
                    langsung file poster dan file subtitle
                    dari browser.
                  </p>

                </div>

              </CardContent>

              <CardFooter className="border-t border-border pt-4">

                <Button
                  type="submit"
                  disabled={savingIk}
                  className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {savingIk
                    ? 'Menyimpan...'
                    : 'Simpan Kredensial'}
                </Button>

              </CardFooter>

            </form>
          </Card>
        </TabsContent>

        {/* TAB 4: ADMIN */}
        <TabsContent value="admin" className="space-y-6">
          <Card className="border-border bg-card max-w-3xl">
            <form onSubmit={handleSaveAdminPassword}>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Ubah Akun Admin
                </CardTitle>

                <CardDescription>
                  Perbarui username dan kata sandi masuk
                  untuk mengamankan panel admin ini
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username Baru
                  </Label>

                  <Input
                    id="username"
                    type="text"
                    placeholder="Username baru..."
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                    className="bg-background border-border text-foreground font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password Baru
                  </Label>

                  <Input
                    id="password"
                    type="password"
                    placeholder="Kata sandi baru..."
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Konfirmasi Password Baru
                  </Label>

                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Konfirmasi kata sandi..."
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

              </CardContent>

              <CardFooter className="border-t border-border pt-4">

                <Button
                  type="submit"
                  disabled={savingAdmin}
                  className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {savingAdmin
                    ? 'Menyimpan...'
                    : 'Perbarui Akun Admin'}
                </Button>

              </CardFooter>

            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
