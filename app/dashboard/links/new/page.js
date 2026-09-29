'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Video, Upload, Copy, Check, Info, Film, Sparkles, 
  Plus, Trash2, Subtitles, Globe, Download, ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { detectProvider, getProviderInfo } from '@/lib/parser';

export default function NewLinkPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [sources, setSources] = useState([]);
  const [resultType, setResultType] = useState('video');
  const [embedUrl, setEmbedUrl] = useState('');
  
  // Dynamic Subtitles State
  const [subtitles, setSubtitles] = useState([]);
  const [uploadingSubIndex, setUploadingSubIndex] = useState(null);

  const [parsing, setParsing] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // States for output card copies
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedPlayer, setCopiedPlayer] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedDownload, setCopiedDownload] = useState(false);
  const [copiedSpecificQuality, setCopiedSpecificQuality] = useState('');
  const [outputQuality, setOutputQuality] = useState('720');

  const [domain, setDomain] = useState('localhost:3000');
  const [cdnUrl, setCdnUrl] = useState('');
  const [downloadCdnUrl, setDownloadCdnUrl] = useState('');
  const [isCustomDownloadCdnEnabled, setIsCustomDownloadCdnEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDomain(window.location.host);
    }
  }, []);

  // Fetch CDN configuration setting on mount
  useEffect(() => {
    async function loadCdnSettings() {
      try {
        const res = await fetch('/api/settings', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.general?.cdnUrl) {
            setCdnUrl(data.general.cdnUrl.replace(/\/+$/, ''));
          }
          if (data.general?.downloadCdnUrl) {
            setDownloadCdnUrl(data.general.downloadCdnUrl.replace(/\/+$/, ''));
          }
          if (data.general?.isCustomDownloadCdnEnabled !== undefined) {
            setIsCustomDownloadCdnEnabled(!!data.general.isCustomDownloadCdnEnabled);
          }
        }
      } catch (e) {
        console.error('Failed to load CDN setting:', e);
      }
    }
    loadCdnSettings();
  }, []);

  const handleParse = async () => {
    if (!originalUrl) {
      toast({
        title: 'URL kosong',
        description: 'Silakan masukkan URL VK Video, OK.ru, atau Sibnet terlebih dahulu.',
        variant: 'destructive',
      });
      return;
    }

    setParsing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl }),
      });

      const data = await res.json();

      if (res.ok) {
        setTitle(data.title || '');
        if (data.posterUrl) {
          setPosterUrl(data.posterUrl);
        }
        setSources(data.sources || []);
        setResultType(data.type || (data.sources?.[0]?.type === 'embed' ? 'embed' : 'video'));
        setEmbedUrl(data.embedUrl || '');
        
        if (data.sources && data.sources.length > 0) {
          const firstLabel = data.sources[0].label.replace(/[^0-9]/g, '');
          if (firstLabel) {
            setOutputQuality(firstLabel);
          }
        }

        toast({
          title: 'Parsing Berhasil!',
          description: data.type === 'embed' 
            ? 'Player embed berhasil dideteksi dan siap disematkan.'
            : `Ditemukan ${data.sources?.length || 0} stream video dan tautan unduhan langsung siap digunakan.`,
        });
      } else {
        toast({
          title: 'Parsing Gagal',
          description: data.error || 'Gagal mengekstrak video metadata.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Parsing Error',
        description: 'Koneksi ke parser endpoint gagal.',
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  };

  const handlePosterUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPoster(true);
    try {
      const authRes = await fetch('/api/imagekit-auth', { credentials: 'include' });
      if (!authRes.ok) {
        throw new Error('Gagal mendapatkan kredensial ImageKit. Silakan periksa dashboard settings Anda.');
      }
      const authData = await authRes.json();

      if (!authData.publicKey || !authData.signature || !authData.token) {
        throw new Error('Kredensial ImageKit tidak lengkap di pengaturan.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('publicKey', authData.publicKey);
      formData.append('signature', authData.signature);
      formData.append('token', authData.token);
      formData.append('expire', authData.expire);

      const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (uploadRes.ok && uploadData.url) {
        setPosterUrl(uploadData.url);
        toast({
          title: 'Poster Berhasil Diupload!',
          description: 'URL poster telah diperbarui.',
        });
      } else {
        throw new Error(uploadData.message || 'ImageKit mengembalikan respons error.');
      }
    } catch (err) {
      toast({
        title: 'Upload Gagal',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleAddSubtitle = () => {
    setSubtitles(prev => [
      ...prev,
      { label: prev.length === 0 ? 'Indonesian' : (prev.length === 1 ? 'English' : ''), file: '' }
    ]);
  };

  const handleRemoveSubtitle = (index) => {
    setSubtitles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubtitleChange = (index, field, value) => {
    setSubtitles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubtitleUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSubIndex(index);
    try {
      const authRes = await fetch('/api/imagekit-auth', { credentials: 'include' });
      if (!authRes.ok) {
        throw new Error('Gagal mendapatkan kredensial ImageKit. Periksa dashboard settings.');
      }
      const authData = await authRes.json();

      if (!authData.publicKey || !authData.signature || !authData.token) {
        throw new Error('Kredensial ImageKit tidak lengkap di pengaturan.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('publicKey', authData.publicKey);
      formData.append('signature', authData.signature);
      formData.append('token', authData.token);
      formData.append('expire', authData.expire);

      const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (uploadRes.ok && uploadData.url) {
        handleSubtitleChange(index, 'file', uploadData.url);
        
        if (!subtitles[index]?.label) {
          const fileNameLower = file.name.toLowerCase();
          let autoLabel = 'Subtitle';
          if (fileNameLower.includes('ind') || fileNameLower.includes('id')) autoLabel = 'Indonesian';
          else if (fileNameLower.includes('eng') || fileNameLower.includes('en')) autoLabel = 'English';
          else if (fileNameLower.includes('jap') || fileNameLower.includes('jp')) autoLabel = 'Japanese';
          handleSubtitleChange(index, 'label', autoLabel);
        }

        toast({
          title: 'Subtitle Berhasil Diupload!',
          description: `File "${file.name}" berhasil diunggah ke ImageKit.`,
        });
      } else {
        throw new Error(uploadData.message || 'ImageKit mengembalikan respons error.');
      }
    } catch (err) {
      toast({
        title: 'Upload Subtitle Gagal',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingSubIndex(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !originalUrl || sources.length === 0) {
      toast({
        title: 'Formulir belum lengkap',
        description: 'Pastikan Anda telah melakukan "Parse Video" dan memiliki daftar source stream.',
        variant: 'destructive',
      });
      return;
    }

    const validSubtitles = subtitles
      .map(s => ({ label: (s.label || 'Subtitle').trim(), file: s.file.trim() }))
      .filter(s => s.file);

    setSubmitting(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          slug: slug.trim() || undefined,
          originalUrl,
          posterUrl,
          sources,
          subtitles: validSubtitles,
          type: resultType,
          embedUrl: embedUrl || (sources[0]?.type === 'embed' ? sources[0].file : '')
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Link video ditambahkan!',
          description: `Video "${title}" berhasil disimpan.`,
        });
        router.push('/dashboard');
      } else {
        toast({
          title: 'Gagal Menyimpan',
          description: data.error || 'Terjadi kesalahan saat menyimpan video link.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error Koneksi',
        description: 'Gagal mengirim permintaan ke server.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyText = (text, type, extraId = '') => {
    navigator.clipboard.writeText(text);
    if (type === 'direct') {
      setCopiedDirect(true);
      setTimeout(() => setCopiedDirect(false), 2000);
    } else if (type === 'player') {
      setCopiedPlayer(true);
      setTimeout(() => setCopiedPlayer(false), 2000);
    } else if (type === 'embed') {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } else if (type === 'download') {
      setCopiedDownload(true);
      setTimeout(() => setCopiedDownload(false), 2000);
    } else if (type === 'specific-quality') {
      setCopiedSpecificQuality(extraId);
      setTimeout(() => setCopiedSpecificQuality(''), 2000);
    }
    toast({
      title: 'Disalin!',
      description: 'Berhasil disalin ke clipboard.',
    });
  };

  const displaySlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || '[slug]';
  const playerLink = `https://${domain}/v/${displaySlug}`;
  const embedCode = `<iframe src="https://${domain}/v/${displaySlug}" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen style="border:0; overflow:hidden; width:100%; height:100%;"></iframe>`;

  const streamHost = cdnUrl || `https://${domain}`;
  const downloadHost = (isCustomDownloadCdnEnabled && downloadCdnUrl) ? downloadCdnUrl : (cdnUrl || `https://${domain}`);

  let directStreamLink = `${streamHost}/api/stream/${outputQuality}/${displaySlug}.mp4`;
  let directDownloadLink = `${downloadHost}/api/download/${outputQuality}/${displaySlug}.mp4`;

  if (sources && sources.length > 0) {
    const matchingSource = sources.find(s => s.label.toLowerCase().includes(outputQuality));
    if (matchingSource) {
      directStreamLink = matchingSource.file.startsWith('/') 
        ? `${streamHost}${matchingSource.file}` 
        : matchingSource.file;
    } else {
      directStreamLink = sources[0].file.startsWith('/') 
        ? `${streamHost}${sources[0].file}` 
        : sources[0].file;
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Back Button */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Link
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Tambah Link Video Baru</h1>
        <p className="text-muted-foreground mt-1">
          Masukkan URL VK, OK.ru, atau Sibnet, parse streamnya, atur subtitle, dan dapatkan link embed serta direct download generator instan
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Add Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Metadata Video</CardTitle>
                <CardDescription>Masukkan detail, stream source, dan subtitle video Anda</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* 1. Original URL */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="originalUrl">URL Video Provider</Label>
                    {originalUrl.trim() && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${getProviderInfo(detectProvider(originalUrl)).badgeColor}`}>
                        ⚡ Terdeteksi: {getProviderInfo(detectProvider(originalUrl)).name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="originalUrl"
                      data-testid="original-url-input"
                      type="url"
                      placeholder="e.g. https://streamtape.com/e/..., https://turbonewvid.com/t/..., https://fc2stream.tv/..., https://doodstream.com/e/..., https://lulustream.com/e/..."
                      value={originalUrl}
                      onChange={(e) => setOriginalUrl(e.target.value)}
                      className="bg-background border-border text-foreground font-mono text-xs"
                      required
                    />
                    <Button
                      type="button"
                      data-testid="parse-video-btn"
                      onClick={handleParse}
                      disabled={parsing}
                      className="bg-primary text-primary-foreground font-medium shrink-0"
                    >
                      {parsing ? 'Parsing...' : 'Parse Video'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mendukung domain: <strong className="text-foreground">Streamtape</strong> (streamtape.com /e/, /v/), <strong className="text-foreground">TurboNewVid</strong> (turbonewvid.com/t/), <strong className="text-foreground">FC2Stream</strong> (fc2stream.tv), <strong className="text-foreground">DoodStream</strong> (doodstream.com), <strong className="text-foreground">LuluStream</strong> (lulustream.com, lulust.com), <strong className="text-foreground">Vidara</strong> (vidara.so), <strong className="text-foreground">MP4Upload</strong> (mp4upload.com), <strong className="text-foreground">TurboViPlay</strong> (turboviplay.com), <strong className="text-foreground">VK Video</strong>, <strong className="text-foreground">OK.ru</strong>, & <strong className="text-foreground">Sibnet</strong>.
                  </p>
                </div>

                {/* 2. Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Judul Video</Label>
                  <Input
                    id="title"
                    data-testid="video-title-input"
                    type="text"
                    placeholder="Judul video terpopuler..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>

                {/* 3. Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug">Custom Slug (Opsional)</Label>
                  <Input
                    id="slug"
                    data-testid="video-slug-input"
                    type="text"
                    placeholder="e.g. video-terbaru-2025"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="bg-background border-border text-foreground font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Biarkan kosong untuk membuat slug acak unik secara otomatis.
                  </p>
                </div>

                {/* 4. Poster Image */}
                <div className="space-y-2">
                  <Label htmlFor="posterUrl">URL Poster / Thumbnail</Label>
                  <div className="space-y-3">
                    <Input
                      id="posterUrl"
                      type="text"
                      placeholder="e.g. https://ik.imagekit.io/..."
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                    
                    {/* ImageKit Upload Field */}
                    <div className="flex items-center gap-4">
                      <Label
                        htmlFor="poster-file"
                        className="flex items-center gap-2 cursor-pointer border border-dashed border-border hover:bg-muted hover:border-primary/50 rounded-lg p-3 text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingPoster ? 'Mengupload ke ImageKit...' : 'Upload Thumbnail via ImageKit'}
                        <input
                          id="poster-file"
                          type="file"
                          accept="image/*"
                          onChange={handlePosterUpload}
                          disabled={uploadingPoster}
                          className="hidden"
                        />
                      </Label>
                      {posterUrl && (
                        <div className="h-10 w-16 bg-muted rounded border border-border overflow-hidden shrink-0">
                          <img src={posterUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Subtitle Video (Opsional) */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Subtitles className="h-4 w-4 text-primary" /> Subtitle Video (Opsional)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tambahkan track subtitle (.vtt / .srt) untuk ditampilkan otomatis di JWPlayer & Video.js
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddSubtitle}
                      className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah Subtitle
                    </Button>
                  </div>

                  {subtitles.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-4 bg-muted/40 rounded-lg border border-dashed border-border text-center flex flex-col items-center justify-center gap-2">
                      <Subtitles className="h-6 w-6 text-muted-foreground/60" />
                      <span>Belum ada subtitle yang ditambahkan. Klik &quot;+ Tambah Subtitle&quot; untuk menambahkan file teks (.vtt atau .srt).</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {subtitles.map((sub, index) => (
                        <div 
                          key={index} 
                          className="p-4 rounded-lg bg-muted/30 border border-border space-y-3 relative group animate-in fade-in-50 duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <Globe className="h-3.5 w-3.5" /> Subtitle #{index + 1}
                              {index === 0 && (
                                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.2 rounded font-medium ml-1">
                                  Default Aktif
                                </span>
                              )}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubtitle(index)}
                              className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
                              title="Hapus baris subtitle ini"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground font-medium">Label / Bahasa</Label>
                              <Input
                                type="text"
                                placeholder='Contoh: "Indonesian", "English"'
                                value={sub.label}
                                onChange={(e) => handleSubtitleChange(index, 'label', e.target.value)}
                                className="bg-background border-border text-foreground text-xs"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground font-medium">URL Subtitle (.vtt / .srt)</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="https://example.com/sub-id.vtt atau URL ImageKit"
                                  value={sub.file}
                                  onChange={(e) => handleSubtitleChange(index, 'file', e.target.value)}
                                  className="bg-background border-border text-foreground text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <Label
                              htmlFor={`sub-upload-${index}`}
                              className="flex items-center gap-1.5 cursor-pointer bg-background hover:bg-muted border border-border hover:border-primary/50 rounded-md px-3 py-1.5 text-xs font-medium transition-all text-muted-foreground hover:text-foreground"
                            >
                              <Upload className="h-3.5 w-3.5 text-primary" />
                              {uploadingSubIndex === index ? 'Mengupload Subtitle...' : 'Upload Subtitle via ImageKit'}
                              <input
                                id={`sub-upload-${index}`}
                                type="file"
                                accept=".vtt,.srt,.txt,text/vtt,text/plain"
                                onChange={(e) => handleSubtitleUpload(index, e)}
                                disabled={uploadingSubIndex !== null}
                                className="hidden"
                              />
                            </Label>
                            {sub.file && (
                              <span className="text-[11px] text-green-500 font-medium flex items-center gap-1 truncate max-w-[280px]">
                                <Check className="h-3 w-3 shrink-0" /> Siap digunakan
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddSubtitle}
                        className="w-full text-xs font-semibold gap-1.5 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground py-2"
                      >
                        <Plus className="h-3.5 w-3.5" /> + Tambah Subtitle Lainnya
                      </Button>
                    </div>
                  )}
                </div>

                {/* 6. Sources List (Parsed) */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Film className="h-4 w-4 text-primary" /> Stream Sources ({sources.length})
                  </Label>
                  {sources.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-4 bg-muted/50 rounded-lg border border-border text-center">
                      Belum ada stream source. Klik &quot;Parse Video&quot; untuk memuat sources secara otomatis.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto border border-border rounded-lg p-3 bg-background/50">
                      {sources.map((src, index) => (
                        <div key={index} className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border">
                          <div className="truncate pr-4 flex flex-col">
                            <span className="text-xs font-mono font-bold text-foreground truncate max-w-[320px]">{src.file}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">{src.type}</span>
                          </div>
                          <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded">
                            {src.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border pt-6">
                <Link href="/dashboard">
                  <Button variant="ghost" type="button">Batal</Button>
                </Link>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || parsing || uploadingPoster || uploadingSubIndex !== null}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Link Video'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right column: Embed Card Generator & Direct Download Output */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-card shadow-md sticky top-6">
            <CardHeader className="bg-primary/5 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Sparkles className="h-5 w-5 text-primary" /> Output Code Generator
              </CardTitle>
              <CardDescription>
                Card ini menghasilkan link streaming proxy, link player, iFrame embed, dan tautan direct download instan secara real-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Output Quality Selector */}
              <div className="space-y-2">
                <Label htmlFor="out-quality" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quality Direct Link</Label>
                <select
                  id="out-quality"
                  data-testid="quality-direct-link-select"
                  value={outputQuality}
                  onChange={(e) => setOutputQuality(e.target.value)}
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:ring-primary focus:border-primary font-medium"
                >
                  <option value="1080">1080p Full HD</option>
                  <option value="720">720p HD</option>
                  <option value="480">480p SD</option>
                  <option value="360">360p Low</option>
                  <option value="240">240p Lowest</option>
                </select>
              </div>

              {/* 1. Direct Stream Link */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Direct Stream Link</span>
                  <Button
                    onClick={() => handleCopyText(directStreamLink, 'direct')}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1"
                  >
                    {copiedDirect ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copiedDirect ? 'Disalin!' : 'Salin'}
                  </Button>
                </div>
                <div className="bg-muted border border-border rounded-lg p-3 relative group">
                  <code className="block text-xs font-mono font-bold text-foreground break-all leading-relaxed whitespace-pre-wrap select-all">
                    {directStreamLink}
                  </code>
                </div>
              </div>

              {/* 2. Player Link */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Player Link</span>
                  <Button
                    onClick={() => handleCopyText(playerLink, 'player')}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1"
                  >
                    {copiedPlayer ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copiedPlayer ? 'Disalin!' : 'Salin'}
                  </Button>
                </div>
                <div className="bg-muted border border-border rounded-lg p-3 relative group">
                  <code className="block text-xs font-mono font-bold text-foreground break-all leading-relaxed whitespace-pre-wrap select-all">
                    {playerLink}
                  </code>
                </div>
              </div>

              {/* 3. Embed iFrame Code */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">3. Embed iFrame Code</span>
                  <Button
                    onClick={() => handleCopyText(embedCode, 'embed')}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1"
                  >
                    {copiedEmbed ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copiedEmbed ? 'Disalin!' : 'Salin'}
                  </Button>
                </div>
                <div className="bg-muted border border-border rounded-lg p-3 relative group">
                  <code className="block text-xs font-mono font-bold text-foreground break-all leading-relaxed whitespace-pre-wrap select-all">
                    {embedCode}
                  </code>
                </div>
              </div>

              {/* 4. DIRECT DOWNLOAD LINK (ENHANCED FEATURE) */}
              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="flex justify-between items-center">
                  <span 
                    data-testid="direct-download-heading"
                    className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" /> 4. DIRECT DOWNLOAD LINK
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleCopyText(directDownloadLink, 'download')}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1"
                      data-testid="copy-download-link-btn"
                    >
                      {copiedDownload ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      {copiedDownload ? 'Disalin!' : 'Salin'}
                    </Button>
                    <a
                      href={directDownloadLink}
                      target="_blank"
                      rel="noreferrer"
                      className="h-7 px-2 text-xs font-semibold inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                      title="Download langsung ke perangkat"
                    >
                      <Download className="h-3 w-3" /> Unduh
                    </a>
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-lg p-3 relative group">
                  <code 
                    data-testid="direct-download-link-output"
                    className="block text-xs font-mono font-bold text-foreground break-all leading-relaxed whitespace-pre-wrap select-all"
                  >
                    {directDownloadLink}
                  </code>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Link unduhan langsung {isCustomDownloadCdnEnabled && downloadCdnUrl ? '(Dedicated Download CDN)' : '(Stream CDN)'} berkecepatan tinggi dengan auto Content-Disposition attachment untuk kualitas <strong className="text-foreground">{outputQuality}p</strong>.
                </p>

                {/* Multiple Quality Support (Dynamic Buttons per available source) */}
                {sources && sources.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Multi-Quality Direct Download ({sources.length} Kualitas):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sources.map((s, idx) => {
                        const qLabel = s.label.replace(/[^0-9]/g, '') || s.label;
                        const qualityLink = `${downloadHost}/api/download/${qLabel}/${displaySlug}.mp4`;
                        const isCopied = copiedSpecificQuality === s.label;

                        return (
                          <div key={idx} className="flex items-center bg-background border border-border rounded-md p-1 gap-1 text-xs">
                            <a
                              href={qualityLink}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-primary hover:underline px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" /> {s.label}
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyText(qualityLink, 'specific-quality', s.label)}
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title={`Salin link download ${s.label}`}
                            >
                              {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-muted/40 rounded-lg p-3 border border-border/50 flex gap-2.5 items-start">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Sinyal event kustom <code className="bg-muted px-1 rounded font-mono font-semibold">SHINDORA_VIDEO_ENDED</code> akan dipancarkan ketika pemutaran video selesai. Cocok untuk sinkronisasi player atau pelacakan analytics.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
