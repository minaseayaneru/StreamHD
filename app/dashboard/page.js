'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Film, Plus, ExternalLink, Edit2, Trash2, Video, Search, Calendar, 
  Copy, Check, RefreshCw, Subtitles, Filter, Download, Zap, Tv, Play, Upload, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { detectProvider, getProviderInfo } from '@/lib/parser';

export default function DashboardLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [copiedSlug, setCopiedSlug] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBatchParsing, setIsBatchParsing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const headers = {};
      if (typeof window !== 'undefined') {
        const savedToken = localStorage.getItem('shindora_session_token');
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
        }
      }
      const res = await fetch('/api/links', { 
        credentials: 'include',
        headers,
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleDelete = async (id, title) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus link "${title}"?`)) return;

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setLinks(links.filter((link) => link.id !== id));
        toast({
          title: 'Link dihapus',
          description: `Link "${title}" berhasil dihapus.`,
        });
      } else {
        alert('Gagal menghapus link');
      }
    } catch (e) {
      alert('Gagal menghapus link');
    }
  };

  const handleCopy = (text, slug) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slug);
    toast({
      title: 'Disalin!',
      description: 'Link player berhasil disalin ke clipboard.',
    });
    setTimeout(() => setCopiedSlug(''), 2000);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredLinks.map(link => link.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchParse = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBatchParsing(true);
    const idsArray = Array.from(selectedIds);
    setBatchProgress({ current: 0, total: idsArray.length });
    
    let successCount = 0;
    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < idsArray.length; i += chunkSize) {
      chunks.push(idsArray.slice(i, i + chunkSize));
    }
    
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const promises = chunk.map(async (id) => {
        const linkItem = links.find(l => l.id === id);
        if (!linkItem?.slug) return null;

        try {
          const res = await fetch(`/api/parse-stream?slug=${encodeURIComponent(linkItem.slug)}&force=1`, {
            cache: 'no-store'
          });
          if (res.ok) {
            const data = await res.json();
            return { id, data };
          }
        } catch (e) {
          console.error(`Batch error for slug=${linkItem.slug}:`, e);
        }
        return null;
      });

      const chunkResults = await Promise.all(promises);
      
      setLinks(prevLinks => {
        const updated = [...prevLinks];
        chunkResults.forEach(r => {
          if (r && r.data) {
            successCount++;
            const idx = updated.findIndex(l => l.id === r.id);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                title: r.data.title || updated[idx].title,
                posterUrl: r.data.posterUrl || updated[idx].posterUrl,
                sources: r.data.sources || updated[idx].sources,
                hostType: r.data.hostType || updated[idx].hostType,
                updatedAt: new Date().toISOString()
              };
            }
          }
        });
        return updated;
      });

      setBatchProgress({ current: Math.min((chunkIdx + 1) * chunkSize, idsArray.length), total: idsArray.length });
    }

    setIsBatchParsing(false);
    setSelectedIds(new Set());
    toast({
      title: 'Batch Parse Selesai',
      description: `Berhasil memperbarui ${successCount} dari ${idsArray.length} video langsung ke database.`,
    });
  };

  // Logika Filter Pencarian Fleksibel
  const filteredLinks = links.filter((link) => {
    const rawQuery = searchTerm.toLowerCase().trim();

    // 1. Text Search Filter
    if (rawQuery) {
      const cleanQuery = rawQuery.replace(/[^a-z0-9]/g, '');
      const normalize = (text) => (text ? text.toLowerCase().replace(/[^a-z0-9]/g, '') : '');

      const titleClean = normalize(link.title);
      const slugClean = normalize(link.slug);
      const urlClean = normalize(link.originalUrl);

      const matchesSearch =
        titleClean.includes(cleanQuery) ||
        slugClean.includes(cleanQuery) ||
        urlClean.includes(cleanQuery) ||
        (link.title && link.title.toLowerCase().includes(rawQuery)) ||
        (link.slug && link.slug.toLowerCase().includes(rawQuery)) ||
        (link.originalUrl && link.originalUrl.toLowerCase().includes(rawQuery));

      if (!matchesSearch) return false;
    }

    // 2. Provider Dropdown Filter
    if (selectedProvider === 'all') return true;

    const detected = link.hostType || detectProvider(link.originalUrl);
    if (selectedProvider === 'ok' || selectedProvider === 'okru') {
      return detected === 'ok' || detected === 'okru';
    }
    return detected === selectedProvider;
  });

  const getCountByProvider = (providerKey) => {
    return links.filter(l => {
      const d = l.hostType || detectProvider(l.originalUrl);
      if (providerKey === 'ok' || providerKey === 'okru') return d === 'ok' || d === 'okru';
      return d === providerKey;
    }).length;
  };

  const streamtapeCount = getCountByProvider('streamtape');
  const doodCount = getCountByProvider('doodstream');
  const luluCount = getCountByProvider('lulustream');
  const vidaraCount = getCountByProvider('vidara');
  const mp4uploadCount = getCountByProvider('mp4upload');
  const turboViCount = getCountByProvider('turboviplay');
  const turboNewCount = getCountByProvider('turbonewvid');
  const fc2Count = getCountByProvider('fc2stream');
  const vkCount = getCountByProvider('vk');
  const okCount = getCountByProvider('okru');
  const sibnetCount = getCountByProvider('sibnet');

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Video Stream Links</h1>
          <p className="text-muted-foreground mt-1">
            Kelola link proxy video Streamtape, Doodstream, LuluStream, Vidara, MP4Upload, TurboViPlay, TurboNewVid, FC2Stream, VK, OK.ru & Sibnet
          </p>
        </div>
        <Link href="/dashboard/links/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-medium">
            <Plus className="h-5 w-5" />
            Tambah Link Baru
          </Button>
        </Link>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Total Video</CardTitle>
            <Film className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div data-testid="total-videos-count" className="text-2xl font-bold">{links.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Semua provider</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-indigo-500">Streamtape</CardTitle>
            <Film className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div data-testid="streamtape-count" className="text-2xl font-bold text-indigo-500">{streamtapeCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">streamtape.com (/e/, /v/)</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-amber-500">TurboNewVid</CardTitle>
            <Play className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div data-testid="turbonewvid-count" className="text-2xl font-bold text-amber-500">{turboNewCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">turbonewvid.com/t/</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-rose-500">FC2Stream</CardTitle>
            <Tv className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div data-testid="fc2stream-count" className="text-2xl font-bold text-rose-500">{fc2Count}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">fc2stream.tv</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-orange-500">Dood & Lulu</CardTitle>
            <Video className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-orange-500">{doodCount + luluCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Dood: {doodCount} | Lulu: {luluCount}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
            <CardTitle className="text-xs font-semibold text-blue-500">VK, OK & Sibnet</CardTitle>
            <Video className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-500">{vkCount + okCount + sibnetCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">VK: {vkCount} | OK: {okCount} | Sib: {sibnetCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main List Area */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Semua Video</CardTitle>
          <CardDescription>Daftar semua link video yang terdaftar di database</CardDescription>
          
          {/* Search Bar & Dropdown Filter */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <Input
                type="text"
                placeholder="Cari berdasarkan judul, slug, atau URL asli (Streamtape, TurboNewVid, FC2, VK, dll)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border text-foreground w-full"
                disabled={isBatchParsing}
              />
            </div>

            {/* Provider Dropdown Filter */}
            <div className="w-full sm:w-64 shrink-0">
              <select
                id="provider-filter"
                data-testid="provider-filter-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={isBatchParsing}
                className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Provider (Default)</option>
                <option value="streamtape">Streamtape (streamtape.com)</option>
                <option value="turbonewvid">TurboNewVid (turbonewvid.com/t/)</option>
                <option value="fc2stream">FC2Stream (fc2stream.tv)</option>
                <option value="doodstream">DoodStream (doodstream.com)</option>
                <option value="lulustream">LuluStream / Lulust</option>
                <option value="vidara">Vidara (vidara.so)</option>
                <option value="mp4upload">MP4Upload (mp4upload.com)</option>
                <option value="turboviplay">TurboViPlay (turboviplay.com)</option>
                <option value="vk">VK Video (vk.com, vkvideo.ru)</option>
                <option value="okru">OK.ru (ok.ru)</option>
                <option value="sibnet">Sibnet (sibnet.ru)</option>
                <option value="other">Direct Stream / Lainnya</option>
              </select>
            </div>
          </div>

          {/* Batch Actions Panel */}
          {selectedIds.size > 0 && !isBatchParsing && (
            <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in slide-in-from-top-4 duration-200">
              <div className="text-sm font-medium">
                Terpilih <span className="text-primary font-bold">{selectedIds.size}</span> dari <span className="font-bold">{filteredLinks.length}</span> video
              </div>
              <Button
                onClick={handleBatchParse}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-medium self-end sm:self-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Parse Ulang Batch
              </Button>
            </div>
          )}

          {/* Progress Bar */}
          {isBatchParsing && (
            <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  Sedang memproses parse ulang batch...
                </span>
                <span>{batchProgress.current} / {batchProgress.total} Selesai</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Film className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-border rounded-lg bg-background/50">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg text-foreground">Tidak ada video</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1">
                {searchTerm || selectedProvider !== 'all' ? 'Tidak ada video yang cocok dengan kriteria pencarian atau filter provider.' : 'Silakan tambahkan video pertama Anda dengan mengklik tombol "Tambah Link Baru" di atas.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="pb-3 pt-1 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredLinks.length && filteredLinks.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary accent-primary cursor-pointer"
                        disabled={isBatchParsing}
                      />
                    </th>
                    <th className="pb-3 pt-1">Video Info</th>
                    <th className="pb-3 pt-1">Slug / Player Link</th>
                    <th className="pb-3 pt-1">Sources & Subtitles</th>
                    <th className="pb-3 pt-1">Tanggal Buat</th>
                    <th className="pb-3 pt-1 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredLinks.map((link) => {
                    const hostType = link.hostType || detectProvider(link.originalUrl);
                    const providerInfo = getProviderInfo(hostType);
                    const playerLink = typeof window !== 'undefined' ? `${window.location.origin}/v/${link.slug}` : `/v/${link.slug}`;
                    const subtitlesCount = link.subtitles?.length || 0;

                    return (
                      <tr key={link.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(link.id) ? 'bg-primary/5 hover:bg-primary/10' : ''}`}>
                        {/* Checkbox */}
                        <td className="py-4 pr-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(link.id)}
                            onChange={() => handleSelectRow(link.id)}
                            className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary accent-primary cursor-pointer"
                            disabled={isBatchParsing}
                          />
                        </td>
                        {/* Video Info (Image + Title + Provider Badge) */}
                        <td className="py-4 pr-3 max-w-[280px]">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-20 flex-shrink-0 bg-muted rounded border border-border overflow-hidden">
                              {link.posterUrl ? (
                                <img
                                  src={link.posterUrl}
                                  alt={link.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full w-full bg-muted text-muted-foreground">
                                  <Film className="h-5 w-5" />
                                </div>
                              )}
                              <span className={`absolute bottom-0.5 right-1 text-[9px] font-bold px-1.5 py-0.25 rounded border ${providerInfo.badgeColor}`}>
                                {providerInfo.name}
                              </span>
                            </div>
                            <div className="truncate flex flex-col">
                              <span className="font-semibold text-foreground truncate max-w-[200px]" title={link.title}>
                                {link.title}
                              </span>
                              <a
                                href={link.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary hover:underline truncate flex items-center gap-1 mt-0.5"
                              >
                                {providerInfo.name} Link <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* Slug / Player Link */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-bold text-foreground">
                              {link.slug}
                            </code>
                            <Button
                              onClick={() => handleCopy(playerLink, link.slug)}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              {copiedSlug === link.slug ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>

                        {/* Sources & Subtitles */}
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1">
                              {link.sources?.map((s, i) => (
                                <span
                                  key={i}
                                  className="bg-muted text-foreground border border-border text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                                >
                                  {s.label}
                                </span>
                              ))}
                            </div>
                            {subtitlesCount > 0 && (
                              <span className="text-[11px] text-primary flex items-center gap-1 font-medium mt-0.5">
                                <Subtitles className="h-3 w-3" /> {subtitlesCount} Subtitle
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-3 text-muted-foreground text-xs whitespace-nowrap">
                          {link.createdAt ? new Date(link.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/v/${link.slug}`} target="_blank">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                title="Buka Video Player"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/links/edit/${link.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Edit Link & Subtitle"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleDelete(link.id, link.title)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Hapus Video"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
