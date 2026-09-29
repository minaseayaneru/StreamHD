'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, Plus, Info, CheckCircle2, Film, Clock, Trash2, 
  Layers, ExternalLink, Image as ImageIcon, Sparkles, AlertCircle, ArrowDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// Helper to convert MM:SS or HH:MM:SS or raw seconds to total seconds
export function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const trimmed = String(timeStr).trim();
  if (trimmed.endsWith('%')) return trimmed; // Percentage offset support

  // Check if it's already a pure number
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  const parts = trimmed.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 2) {
    // MM:SS
    const [minutes, seconds] = parts;
    return (minutes * 60) + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  return 0;
}

// Helper to format seconds back to MM:SS or HH:MM:SS
export function formatSecondsToTime(totalSeconds) {
  if (typeof totalSeconds === 'string' && (totalSeconds.includes(':') || totalSeconds.endsWith('%'))) {
    return totalSeconds;
  }
  const sec = parseInt(totalSeconds, 10) || 0;
  if (sec <= 0) return '00:00';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const pad = (num) => String(num).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function VastAdsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [vastEnabled, setVastEnabled] = useState(false);
  const [vastTags, setVastTags] = useState([]);

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setVastEnabled(data.player?.vastEnabled !== undefined ? data.player.vastEnabled : false);
          
          const loadedTags = (data.player?.vastTags || []).map(tag => {
            const adType = tag.adType || 'vast';
            const parsedSec = tag.timeInSeconds !== undefined ? tag.timeInSeconds : parseTimeToSeconds(tag.customTime || tag.offset);
            const customTimeFormatted = tag.customTime || (tag.offset !== 'pre' && tag.offset !== 'post' ? formatSecondsToTime(tag.offset) : '03:00');
            
            return {
              ...tag,
              adType,
              customTime: customTimeFormatted,
              timeInSeconds: typeof parsedSec === 'number' ? parsedSec : parseTimeToSeconds(customTimeFormatted),
              fallbackTags: Array.isArray(tag.fallbackTags) ? tag.fallbackTags : [],
              bannerImageUrl: tag.bannerImageUrl || '',
              bannerTargetUrl: tag.bannerTargetUrl || '',
              overlayShowTime: tag.overlayShowTime || '00:10',
              overlayShowSeconds: tag.overlayShowSeconds !== undefined ? tag.overlayShowSeconds : 10,
              overlayDuration: tag.overlayDuration !== undefined ? tag.overlayDuration : 15,
              popupUrl: tag.popupUrl || '',
              triggerAction: tag.triggerAction || 'first_click',
              frequencyLimit: tag.frequencyLimit || 'once_24h',
            };
          });

          setVastTags(loadedTags);
        }
      } catch (err) {
        console.error('Failed to load vast settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleAddAdTag = () => {
    const newTag = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Iklan Baru #${vastTags.length + 1}`,
      adType: 'vast',
      tagUrl: '',
      fallbackTags: [],
      offset: 'custom',
      customTime: '03:00',
      timeInSeconds: 180,
      enabled: true,
      bannerImageUrl: '',
      bannerTargetUrl: '',
      overlayShowTime: '00:10',
      overlayShowSeconds: 10,
      overlayDuration: 15,
      popupUrl: '',
      triggerAction: 'first_click',
      frequencyLimit: 'once_24h'
    };
    setVastTags([...vastTags, newTag]);
  };

  const handleRemoveAdTag = (id) => {
    setVastTags(vastTags.filter(t => t.id !== id));
  };

  const handleUpdateAdTag = (id, field, value) => {
    setVastTags(vastTags.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        
        if (field === 'customTime') {
          updated.timeInSeconds = parseTimeToSeconds(value);
        } else if (field === 'offset') {
          if (value === 'pre') {
            updated.timeInSeconds = 0;
            updated.customTime = '00:00';
          } else if (value === 'post') {
            updated.timeInSeconds = -1;
            updated.customTime = 'End';
          } else if (value === 'custom' && !updated.customTime) {
            updated.customTime = '03:00';
            updated.timeInSeconds = 180;
          }
        } else if (field === 'overlayShowTime') {
          updated.overlayShowSeconds = parseTimeToSeconds(value);
        }
        return updated;
      }
      return t;
    }));
  };

  const handleAddFallbackTag = (adId) => {
    setVastTags(vastTags.map(t => {
      if (t.id === adId) {
        const currentFallbacks = Array.isArray(t.fallbackTags) ? [...t.fallbackTags] : [];
        if (currentFallbacks.length < 5) {
          currentFallbacks.push('');
        }
        return { ...t, fallbackTags: currentFallbacks };
      }
      return t;
    }));
  };

  const handleUpdateFallbackTag = (adId, index, value) => {
    setVastTags(vastTags.map(t => {
      if (t.id === adId) {
        const currentFallbacks = Array.isArray(t.fallbackTags) ? [...t.fallbackTags] : [];
        currentFallbacks[index] = value;
        return { ...t, fallbackTags: currentFallbacks };
      }
      return t;
    }));
  };

  const handleRemoveFallbackTag = (adId, index) => {
    setVastTags(vastTags.map(t => {
      if (t.id === adId) {
        const currentFallbacks = Array.isArray(t.fallbackTags) ? t.fallbackTags.filter((_, i) => i !== index) : [];
        return { ...t, fallbackTags: currentFallbacks };
      }
      return t;
    }));
  };

  const handleSaveVastAds = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const settingsRes = await fetch('/api/settings', { credentials: 'include', cache: 'no-store' });
      let currentSettings = {};
      if (settingsRes.ok) {
        const fullSettings = await settingsRes.json();
        currentSettings = fullSettings.player || {};
      }

      const sanitizedTags = vastTags.map(t => {
        const adType = t.adType || 'vast';
        let finalOffset = t.offset || 'pre';
        let calculatedSeconds = t.timeInSeconds;
        
        if (t.offset === 'custom') {
          calculatedSeconds = parseTimeToSeconds(t.customTime || '03:00');
          finalOffset = t.customTime || '03:00';
        }

        const validFallbacks = Array.isArray(t.fallbackTags) 
          ? t.fallbackTags.map(f => (f || '').trim()).filter(Boolean)
          : [];

        return {
          id: t.id || Math.random().toString(36).substring(2, 9),
          name: t.name || 'Ad Campaign',
          adType,
          enabled: t.enabled !== undefined ? !!t.enabled : true,
          tagUrl: (t.tagUrl || '').trim(),
          fallbackTags: validFallbacks,
          offset: t.offset || 'custom',
          customTime: t.customTime || (t.offset === 'custom' ? '03:00' : ''),
          timeInSeconds: calculatedSeconds,
          bannerImageUrl: (t.bannerImageUrl || '').trim(),
          bannerTargetUrl: (t.bannerTargetUrl || '').trim(),
          overlayShowTime: t.overlayShowTime || '00:10',
          overlayShowSeconds: parseTimeToSeconds(t.overlayShowTime || '00:10'),
          overlayDuration: parseInt(t.overlayDuration, 10) || 15,
          popupUrl: (t.popupUrl || '').trim(),
          triggerAction: t.triggerAction || 'first_click',
          frequencyLimit: t.frequencyLimit || 'once_24h',
        };
      });

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          settingsType: 'player',
          playerType: currentSettings.playerType || 'videojs',
          autoplay: currentSettings.autoplay !== undefined ? currentSettings.autoplay : true,
          isAdblockEnabled: currentSettings.isAdblockEnabled !== undefined ? currentSettings.isAdblockEnabled : false,
          vastEnabled,
          vastTags: sanitizedTags,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Advanced VAST Engine Diperbarui!',
          description: 'Seluruh konfigurasi VAST Waterfall, Overlay Banner, dan Popup berhasil disimpan.',
        });
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal menyimpan konfigurasi iklan.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-screen">
        <Film className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advanced VAST Ads Engine</h1>
        <p className="text-muted-foreground mt-1">
          Konfigurasi sirkulasi penayangan iklan video VAST Waterfall bertingkat, Overlay Banner melayang, dan On-Click Popup / Popunder pada JW Player & Video.js
        </p>
      </div>

      <div className="max-w-4xl">
        <Card className="border-border bg-card">
          <form onSubmit={handleSaveVastAds}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Sistem Iklan Video (Multiple Waterfall, Banner & Popups)
              </CardTitle>
              <CardDescription>
                Kelola jadwal pemutaran iklan dengan dukungan cadangan VAST (Waterfall fallback), banner interaktif, dan popunder
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vastEnabledSelect">Status Penayangan Iklan Global</Label>
                <select
                  id="vastEnabledSelect"
                  data-testid="vast-enabled-select"
                  value={vastEnabled ? 'true' : 'false'}
                  onChange={(e) => setVastEnabled(e.target.value === 'true')}
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:ring-primary focus:border-primary font-medium"
                >
                  <option value="true">Aktifkan Iklan (Global)</option>
                  <option value="false">Nonaktifkan Iklan (Global)</option>
                </select>
              </div>

              {vastEnabled && (
                <div className="space-y-6 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex justify-between items-center border-b border-border/80 pb-3">
                    <div>
                      <Label className="text-sm font-semibold text-foreground">Daftar Jadwal Iklan Terkonfigurasi</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mendukung VAST Video Ads (Waterfall), Overlay Banners, dan On-Click Popups
                      </p>
                    </div>
                    <Button 
                      id="add-ad-tag-btn"
                      data-testid="add-ad-tag-btn"
                      type="button" 
                      onClick={handleAddAdTag} 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah Iklan Baru
                    </Button>
                  </div>

                  {vastTags.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-border rounded-lg bg-background/50 space-y-2">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">Belum ada item iklan terkonfigurasi. Silakan klik tombol di atas untuk menambahkan.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {vastTags.map((tag, idx) => {
                        const currentAdType = tag.adType || 'vast';

                        return (
                          <div 
                            key={tag.id} 
                            data-testid={`ad-tag-item-${idx}`}
                            className="border border-border rounded-xl p-5 bg-muted/10 relative space-y-5 shadow-sm"
                          >
                            {/* Card Header Row */}
                            <div className="flex justify-between items-center border-b border-border/60 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-primary flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-bold text-foreground">
                                  {tag.name || `Iklan #${idx + 1}`}
                                </span>
                                {currentAdType === 'vast' && (
                                  <span className="bg-blue-500/10 text-blue-500 text-[10px] font-semibold px-2 py-0.5 rounded border border-blue-500/20">
                                    VAST Video Ad {tag.offset === 'custom' ? `(${tag.customTime || '03:00'})` : `(${tag.offset})`}
                                  </span>
                                )}
                                {currentAdType === 'overlay' && (
                                  <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-500/20">
                                    Overlay Banner ({tag.overlayShowTime || '00:10'})
                                  </span>
                                )}
                                {currentAdType === 'popup' && (
                                  <span className="bg-purple-500/10 text-purple-500 text-[10px] font-semibold px-2 py-0.5 rounded border border-purple-500/20">
                                    On-Click Popup
                                  </span>
                                )}
                              </div>

                              <Button 
                                type="button" 
                                data-testid={`remove-ad-btn-${idx}`}
                                onClick={() => handleRemoveAdTag(tag.id)} 
                                className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 px-2 rounded-md bg-transparent flex items-center gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Hapus
                              </Button>
                            </div>

                            {/* Row 1: Ad Name, Ad Type & Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Nama Iklan</Label>
                                <Input
                                  type="text"
                                  data-testid={`ad-name-input-${idx}`}
                                  placeholder="e.g. AdSense Midroll Waterfall"
                                  value={tag.name || ''}
                                  onChange={(e) => handleUpdateAdTag(tag.id, 'name', e.target.value)}
                                  className="bg-background border-border text-foreground text-xs"
                                  required
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Tipe Iklan (Ad Type)</Label>
                                <select
                                  data-testid={`ad-type-select-${idx}`}
                                  value={currentAdType}
                                  onChange={(e) => handleUpdateAdTag(tag.id, 'adType', e.target.value)}
                                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg p-2 focus:ring-primary focus:border-primary font-medium"
                                >
                                  <option value="vast">VAST Video Ad (Preroll, Midroll, Postroll)</option>
                                  <option value="overlay">Overlay Banner (Gambar Melayang di Player)</option>
                                  <option value="popup">On-Click Popup / Popunder</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Status Aktif</Label>
                                <select
                                  data-testid={`ad-status-select-${idx}`}
                                  value={tag.enabled ? 'true' : 'false'}
                                  onChange={(e) => handleUpdateAdTag(tag.id, 'enabled', e.target.value === 'true')}
                                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg p-2 focus:ring-primary focus:border-primary font-medium"
                                >
                                  <option value="true">Aktif</option>
                                  <option value="false">Nonaktif</option>
                                </select>
                              </div>
                            </div>

                            {/* SECTION A: VAST VIDEO AD WITH WATERFALL */}
                            {currentAdType === 'vast' && (
                              <div className="space-y-4 pt-2 border-t border-border/60 animate-in fade-in-50 duration-200">
                                {/* Waktu Kemunculan */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Waktu Kemunculan</Label>
                                    <select
                                      data-testid={`ad-offset-select-${idx}`}
                                      value={tag.offset || 'custom'}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'offset', e.target.value)}
                                      className="w-full bg-background border border-border text-foreground text-xs rounded-lg p-2 focus:ring-primary focus:border-primary font-medium"
                                    >
                                      <option value="pre">Awal Video (Preroll - 00:00)</option>
                                      <option value="custom">Menit/Detik Tertentu (Midroll Custom)</option>
                                      <option value="post">Akhir Video (Postroll)</option>
                                    </select>
                                  </div>

                                  {tag.offset === 'custom' && (
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <Clock className="h-3 w-3 text-primary" /> Timestamp Waktu Kemunculan (MM:SS)
                                      </Label>
                                      <Input
                                        type="text"
                                        data-testid={`ad-custom-time-input-${idx}`}
                                        placeholder="e.g. 03:00 atau 05:00"
                                        value={tag.customTime || ''}
                                        onChange={(e) => handleUpdateAdTag(tag.id, 'customTime', e.target.value)}
                                        className="bg-background border-border text-foreground text-xs font-mono"
                                        required={tag.offset === 'custom'}
                                      />
                                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                                        <span>Format: <code className="bg-muted px-1 py-0.5 rounded font-mono">MM:SS</code></span>
                                        {tag.timeInSeconds !== undefined && tag.timeInSeconds > 0 && (
                                          <span className="text-primary font-medium">≈ {tag.timeInSeconds} detik ({tag.customTime || '03:00'})</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Multiple VAST Waterfall Section */}
                                <div className="space-y-3 bg-muted/20 p-3.5 rounded-lg border border-border/80">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                      <Layers className="h-3.5 w-3.5 text-primary" /> Multiple VAST Tags (Waterfall System)
                                    </Label>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      data-testid={`add-fallback-tag-btn-${idx}`}
                                      onClick={() => handleAddFallbackTag(tag.id)}
                                      className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                    >
                                      <Plus className="h-3 w-3" /> + Tambah Fallback Tag
                                    </Button>
                                  </div>

                                  {/* Primary VAST Tag */}
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-semibold text-primary">
                                      Primary VAST Tag (Tag Utama):
                                    </Label>
                                    <Input
                                      type="url"
                                      data-testid={`ad-primary-tag-input-${idx}`}
                                      placeholder="https://primary-vast.com/vast.xml atau Google IMA tag"
                                      value={tag.tagUrl || ''}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'tagUrl', e.target.value)}
                                      className="bg-background border-border text-foreground text-xs font-mono"
                                      required={currentAdType === 'vast'}
                                    />
                                  </div>

                                  {/* Fallback VAST Tags List */}
                                  {Array.isArray(tag.fallbackTags) && tag.fallbackTags.map((fbUrl, fIdx) => (
                                    <div key={fIdx} className="space-y-1 animate-in fade-in-50 duration-200">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                          <ArrowDown className="h-3 w-3 text-muted-foreground" /> Fallback Tag #{fIdx + 1} (Cadangan ke-{fIdx + 1}):
                                        </Label>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveFallbackTag(tag.id, fIdx)}
                                          className="h-5 px-1 text-[10px] text-red-500 hover:bg-red-500/10"
                                        >
                                          Hapus Cadangan
                                        </Button>
                                      </div>
                                      <Input
                                        type="url"
                                        data-testid={`ad-fallback-tag-input-${idx}-${fIdx}`}
                                        placeholder={`https://fallback-tag-${fIdx + 1}.com/vast.xml`}
                                        value={fbUrl}
                                        onChange={(e) => handleUpdateFallbackTag(tag.id, fIdx, e.target.value)}
                                        className="bg-background border-border text-foreground text-xs font-mono"
                                      />
                                    </div>
                                  ))}

                                  <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
                                    🔄 <strong>Logika Waterfall:</strong> Player akan mencoba memutar <em>Primary Tag</em> terlebih dahulu. Jika tag utama gagal (no fill, timeout, atau ad error), player secara otomatis mencoba <em>Fallback Tag #1</em>, lalu <em>Fallback Tag #2</em> secara berurutan.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* SECTION B: OVERLAY BANNER */}
                            {currentAdType === 'overlay' && (
                              <div className="space-y-4 pt-2 border-t border-border/60 animate-in fade-in-50 duration-200 bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                  <ImageIcon className="h-4 w-4" /> Pengaturan Overlay Banner (Melayang di Player)
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">URL Banner Image</Label>
                                    <Input
                                      type="url"
                                      data-testid={`banner-image-input-${idx}`}
                                      placeholder="https://example.com/banner-728x90.png atau .gif"
                                      value={tag.bannerImageUrl || ''}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'bannerImageUrl', e.target.value)}
                                      className="bg-background border-border text-foreground text-xs font-mono"
                                      required={currentAdType === 'overlay'}
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Target Link Landing Page</Label>
                                    <Input
                                      type="url"
                                      data-testid={`banner-target-input-${idx}`}
                                      placeholder="https://landingpage.com/promo"
                                      value={tag.bannerTargetUrl || ''}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'bannerTargetUrl', e.target.value)}
                                      className="bg-background border-border text-foreground text-xs font-mono"
                                      required={currentAdType === 'overlay'}
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Waktu Tampil Overlay (Detik / MM:SS)</Label>
                                    <Input
                                      type="text"
                                      data-testid={`overlay-show-time-input-${idx}`}
                                      placeholder="e.g. 00:10 atau 10"
                                      value={tag.overlayShowTime || ''}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'overlayShowTime', e.target.value)}
                                      className="bg-background border-border text-foreground text-xs font-mono"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      Muncul saat video mencapai detik ke-{tag.overlayShowSeconds || 10}.
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Durasi Tayang (Detik)</Label>
                                    <Input
                                      type="number"
                                      data-testid={`overlay-duration-input-${idx}`}
                                      placeholder="15"
                                      value={tag.overlayDuration !== undefined ? tag.overlayDuration : 15}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'overlayDuration', e.target.value)}
                                      className="bg-background border-border text-foreground text-xs"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      Lama banner melayang sebelum auto-hide (0 = tetap tampil hingga ditutup tombol X).
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* SECTION C: ON-CLICK POPUP / POPUNDER */}
                            {currentAdType === 'popup' && (
                              <div className="space-y-4 pt-2 border-t border-border/60 animate-in fade-in-50 duration-200 bg-purple-500/5 p-4 rounded-lg border border-purple-500/20">
                                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-xs">
                                  <ExternalLink className="h-4 w-4" /> Pengaturan On-Click Popup / Popunder
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold">Target Popup URL</Label>
                                  <Input
                                    type="url"
                                    data-testid={`popup-url-input-${idx}`}
                                    placeholder="https://popunder-direct-ad.com"
                                    value={tag.popupUrl || ''}
                                    onChange={(e) => handleUpdateAdTag(tag.id, 'popupUrl', e.target.value)}
                                    className="bg-background border-border text-foreground text-xs font-mono"
                                    required={currentAdType === 'popup'}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Trigger Action (Pemicu)</Label>
                                    <select
                                      data-testid={`popup-trigger-select-${idx}`}
                                      value={tag.triggerAction || 'first_click'}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'triggerAction', e.target.value)}
                                      className="w-full bg-background border border-border text-foreground text-xs rounded-lg p-2 focus:ring-primary focus:border-primary font-medium"
                                    >
                                      <option value="first_click">On First Click (Klik Pertama di Player)</option>
                                      <option value="play_click">On Play Button (Saat Tombol Putar Diklik)</option>
                                    </select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Frequency Limit (Batasan Frekuensi)</Label>
                                    <select
                                      data-testid={`popup-frequency-select-${idx}`}
                                      value={tag.frequencyLimit || 'once_24h'}
                                      onChange={(e) => handleUpdateAdTag(tag.id, 'frequencyLimit', e.target.value)}
                                      className="w-full bg-background border border-border text-foreground text-xs rounded-lg p-2 focus:ring-primary focus:border-primary font-medium"
                                    >
                                      <option value="once_24h">Maksimal 1x per Pengguna tiap 24 Jam (Recommended)</option>
                                      <option value="once_session">1x per Sesi Pemutaran Video</option>
                                      <option value="always">Setiap Kali Dipicu (Always)</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="bg-muted/30 rounded-lg p-3.5 border border-border/50 flex gap-2.5 items-start mt-4">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Mendukung format VAST 2.0, 3.0, 4.0, VMAP, Fallback Waterfall beruntun, serta Banner & Popunder. Seluruh aturan penayangan iklan dieksekusi secara native di player Video.js dan JW Player.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border pt-4">
              <Button
                id="save-vast-ads-btn"
                data-testid="save-vast-ads-btn"
                type="submit"
                disabled={saving}
                className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan Iklan'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
