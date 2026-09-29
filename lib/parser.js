import { getDb } from './db.js';

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export function cleanVkUrl(urlStr) {
  if (!urlStr) return '';
  return urlStr
    .replace(/\\\/_/g, '_')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\x26/g, '&');
}

export function cleanOkUrl(urlStr) {
  if (!urlStr) return '';
  return decodeHtmlEntities(urlStr).replace(/\\\//g, '/');
}

export function convertSrtToVtt(srtContent) {
  if (!srtContent) return 'WEBVTT\n\n';
  if (srtContent.trim().startsWith('WEBVTT')) return srtContent;
  let normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalized = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${normalized.trim()}\n`;
}

/**
 * Detect Provider / Host Type from URL
 */
export function detectProvider(url) {
  if (!url) return 'other';
  const lower = url.toLowerCase().trim();

  // 1. Streamtape (streamtape.com, streamta.pe, streamtape.to, streamtape.net, streamtape.xyz)
  if (lower.includes('streamtape.com') || lower.includes('streamta.pe') || lower.includes('streamtape.to') || lower.includes('streamtape.net') || lower.includes('streamtape.xyz')) {
    return 'streamtape';
  }

  // 2. Doodstream (doodstream.com, dood.to, dood.so, dood.la, dood.ws, dood.sh, dood.pm, dood.cx, ds2play.com, dood.*)
  if (lower.includes('doodstream.com') || lower.includes('dood.to') || lower.includes('dood.so') || lower.includes('dood.la') || lower.includes('dood.ws') || lower.includes('dood.sh') || lower.includes('dood.pm') || lower.includes('dood.cx') || lower.includes('ds2play.com') || /dood\.[a-z]{2,5}/i.test(lower)) {
    return 'doodstream';
  }

  // 3. LuluStream / Lulust (lulustream.com, lulust.com, lulu.*)
  if (lower.includes('lulustream.com') || lower.includes('lulust.com') || /lulu\.[a-z]{2,5}/i.test(lower)) {
    return 'lulustream';
  }

  // 4. Vidara (vidara.so, vidara.*)
  if (lower.includes('vidara.so') || /vidara\.[a-z]{2,5}/i.test(lower)) {
    return 'vidara';
  }

  // 5. MP4Upload (mp4upload.com)
  if (lower.includes('mp4upload.com')) {
    return 'mp4upload';
  }

  // 6. TurboViPlay (turboviplay.com, turboviplay.*)
  if (lower.includes('turboviplay.com') || /turboviplay\.[a-z]{2,5}/i.test(lower)) {
    return 'turboviplay';
  }

  // 7. TurboNewVid (turbonewvid.com, turbonewvid.com/t/)
  if (lower.includes('turbonewvid.com')) {
    return 'turbonewvid';
  }

  // 8. FC2Stream (fc2stream.tv)
  if (lower.includes('fc2stream.tv')) {
    return 'fc2stream';
  }

  // 9. VK Video
  if (lower.includes('vk.com') || lower.includes('vk.ru') || lower.includes('vkvideo.ru')) {
    return 'vk';
  }

  // 10. OK.ru
  if (lower.includes('ok.ru') || lower.includes('odnoklassniki.ru')) {
    return 'okru';
  }

  // 11. Sibnet
  if (lower.includes('sibnet.ru')) {
    return 'sibnet';
  }

  return 'other';
}

/**
 * Get Provider Metadata & Badges
 */
export function getProviderInfo(hostType) {
  const providers = {
    streamtape: {
      name: 'Streamtape',
      badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      icon: 'film',
      sampleUrl: 'https://streamtape.com/e/xYZ12345678'
    },
    doodstream: {
      name: 'DoodStream',
      badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      icon: 'video',
      sampleUrl: 'https://doodstream.com/e/abc123456'
    },
    lulustream: {
      name: 'LuluStream',
      badgeColor: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      icon: 'sparkles',
      sampleUrl: 'https://lulustream.com/e/lulu12345'
    },
    vidara: {
      name: 'Vidara',
      badgeColor: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      icon: 'globe',
      sampleUrl: 'https://vidara.so/e/vid12345'
    },
    mp4upload: {
      name: 'MP4Upload',
      badgeColor: 'bg-green-500/10 text-green-500 border-green-500/20',
      icon: 'upload',
      sampleUrl: 'https://www.mp4upload.com/embed-mp41234.html'
    },
    turboviplay: {
      name: 'TurboViPlay',
      badgeColor: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      icon: 'zap',
      sampleUrl: 'https://turboviplay.com/e/turb12345'
    },
    turbonewvid: {
      name: 'TurboNewVid',
      badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      icon: 'play',
      sampleUrl: 'https://turbonewvid.com/t/newvid123'
    },
    fc2stream: {
      name: 'FC2Stream',
      badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      icon: 'tv',
      sampleUrl: 'https://fc2stream.tv/fc2_12345'
    },
    vk: {
      name: 'VK Video',
      badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      icon: 'radio',
      sampleUrl: 'https://vkvideo.ru/video-241161797_456239017'
    },
    okru: {
      name: 'OK.ru',
      badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      icon: 'video',
      sampleUrl: 'https://ok.ru/video/7539075713601'
    },
    ok: {
      name: 'OK.ru',
      badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      icon: 'video',
      sampleUrl: 'https://ok.ru/video/7539075713601'
    },
    sibnet: {
      name: 'Sibnet',
      badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      icon: 'film',
      sampleUrl: 'https://video.sibnet.ru/video1234567'
    },
    other: {
      name: 'Direct Video',
      badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      icon: 'link',
      sampleUrl: 'https://domain.com/video.mp4'
    }
  };

  return providers[hostType] || providers.other;
}

/**
 * Extract live video streams or embed URLs from supported video providers
 * Complies with Classification: type="video" | "embed" | "redirect"
 */
export async function extractVideoStreams(url, customVkToken = '') {
  if (!url) {
    throw new Error('URL is required');
  }

  const cleanUrl = url.trim();
  const hostType = detectProvider(cleanUrl);

  let title = 'Parsed Video';
  let posterUrl = '';
  let embedUrl = cleanUrl;
  let streamUrl = null;
  let resultType = 'video';
  const sources = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // ==========================================================
  // 1. STREAMTAPE (streamtape.com /e/, /v/, /code, streamta.pe, etc.)
  // ==========================================================
  if (hostType === 'streamtape') {
    const tapeMatch = cleanUrl.match(/streamtape\.[a-z0-9]+\/(?:e\/|v\/)?([a-zA-Z0-9_\-]+)/i) || cleanUrl.match(/streamta\.pe\/(?:e\/|v\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = tapeMatch ? tapeMatch[1] : '';

    if (!videoId) {
      throw new Error('Format URL Streamtape tidak valid.');
    }

    title = `Streamtape Video (${videoId})`;
    embedUrl = `https://streamtape.com/e/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://streamtape.com/',
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        
        // Extract Title
        const titleMatch = html.match(/<meta\s+name="og:title"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                           html.match(/<title>Watch\s+([^<]+)<\/title>/i) ||
                           html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/Streamtape\.com/gi, '').trim());
        }

        // Extract Poster / Thumbnail
        const posterMatch = html.match(/poster="([^"]+)"/i) ||
                            html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (posterMatch?.[1]) {
          posterUrl = posterMatch[1].startsWith('//') ? `https:${posterMatch[1]}` : posterMatch[1];
        }

        // Extract Streamtape Robotlink / Botlink token
        const botMatch = html.match(/document\.getElementById\(['"](?:robotlink|botlink)['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(?['"]([^'"]+)['"]\)?\.substring\((\d+)\)/i) ||
                         html.match(/document\.getElementById\(['"](?:robotlink|botlink)['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*['"]([^'"]+)['"]/i);

        let directMediaUrl = '';
        if (botMatch) {
          const part1 = botMatch[1];
          const part2 = botMatch[2];
          const subIdx = botMatch[3] ? parseInt(botMatch[3], 10) : 0;
          const combined = part1 + part2.substring(subIdx);
          directMediaUrl = combined.startsWith('//') ? `https:${combined}` : (combined.startsWith('http') ? combined : `https://${combined}`);
        }

        if (directMediaUrl && (directMediaUrl.includes('.mp4') || directMediaUrl.includes('streamtape') || directMediaUrl.includes('tapecontent'))) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(directMediaUrl)}&host=streamtape`;
          sources.push({
            file: streamUrl,
            label: '1080p Full HD',
            type: 'video/mp4'
          });
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: 'video/mp4'
          });
        }
      }
    } catch (tapeErr) {
      console.warn('[Streamtape Scraper Warning]:', tapeErr.message);
    }

    if (sources.length === 0) {
      // Return Embed Player Type gracefully without fake HTML stream
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'Streamtape Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 2. DOODSTREAM (doodstream.com, dood.to, dood.so, ds2play.com, etc.)
  // ==========================================================
  else if (hostType === 'doodstream') {
    const doodMatch = cleanUrl.match(/(?:doodstream\.com|dood\.[a-z0-9]+|ds2play\.com)\/(?:e\/|d\/|f\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = doodMatch ? doodMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID DoodStream tidak valid.');
    }

    title = `DoodStream Video (${videoId})`;
    embedUrl = `https://doodstream.com/e/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://doodstream.com/',
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/DoodStream/gi, '').trim());
        }
        const posterMatch = html.match(/poster="([^"]+)"/i) || html.match(/splash="([^"]+)"/i);
        if (posterMatch?.[1]) {
          posterUrl = posterMatch[1].startsWith('//') ? `https:${posterMatch[1]}` : posterMatch[1];
        }

        const passMatch = html.match(/\/pass_md5\/[a-zA-Z0-9_\-\/]+/i);
        if (passMatch) {
          const passUrl = `https://doodstream.com${passMatch[0]}`;
          const passRes = await fetch(passUrl, {
            headers: { ...headers, Referer: embedUrl },
            signal: AbortSignal.timeout(6000),
            cache: 'no-store'
          });
          if (passRes.ok) {
            const rawToken = await passRes.text();
            if (rawToken && rawToken.startsWith('http')) {
              const fullMediaUrl = `${rawToken}token=${videoId}?expiry=${Date.now()}`;
              resultType = 'video';
              streamUrl = `/api/stream?url=${encodeURIComponent(fullMediaUrl)}&host=doodstream`;
              sources.push({
                file: streamUrl,
                label: '720p HD',
                type: 'video/mp4'
              });
            }
          }
        }
      }
    } catch (doodErr) {
      console.warn('[DoodStream Scraper Warning]:', doodErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'DoodStream Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 3. LULUSTREAM / LULUST (lulustream.com, lulust.com, etc.)
  // ==========================================================
  else if (hostType === 'lulustream') {
    const luluMatch = cleanUrl.match(/(?:lulustream\.com|lulust\.com|lulu\.[a-z0-9]+)\/(?:e\/|d\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = luluMatch ? luluMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID LuluStream / Lulust tidak valid.');
    }

    title = `LuluStream Video (${videoId})`;
    embedUrl = `https://lulustream.com/e/${videoId}`;

    try {
      const res = await fetch(cleanUrl.includes('/e/') ? cleanUrl : embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://lulustream.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/LuluStream/gi, '').replace(/Watch\s*/gi, '').trim());
        }
        const posterMatch = html.match(/poster:\s*["']([^"']+)["']/i) || 
                            html.match(/image:\s*["']([^"']+)["']/i) ||
                            html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (posterMatch?.[1]) {
          posterUrl = posterMatch[1].startsWith('//') ? `https:${posterMatch[1]}` : posterMatch[1];
        }

        // Look for direct video / HLS / MP4 URLs
        const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i) || 
                          html.match(/(https?:\/\/[^"']+\.mp4[^"']*)/i) ||
                          html.match(/file:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (m3u8Match?.[1]) {
          const directFile = m3u8Match[1];
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(directFile)}&host=lulustream`;
          sources.push({
            file: streamUrl,
            label: '1080p Full HD',
            type: directFile.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: directFile.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
        }
      }
    } catch (luluErr) {
      console.warn('[LuluStream Scraper Warning]:', luluErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'LuluStream Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 4. VIDARA (vidara.so, vidara.*)
  // ==========================================================
  else if (hostType === 'vidara') {
    const vidaraMatch = cleanUrl.match(/vidara\.[a-z0-9]+\/(?:e\/|v\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = vidaraMatch ? vidaraMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID Vidara tidak valid.');
    }

    title = `Vidara Video (${videoId})`;
    embedUrl = `https://vidara.so/e/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://vidara.so/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/Vidara/gi, '').trim());
        }
        const srcMatch = html.match(/file:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || html.match(/src:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (srcMatch?.[1]) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(srcMatch[1])}&host=vidara`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: srcMatch[1].includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
        }
      }
    } catch (vErr) {
      console.warn('[Vidara Scraper Warning]:', vErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'Vidara Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 5. MP4UPLOAD (mp4upload.com)
  // ==========================================================
  else if (hostType === 'mp4upload') {
    const mp4Match = cleanUrl.match(/mp4upload\.com\/(?:embed-)?([a-zA-Z0-9_\-]+)(?:\.html)?/i);
    const videoId = mp4Match ? mp4Match[1] : '';

    if (!videoId) {
      throw new Error('Format ID MP4Upload tidak valid.');
    }

    title = `MP4Upload Video (${videoId})`;
    embedUrl = `https://www.mp4upload.com/embed-${videoId}.html`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://www.mp4upload.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/MP4Upload/gi, '').trim());
        }
        const srcMatch = html.match(/player\.src\("([^"]+)"\)/i) || html.match(/src:\s*"([^"]+\.mp4[^"]*)"/i);
        if (srcMatch?.[1]) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(srcMatch[1])}&host=mp4upload`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: 'video/mp4'
          });
        }
      }
    } catch (mp4Err) {
      console.warn('[MP4Upload Scraper Warning]:', mp4Err.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'MP4Upload Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 6. TURBOVIPLAY (turboviplay.com, turboviplay.*)
  // ==========================================================
  else if (hostType === 'turboviplay') {
    const turboMatch = cleanUrl.match(/turboviplay\.[a-z0-9]+\/(?:e\/|v\/|t\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = turboMatch ? turboMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID TurboViPlay tidak valid.');
    }

    title = `TurboViPlay Video (${videoId})`;
    embedUrl = `https://turboviplay.com/e/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://turboviplay.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/TurboViPlay/gi, '').trim());
        }
        const srcMatch = html.match(/file:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || html.match(/src:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (srcMatch?.[1]) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(srcMatch[1])}&host=turboviplay`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: srcMatch[1].includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
        }
      }
    } catch (tvpErr) {
      console.warn('[TurboViPlay Scraper Warning]:', tvpErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'TurboViPlay Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 7. TURBONEWVID (turbonewvid.com/t/VIDEO_ID, variations)
  // ==========================================================
  else if (hostType === 'turbonewvid') {
    const tnvMatch = cleanUrl.match(/turbonewvid\.com\/t\/([a-zA-Z0-9_\-]+)/i) || cleanUrl.match(/turbonewvid\.com\/(?:e\/|v\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = tnvMatch ? tnvMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID TurboNewVid tidak valid. Contoh format: https://turbonewvid.com/t/VIDEO_ID');
    }

    title = `TurboNewVid (${videoId})`;
    embedUrl = `https://turbonewvid.com/t/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://turbonewvid.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/TurboNewVid/gi, '').trim());
        }
        const srcMatch = html.match(/src:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || html.match(/file:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (srcMatch?.[1]) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(srcMatch[1])}&host=turbonewvid`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: srcMatch[1].includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
        }
      }
    } catch (tnvErr) {
      console.warn('[TurboNewVid Scraper Warning]:', tnvErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'TurboNewVid Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 8. FC2STREAM (fc2stream.tv, www.fc2stream.tv)
  // ==========================================================
  else if (hostType === 'fc2stream') {
    const fc2Match = cleanUrl.match(/fc2stream\.tv\/(?:e\/|v\/)?([a-zA-Z0-9_\-]+)/i);
    const videoId = fc2Match ? fc2Match[1] : '';

    if (!videoId) {
      throw new Error('Format ID FC2Stream tidak valid. Contoh format: https://fc2stream.tv/VIDEO_ID');
    }

    title = `FC2Stream Video (${videoId})`;
    embedUrl = `https://fc2stream.tv/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          ...headers,
          Referer: 'https://fc2stream.tv/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].replace(/FC2Stream/gi, '').trim());
        }
        const srcMatch = html.match(/file:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || html.match(/src:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (srcMatch?.[1]) {
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(srcMatch[1])}&host=fc2stream`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: srcMatch[1].includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          });
        }
      }
    } catch (fc2Err) {
      console.warn('[FC2Stream Scraper Warning]:', fc2Err.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'FC2Stream Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 9. VK VIDEO EXTRACTION
  // ==========================================================
  else if (hostType === 'vk') {
    let vkServiceToken = (customVkToken || process.env.VK_SERVICE_TOKEN || '').trim();
    if (!vkServiceToken) {
      try {
        const db = await getDb();
        const genSettings = await db.collection('settings').findOne({ type: 'general' });
        if (genSettings && (genSettings.vkServiceToken || genSettings.vkApiKey)) {
          vkServiceToken = (genSettings.vkServiceToken || genSettings.vkApiKey).trim();
        }
      } catch (e) {}
    }

    const match = cleanUrl.match(/video(-?\d+)_(\d+)/) || cleanUrl.match(/video(-?\d+_\d+)/) || cleanUrl.match(/clip(-?\d+)_(\d+)/);
    let oid = '';
    let id = '';

    if (match) {
      if (match[2]) {
        oid = match[1];
        id = match[2];
      } else {
        [oid, id] = match[1].split('_');
      }
    }

    if (!oid || !id) {
      throw new Error('Format ID VK Video tidak valid.');
    }

    let accessKey = '';
    const listMatch = cleanUrl.match(/list=([a-zA-Z0-9_\-]+)/);
    if (listMatch) accessKey = listMatch[1];
    const accessParam = cleanUrl.match(/access_key=([a-zA-Z0-9_\-]+)/);
    if (accessParam) accessKey = accessParam[1];

    let playerUrl = '';

    // A. VK OFFICIAL API METHOD
    if (vkServiceToken) {
      try {
        const videoQueries = accessKey ? [`${oid}_${id}_${accessKey}`, `${oid}_${id}`] : [`${oid}_${id}`];
        for (const videoQuery of videoQueries) {
          const apiUrl = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoQuery)}&access_token=${encodeURIComponent(vkServiceToken)}&v=5.199`;
          const apiRes = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
              Accept: 'application/json'
            },
            signal: AbortSignal.timeout(6000),
            cache: 'no-store'
          });

          if (!apiRes.ok) continue;
          const apiData = await apiRes.json();

          if (apiData.response?.items?.length > 0) {
            const item = apiData.response.items[0];
            if (item.title) title = item.title;
            if (item.player) playerUrl = item.player;

            if (item.image?.length > 0) {
              const sortedImg = [...item.image].sort((a, b) => (b.width || 0) - (a.width || 0));
              posterUrl = sortedImg[0]?.url || '';
            } else if (item.first_frame?.length > 0) {
              const sortedFrame = [...item.first_frame].sort((a, b) => (b.width || 0) - (a.width || 0));
              posterUrl = sortedFrame[0]?.url || '';
            } else if (item.photo_1280 || item.photo_800 || item.photo_320) {
              posterUrl = item.photo_1280 || item.photo_800 || item.photo_320 || '';
            }

            if (item.files) {
              const qualities = [
                { key: 'mp4_1080', label: '1080p' },
                { key: 'mp4_720', label: '720p' },
                { key: 'mp4_480', label: '480p' },
                { key: 'mp4_360', label: '360p' },
                { key: 'mp4_240', label: '240p' }
              ];

              qualities.forEach(q => {
                if (item.files[q.key]) {
                  const directUrl = cleanVkUrl(item.files[q.key]);
                  if (!sources.some(s => s.label === q.label)) {
                    sources.push({
                      file: `/api/stream?url=${encodeURIComponent(directUrl)}&host=vk`,
                      label: q.label,
                      type: 'video/mp4'
                    });
                  }
                }
              });

              if (item.files.hls && !sources.some(s => s.label.includes('HLS'))) {
                sources.push({
                  file: `/api/stream?url=${encodeURIComponent(cleanVkUrl(item.files.hls))}&host=vk`,
                  label: 'HLS Auto',
                  type: 'application/x-mpegURL'
                });
              }
            }

            if (sources.length > 0 || playerUrl) break;
          }
        }
      } catch (apiErr) {
        console.warn('[VK Parser API Warning]:', apiErr.message);
      }
    }

    // B. FALLBACK VK EMBED SCRAPER
    if (sources.length === 0) {
      try {
        const targetEmbedUrl = playerUrl
          ? playerUrl.replace('vkvideo.ru', 'vk.com')
          : `https://vk.com/video_ext.php?oid=${oid}&id=${id}${accessKey ? '&access_key=' + accessKey : ''}`;

        const embedRes = await fetch(targetEmbedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: 'https://vk.com/'
          },
          signal: AbortSignal.timeout(8000),
          cache: 'no-store'
        });

        if (embedRes.ok) {
          const html = await embedRes.text();
          if (title === 'Parsed Video') {
            const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/) || html.match(/<meta\s+name="title"\s+content="([^"]+)"/);
            if (ogTitle?.[1]) {
              title = decodeHtmlEntities(ogTitle[1]).replace(/\s*\|\s*VK\s*Video/gi, '').replace(/\s*\|\s*VK/gi, '').trim();
            }
          }

          if (!posterUrl) {
            const ogPoster = html.match(/<meta property="og:image" content="(.*?)"/);
            if (ogPoster?.[1]) posterUrl = decodeHtmlEntities(ogPoster[1]);
          }

          const idx = html.indexOf('apiPrefetchCache');
          if (idx !== -1) {
            const bStart = html.indexOf('[', idx);
            let count = 0;
            let bEnd = -1;
            for (let i = bStart; i < html.length; i++) {
              if (html[i] === '[') count++;
              else if (html[i] === ']') {
                count--;
                if (count === 0) {
                  bEnd = i;
                  break;
                }
              }
            }

            if (bEnd !== -1) {
              try {
                const cacheData = JSON.parse(html.slice(bStart, bEnd + 1));
                for (const entry of cacheData) {
                  const files = entry?.response?.items?.[0]?.files;
                  if (!files) continue;

                  ['1080', '720', '480', '360', '240'].forEach(q => {
                    const directUrl = files[`mp4_${q}`] || files[`url${q}`];
                    if (directUrl && !sources.some(s => s.label === `${q}p`)) {
                      sources.push({
                        file: `/api/stream?url=${encodeURIComponent(cleanVkUrl(directUrl))}&host=vk`,
                        label: `${q}p`,
                        type: 'video/mp4'
                      });
                    }
                  });

                  const hlsUrl = files.hls_ondemand || files.hls;
                  if (hlsUrl && !sources.some(s => s.label.includes('HLS'))) {
                    sources.push({
                      file: `/api/stream?url=${encodeURIComponent(cleanVkUrl(hlsUrl))}&host=vk`,
                      label: 'HLS Auto',
                      type: 'application/x-mpegURL'
                    });
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (embedErr) {
        console.error('[VK Embed Scraper Error]:', embedErr.message);
      }
    }

    if (sources.length === 0) {
      const fallbackTargetUrl = playerUrl
        ? playerUrl.replace('vkvideo.ru', 'vk.com')
        : `https://vk.com/video_ext.php?oid=${oid}&id=${id}${accessKey ? '&access_key=' + accessKey : ''}`;
      sources.push({
        file: `/api/stream?url=${encodeURIComponent(fallbackTargetUrl)}&host=vk`,
        label: '720p HD',
        type: 'video/mp4'
      });
      sources.push({
        file: `/api/stream?url=${encodeURIComponent(fallbackTargetUrl)}&host=vk`,
        label: '480p SD',
        type: 'video/mp4'
      });
    }

    resultType = 'video';
    streamUrl = sources[0]?.file || null;
    embedUrl = playerUrl || `https://vk.com/video_ext.php?oid=${oid}&id=${id}${accessKey ? '&access_key=' + accessKey : ''}`;
  }

  // ==========================================================
  // 10. OK.RU EXTRACTION
  // ==========================================================
  else if (hostType === 'okru' || hostType === 'ok') {
    const okMatch = cleanUrl.match(/video(?:embed)?\/(\d+)/);
    const videoId = okMatch ? okMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID OK.ru tidak valid.');
    }

    embedUrl = `https://ok.ru/videoembed/${videoId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Referer: 'https://ok.ru/',
          Origin: 'https://ok.ru'
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch?.[1]) {
          title = decodeHtmlEntities(titleMatch[1].trim());
        }

        const optionsMatch = html.match(/data-options="([^"]+)"/);
        if (optionsMatch?.[1]) {
          const decodedStr = decodeHtmlEntities(optionsMatch[1]);
          const options = JSON.parse(decodedStr);
          const flashvars = options?.flashvars || {};
          let metadata = flashvars.metadata;

          if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch (e) {}
          }

          if (metadata) {
            if (metadata.movie?.title) title = metadata.movie.title;
            if (metadata.movie?.poster) posterUrl = cleanOkUrl(metadata.movie.poster);

            const videos = metadata.videos || [];
            const qualityMap = {
              lowest: '144p',
              mobile: '240p',
              low: '360p',
              sd: '480p',
              hd: '720p',
              full: '1080p',
              quad: '1440p',
              ultra: '2160p'
            };

            videos.forEach(v => {
              if (!v.url) return;
              const label = qualityMap[v.name] || v.name;
              sources.push({
                file: `/api/stream?url=${encodeURIComponent(cleanOkUrl(v.url))}&host=ok`,
                label,
                type: 'video/mp4'
              });
            });
          }
        }
      }
    } catch (err) {
      console.error('[OK.ru Extractor Error]:', err.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'OK.ru Embed Player',
        type: 'embed'
      });
    } else {
      resultType = 'video';
      streamUrl = sources[0]?.file || null;
    }
  }

  // ==========================================================
  // 11. SIBNET EXTRACTION
  // ==========================================================
  else if (hostType === 'sibnet') {
    const sibnetMatch = cleanUrl.match(/video(\d+)/) || cleanUrl.match(/videoid=(\d+)/) || cleanUrl.match(/sibnet\.ru\/(?:video\/|v\/)?(\d+)/);
    const videoId = sibnetMatch ? sibnetMatch[1] : '';

    if (!videoId) {
      throw new Error('Format ID Video Sibnet tidak valid.');
    }

    title = `Sibnet Video #${videoId}`;
    embedUrl = `https://video.sibnet.ru/shell.php?videoid=${videoId}`;

    try {
      const shellUrl = `https://video.sibnet.ru/shell.php?videoid=${videoId}`;
      const res = await fetch(shellUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Referer: 'https://video.sibnet.ru/'
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch?.[1]) title = decodeHtmlEntities(titleMatch[1].trim());

        const posterMatch = html.match(/poster\s*:\s*["']([^"']+)["']/) || html.match(/poster=["']([^"']+)["']/);
        if (posterMatch?.[1]) {
          posterUrl = posterMatch[1].startsWith('http') ? posterMatch[1] : `https://video.sibnet.ru${posterMatch[1]}`;
        }

        const srcMatch = html.match(/src\s*:\s*["'](\/v\/[^"']+)["']/i) || html.match(/["'](\/v\/[a-zA-Z0-9_\-.\?\=\&]+)["']/i);
        if (srcMatch?.[1]) {
          const rawPath = srcMatch[1];
          const directVideoUrl = rawPath.startsWith('http') ? rawPath : `https://video.sibnet.ru${rawPath}`;
          resultType = 'video';
          streamUrl = `/api/stream?url=${encodeURIComponent(directVideoUrl)}&host=sibnet`;
          sources.push({
            file: streamUrl,
            label: '720p HD',
            type: 'video/mp4'
          });
        }
      }
    } catch (sibnetErr) {
      console.warn('[Sibnet Direct Extraction Warning]:', sibnetErr.message);
    }

    if (sources.length === 0) {
      resultType = 'embed';
      streamUrl = null;
      sources.push({
        file: embedUrl,
        label: 'Sibnet Embed Player',
        type: 'embed'
      });
    }
  }

  // ==========================================================
  // 12. DIRECT / OTHER
  // ==========================================================
  else {
    title = 'Direct Video Stream';
    resultType = 'video';
    streamUrl = `/api/stream?url=${encodeURIComponent(cleanUrl)}&host=other`;
    sources.push({
      file: streamUrl,
      label: 'Original Quality',
      type: cleanUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
    });
  }

  return {
    success: true,
    provider: hostType,
    type: resultType,
    title,
    posterUrl,
    embedUrl,
    streamUrl,
    hostType,
    sources
  };
}
