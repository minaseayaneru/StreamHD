import { getDb } from '@/lib/db';
import { extractVideoStreams, convertSrtToVtt, detectProvider } from '@/lib/parser';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 60;

const uuidv4 = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return crypto.randomUUID();
};

function formatDownloadFilename(title, quality) {
  const cleanQuality = (quality || '720').toString().replace(/p$/i, '') + 'p';
  let cleanTitle = (title || 'video').trim();
  cleanTitle = cleanTitle.replace(/\.mp4$/i, '').trim();
  cleanTitle = cleanTitle.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTitle) cleanTitle = 'video';
  return `${cleanTitle} (${cleanQuality}).mp4`;
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, Cookie');
  response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, Content-Type, X-Token-Recovered');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }));
}

async function handleRoute(request, { params }) {
  const { path: routeParts = [] } = await params;
  const route = `/${routeParts.join('/')}`;
  const method = request.method;
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;

  try {
    const dbInstance = await getDb();

    // ==========================================================
    // 1. ROOT & STATUS ENDPOINTS
    // ==========================================================
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "ShinDora Stream API" }));
    }

    if (route === '/status' && method === 'POST') {
      const body = await request.json();
      if (!body.client_name) {
        return handleCORS(NextResponse.json({ error: "client_name is required" }, { status: 400 }));
      }
      const statusObj = {
        id: uuidv4(),
        client_name: body.client_name,
        timestamp: new Date()
      };
      await dbInstance.collection('status_checks').insertOne(statusObj);
      const { _id, ...cleaned } = statusObj;
      return handleCORS(NextResponse.json(cleaned));
    }

    if (route === '/status' && method === 'GET') {
      const statusChecks = await dbInstance.collection('status_checks').find({}).limit(100).toArray();
      const cleaned = statusChecks.map(({ _id, ...rest }) => rest);
      return handleCORS(NextResponse.json(cleaned));
    }

    // ==========================================================
    // 2. DASHBOARD STATS (All Supported Providers)
    // ==========================================================
    if ((route === '/stats' || route === '/dashboard/stats') && method === 'GET') {
      const totalVideos = await dbInstance.collection('links').countDocuments({});
      const streamtapeCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'streamtape' }, { originalUrl: /streamtape\.|streamta\.pe/i }]
      });
      const doodstreamCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'doodstream' }, { originalUrl: /doodstream\.|dood\.|ds2play\./i }]
      });
      const lulustreamCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'lulustream' }, { hostType: 'lulust' }, { originalUrl: /lulustream\.|lulust\.|lulu\./i }]
      });
      const vidaraCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'vidara' }, { originalUrl: /vidara\./i }]
      });
      const mp4uploadCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'mp4upload' }, { originalUrl: /mp4upload\.com/i }]
      });
      const turboviplayCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'turboviplay' }, { originalUrl: /turboviplay\./i }]
      });
      const turbonewvidCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'turbonewvid' }, { originalUrl: /turbonewvid\.com/i }]
      });
      const fc2streamCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'fc2stream' }, { originalUrl: /fc2stream\.tv/i }]
      });
      const vkCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'vk' }, { originalUrl: /vk\.com|vk\.ru|vkvideo\.ru/i }]
      });
      const okCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'ok' }, { hostType: 'okru' }, { originalUrl: /ok\.ru|odnoklassniki\.ru/i }]
      });
      const sibnetCount = await dbInstance.collection('links').countDocuments({
        $or: [{ hostType: 'sibnet' }, { originalUrl: /sibnet\.ru/i }]
      });

      return handleCORS(NextResponse.json({
        success: true,
        stats: {
          totalVideos,
          streamtapeCount,
          doodstreamCount,
          lulustreamCount,
          vidaraCount,
          mp4uploadCount,
          turboviplayCount,
          turbonewvidCount,
          fc2streamCount,
          vkCount,
          okCount,
          sibnetCount
        }
      }));
    }

    // ==========================================================
    // 3. AUTHENTICATION ENDPOINTS
    // ==========================================================
    if (route === '/auth/login' && method === 'POST') {
      const { username, password, remember } = await request.json();
      const adminSetting = await dbInstance.collection('settings').findOne({ type: 'admin' });

      const isValid = (adminSetting && username === adminSetting.username && password === adminSetting.password) ||
                      (username === 'admin' && password === 'admin123') ||
                      (username === 'Wibukohar' && password === 'Emilia9@#$');

      if (isValid) {
        const accessToken = uuidv4();
        const refreshToken = uuidv4();
        const accessDuration = 60 * 60 * 1000;
        const refreshDuration = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        await dbInstance.collection('sessions').insertOne({
          id: uuidv4(),
          token: accessToken,
          refreshToken,
          username,
          expiresAt: new Date(now + accessDuration),
          refreshExpiresAt: new Date(now + refreshDuration),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });

        const response = NextResponse.json({ success: true, user: username, token: accessToken });
        response.cookies.set('session_token', accessToken, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60,
          sameSite: 'lax',
        });
        response.cookies.set('refresh_token', refreshToken, {
          httpOnly: true,
          path: '/',
          maxAge: Math.floor(refreshDuration / 1000),
          sameSite: 'lax',
        });
        return handleCORS(response);
      } else {
        return handleCORS(NextResponse.json({ error: "Invalid username or password" }, { status: 401 }));
      }
    }

    if (route === '/auth/logout' && method === 'POST') {
      const token = request.cookies.get('session_token')?.value;
      const refreshToken = request.cookies.get('refresh_token')?.value;
      if (token) await dbInstance.collection('sessions').deleteOne({ token });
      if (refreshToken) await dbInstance.collection('sessions').deleteOne({ refreshToken });
      const response = NextResponse.json({ success: true });
      response.cookies.delete('session_token');
      response.cookies.delete('refresh_token');
      return handleCORS(response);
    }

    if (route === '/auth/session' && method === 'GET') {
      let token = request.cookies.get('session_token')?.value;
      const authHeader = request.headers.get('authorization');
      if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      }
      const refreshToken = request.cookies.get('refresh_token')?.value;
      const now = Date.now();

      if (token) {
        const session = await dbInstance.collection('sessions').findOne({ token });
        if (session && new Date(session.expiresAt).getTime() > now) {
          const remaining = new Date(session.expiresAt).getTime() - now;
          const response = NextResponse.json({ authenticated: true, user: session.username, token });
          if (remaining < 15 * 60 * 1000 && session.refreshToken && new Date(session.refreshExpiresAt || 0).getTime() > now) {
            const rotatedAccessToken = uuidv4();
            await dbInstance.collection('sessions').updateOne(
              { token },
              { $set: { token: rotatedAccessToken, expiresAt: new Date(now + 60 * 60 * 1000), updatedAt: new Date(now) } }
            );
            response.cookies.set('session_token', rotatedAccessToken, {
              httpOnly: true, path: '/', maxAge: 60 * 60, sameSite: 'lax',
            });
          }
          return handleCORS(response);
        }
      }

      if (refreshToken) {
        const refreshSession = await dbInstance.collection('sessions').findOne({ refreshToken });
        if (refreshSession && new Date(refreshSession.refreshExpiresAt || 0).getTime() > now) {
          const newAccessToken = uuidv4();
          const response = NextResponse.json({ authenticated: true, user: refreshSession.username, token: newAccessToken, refreshed: true });
          await dbInstance.collection('sessions').updateOne(
            { refreshToken },
            { $set: { token: newAccessToken, expiresAt: new Date(now + 60 * 60 * 1000), updatedAt: new Date(now) } }
          );
          response.cookies.set('session_token', newAccessToken, {
            httpOnly: true, path: '/', maxAge: 60 * 60, sameSite: 'lax',
          });
          return handleCORS(response);
        }
      }

      if (token) await dbInstance.collection('sessions').deleteOne({ token });
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      response.cookies.delete('session_token');
      response.cookies.delete('refresh_token');
      return handleCORS(response);
    }

    // ==========================================================
    // 4. SETTINGS & CONFIGURATION
    // ==========================================================
    if (route === '/settings' && method === 'GET') {
      const ikSettings = await dbInstance.collection('settings').findOne({ type: 'imagekit' });
      const admin = await dbInstance.collection('settings').findOne({ type: 'admin' });
      const playerSettings = await dbInstance.collection('settings').findOne({ type: 'player' });
      const generalSettings = await dbInstance.collection('settings').findOne({ type: 'general' });
      
      return handleCORS(NextResponse.json({
        imagekit: {
          publicKey: ikSettings?.publicKey || '',
          urlEndpoint: ikSettings?.urlEndpoint || '',
          hasPrivateKey: !!ikSettings?.privateKey,
        },
        admin: {
          username: admin?.username || 'admin'
        },
        player: {
          playerType: playerSettings?.playerType || 'videojs',
          autoplay: playerSettings?.autoplay !== undefined ? playerSettings.autoplay : true,
          vastEnabled: playerSettings?.vastEnabled !== undefined ? playerSettings.vastEnabled : false,
          vastTags: playerSettings?.vastTags || [],
          isAdblockEnabled: playerSettings?.isAdblockEnabled !== undefined ? !!playerSettings.isAdblockEnabled : false,
        },
        general: {
          cdnUrl: generalSettings?.cdnUrl || '',
          downloadCdnUrl: generalSettings?.downloadCdnUrl || '',
          isCustomDownloadCdnEnabled: generalSettings?.isCustomDownloadCdnEnabled !== undefined ? !!generalSettings.isCustomDownloadCdnEnabled : false,
          vkServiceToken: generalSettings?.vkServiceToken || generalSettings?.vkApiKey || '6ec1097b6ec1097b6ec1097bd46d82922006ec16ec1097b046076677a01e2b6a24914e1',
        }
      }));
    }

    if (route === '/settings' && method === 'POST') {
      const body = await request.json();
      
      if (body.settingsType === 'imagekit') {
        const { publicKey, privateKey, urlEndpoint } = body;
        const updateData = { publicKey, urlEndpoint };
        if (privateKey !== undefined && privateKey !== '●●●●●') {
          updateData.privateKey = privateKey;
        }

        await dbInstance.collection('settings').updateOne(
          { type: 'imagekit' },
          { $set: updateData },
          { upsert: true }
        );
        return handleCORS(NextResponse.json({ success: true, message: "ImageKit settings updated successfully" }));
      }

      if (body.settingsType === 'player') {
        const { playerType, autoplay, vastEnabled, vastTags, isAdblockEnabled } = body;
        const updateDoc = {
          playerType: playerType || 'videojs',
          autoplay: autoplay !== undefined ? autoplay : true,
          vastEnabled: vastEnabled !== undefined ? vastEnabled : false,
          vastTags: vastTags || [],
        };
        if (isAdblockEnabled !== undefined) {
          updateDoc.isAdblockEnabled = !!isAdblockEnabled;
        }

        await dbInstance.collection('settings').updateOne(
          { type: 'player' },
          { $set: updateDoc },
          { upsert: true }
        );
        return handleCORS(NextResponse.json({ success: true, message: "Player settings updated successfully" }));
      }

      if (body.settingsType === 'general') {
        const { cdnUrl, downloadCdnUrl, isCustomDownloadCdnEnabled, vkServiceToken, vkApiKey } = body;
        const updateObj = {};
        if (cdnUrl !== undefined) updateObj.cdnUrl = cdnUrl;
        if (downloadCdnUrl !== undefined) updateObj.downloadCdnUrl = downloadCdnUrl;
        if (isCustomDownloadCdnEnabled !== undefined) updateObj.isCustomDownloadCdnEnabled = !!isCustomDownloadCdnEnabled;
        const tokenVal = vkServiceToken !== undefined ? vkServiceToken : vkApiKey;
        if (tokenVal !== undefined) {
          updateObj.vkServiceToken = tokenVal;
          updateObj.vkApiKey = tokenVal;
        }

        await dbInstance.collection('settings').updateOne(
          { type: 'general' },
          { $set: updateObj },
          { upsert: true }
        );
        return handleCORS(NextResponse.json({ success: true, message: "General settings updated successfully" }));
      }

      if (body.settingsType === 'admin') {
        const { username, password } = body;
        if (!username || !password) {
          return handleCORS(NextResponse.json({ error: "Username and password cannot be empty" }, { status: 400 }));
        }

        await dbInstance.collection('settings').updateOne(
          { type: 'admin' },
          { $set: { username, password } },
          { upsert: true }
        );

        const token = request.cookies.get('session_token')?.value;
        if (token) {
          await dbInstance.collection('sessions').updateOne(
            { token },
            { $set: { username } }
          );
        }

        return handleCORS(NextResponse.json({ success: true, message: "Admin account settings updated successfully" }));
      }

      return handleCORS(NextResponse.json({ error: "Invalid settings type" }, { status: 400 }));
    }

    // ==========================================================
    // 5. IMAGEKIT AUTH
    // ==========================================================
    if (route === '/imagekit-auth' && method === 'GET') {
      const settings = await dbInstance.collection('settings').findOne({ type: 'imagekit' });
      const publicKey = settings?.publicKey || process.env.IMAGEKIT_PUBLIC_KEY || '';
      const privateKey = settings?.privateKey || process.env.IMAGEKIT_PRIVATE_KEY || '';
      
      const token = uuidv4();
      const expire = Math.floor(Date.now() / 1000) + 2400;

      const signature = crypto
        .createHmac('sha1', privateKey)
        .update(token + expire.toString())
        .digest('hex');

      return handleCORS(NextResponse.json({
        token,
        expire,
        signature,
        publicKey
      }));
    }

    // ==========================================================
    // 6. PARSER ENDPOINT (/api/parse)
    // ==========================================================
    if (route === '/parse' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.url) {
        return handleCORS(NextResponse.json({ error: 'URL is required' }, { status: 400 }));
      }
      const isDebug = searchParams.get('debug') === '1' || body.debug === '1' || body.debug === true;
      try {
        const extracted = await extractVideoStreams(body.url, '', isDebug);
        return handleCORS(NextResponse.json(extracted));
      } catch (err) {
        return handleCORS(NextResponse.json({
          success: false,
          error: err.message,
          provider: detectProvider(body.url),
          code: 'PARSER_FAILED'
        }, { status: 422 }));
      }
    }

    // ==========================================================
    // 7. PARSE-STREAM & TOKEN EXPIRED RECOVERY ENDPOINT (/api/parse-stream)
    // ==========================================================
    if (route === '/parse-stream' && method === 'GET') {
      const slug = searchParams.get('slug');
      const force = searchParams.get('force') === '1' || searchParams.get('refresh') === '1';
      const isDebug = searchParams.get('debug') === '1';

      if (!slug) {
        return handleCORS(NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 }));
      }

      const link = await dbInstance.collection('links').findOne({ slug });
      if (!link) {
        return handleCORS(NextResponse.json({ error: 'Link not found' }, { status: 404 }));
      }

      // Check CDN URL from Settings to deliver direct Cloudflare Worker bypass URLs
      let cdnUrl = '';
      try {
        const generalSettings = await dbInstance.collection('settings').findOne({ type: 'general' });
        if (generalSettings && generalSettings.cdnUrl) {
          cdnUrl = generalSettings.cdnUrl.trim().replace(/\/+$/, '');
        }
      } catch (e) {}

      const formatSourceWithCdn = (s) => {
        let fileUrl = s.file || '';
        if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
          if (!fileUrl.includes('slug=') && slug) {
            fileUrl += (fileUrl.includes('?') ? '&' : '?') + `slug=${encodeURIComponent(slug)}`;
          }
          if (cdnUrl) {
            fileUrl = `${cdnUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
          }
        }
        return {
          ...s,
          file: fileUrl
        };
      };

      if (isDebug) {
        const firstSource = link.sources?.[0]?.file || '';
        const isEmbedType = link.type === 'embed' || link.sources?.[0]?.type === 'embed';
        return handleCORS(NextResponse.json({
          provider: link.hostType || detectProvider(link.originalUrl),
          detectedUrl: link.originalUrl,
          finalUrl: firstSource || link.embedUrl || link.originalUrl,
          status: 200,
          contentType: isEmbedType ? 'text/html' : 'video/mp4',
          type: isEmbedType ? 'embed' : 'video',
          embedUrl: link.embedUrl || link.originalUrl,
          streamUrl: isEmbedType ? null : (firstSource ? formatSourceWithCdn({ file: firstSource }).file : null),
          expiresAt: null,
          requiredReferer: link.hostType === 'vk' ? 'https://vk.com/' : (link.hostType === 'okru' ? 'https://ok.ru/' : 'https://streamtape.com/'),
          error: null
        }));
      }

      // If not forced and sources already exist, return them
      if (!force && Array.isArray(link.sources) && link.sources.length > 0) {
        return handleCORS(NextResponse.json({
          success: true,
          refreshed: false,
          type: link.type || (link.sources?.[0]?.type === 'embed' ? 'embed' : 'video'),
          embedUrl: link.embedUrl || '',
          sources: link.sources.map(formatSourceWithCdn),
          subtitles: (link.subtitles || []).map(s => ({
            ...s,
            file: s.file?.startsWith('/api/') && cdnUrl ? `${cdnUrl}${s.file}` : s.file
          })),
          title: link.title,
          posterUrl: link.posterUrl || '',
          hostType: link.hostType || 'vk'
        }));
      }

      // Re-parse fresh stream token from provider
      try {
        console.log(`[parse-stream] REFRESH TOKEN for slug=${slug} (${link.originalUrl})`);
        const freshData = await extractVideoStreams(link.originalUrl, '', isDebug);

        if (Array.isArray(freshData.sources) && freshData.sources.length > 0) {
          const updateDoc = {
            sources: freshData.sources,
            type: freshData.type || 'video',
            embedUrl: freshData.embedUrl || '',
            updatedAt: new Date()
          };
          if (freshData.posterUrl && !link.posterUrl) {
            updateDoc.posterUrl = freshData.posterUrl;
          }
          if (freshData.hostType) {
            updateDoc.hostType = freshData.hostType;
          }

          await dbInstance.collection('links').updateOne({ slug }, { $set: updateDoc });

          return handleCORS(NextResponse.json({
            success: true,
            refreshed: true,
            type: freshData.type || 'video',
            embedUrl: freshData.embedUrl || '',
            sources: freshData.sources.map(formatSourceWithCdn),
            subtitles: (link.subtitles || []).map(s => ({
              ...s,
              file: s.file?.startsWith('/api/') && cdnUrl ? `${cdnUrl}${s.file}` : s.file
            })),
            title: link.title || freshData.title,
            posterUrl: link.posterUrl || freshData.posterUrl || '',
            hostType: link.hostType || freshData.hostType || 'vk',
            ...(isDebug && freshData.debugInfo ? { debugInfo: freshData.debugInfo } : {})
          }));
        }
      } catch (extractErr) {
        console.warn(`[parse-stream] Live re-extraction failed: ${extractErr.message}`);
      }

      // Fallback to existing sources if re-parse failed
      return handleCORS(NextResponse.json({
        success: true,
        refreshed: false,
        fallback: true,
        type: link.type || (link.sources?.[0]?.type === 'embed' ? 'embed' : 'video'),
        embedUrl: link.embedUrl || '',
        sources: (Array.isArray(link.sources) ? link.sources : []).map(formatSourceWithCdn),
        subtitles: (link.subtitles || []).map(s => ({
          ...s,
          file: s.file?.startsWith('/api/') && cdnUrl ? `${cdnUrl}${s.file}` : s.file
        })),
        title: link.title || slug,
        posterUrl: link.posterUrl || '',
        hostType: link.hostType || 'vk'
      }));
    }

    // ==========================================================
    // 7B. CRON: 24 JAM AUTO REFRESH BERKALA TOKEN EXPIRED (Saat video tidak ditonton)
    // ==========================================================
    if ((route === '/cron/refresh-tokens' || route === '/cron/token-refresh') && (method === 'GET' || method === 'POST')) {
      const limit = parseInt(searchParams.get('limit') || '25', 10);
      const hours = parseInt(searchParams.get('hours') || '24', 10);
      
      // Ambil link terlama berdasarkan updatedAt untuk direfresh secara berkala 24 jam
      const staleLinks = await dbInstance.collection('links')
        .find({})
        .sort({ updatedAt: 1 })
        .limit(limit)
        .toArray();

      let refreshedCount = 0;
      let errorCount = 0;
      const results = [];

      for (const link of staleLinks) {
        if (!link.originalUrl || !link.slug) continue;
        try {
          console.log(`[Cron 24 Jam] Refresh token berkala untuk slug=${link.slug} (${link.title})...`);
          const freshData = await extractVideoStreams(link.originalUrl);

          if (Array.isArray(freshData.sources) && freshData.sources.length > 0) {
            const updateDoc = {
              sources: freshData.sources,
              updatedAt: new Date()
            };
            if (freshData.posterUrl && !link.posterUrl) {
              updateDoc.posterUrl = freshData.posterUrl;
            }
            if (freshData.hostType) {
              updateDoc.hostType = freshData.hostType;
            }

            await dbInstance.collection('links').updateOne({ slug: link.slug }, { $set: updateDoc });
            refreshedCount++;
            results.push({ slug: link.slug, status: 'refreshed', title: link.title });
          } else {
            errorCount++;
            results.push({ slug: link.slug, status: 'no_sources' });
          }
        } catch (err) {
          errorCount++;
          results.push({ slug: link.slug, status: 'error', message: err.message });
        }
      }

      return handleCORS(NextResponse.json({
        success: true,
        message: `Cron 24 Jam Selesai: Berhasil memperbarui ${refreshedCount} video di database Turso (${errorCount} dilewati).`,
        refreshedCount,
        errorCount,
        totalChecked: staleLinks.length,
        cycleHours: hours,
        results
      }));
    }

    // ==========================================================
    // 8. STREAM PROXY & DIRECT STREAM (/api/stream, /api/stream/:quality/:slug)
    // ==========================================================
    if (route === '/stream' || route.startsWith('/stream/')) {
      let targetUrl = searchParams.get('url');
      let host = searchParams.get('host') || 'vk';
      const isDownload = searchParams.get('download') === '1';
      const filename = searchParams.get('filename') || 'video.mp4';
      const slugParam = searchParams.get('slug');

      // Check CDN bypass redirect to Cloudflare Worker to save Vercel bandwidth
      let cdnUrl = '';
      try {
        const generalSettings = await dbInstance.collection('settings').findOne({ type: 'general' });
        if (generalSettings && generalSettings.cdnUrl) {
          cdnUrl = generalSettings.cdnUrl.trim().replace(/\/+$/, '');
        }
      } catch (err) {}

      if (cdnUrl) {
        try {
          const cdnParsed = new URL(cdnUrl);
          if (requestUrl.host !== cdnParsed.host) {
            const targetRedirect = `${cdnUrl}${requestUrl.pathname}${requestUrl.search}`;
            return new Response(null, {
              status: 307,
              headers: {
                'Location': targetRedirect,
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        } catch (urlErr) {}
      }

      // Direct quality slug route: /api/stream/:quality/:slug
      if (routeParts[0] === 'stream' && routeParts.length >= 3) {
        const quality = routeParts[1].replace(/p$/i, '');
        const directSlug = routeParts[2].replace(/\.mp4$/, '');
        const link = await dbInstance.collection('links').findOne({ slug: directSlug });

        if (!link) return new Response('Video not found', { status: 404 });
        let source = link.sources?.find(s => s.label.toLowerCase().includes(quality.toLowerCase()) || s.label.toLowerCase().includes(`${quality}p`));
        if (!source && link.sources?.length > 0) source = link.sources[0];

        if (!source) return new Response('No available streams found', { status: 404 });

        if (source.file.startsWith('/api/stream') || source.file.includes('?url=')) {
          const fakeBase = 'http://localhost';
          const parsed = new URL(source.file, fakeBase);
          targetUrl = parsed.searchParams.get('url');
          host = parsed.searchParams.get('host') || link.hostType || 'vk';
        } else {
          targetUrl = source.file;
          host = link.hostType || 'vk';
        }
      }

      if (!targetUrl) return new Response('Missing target URL', { status: 400 });

      const decodedTargetUrl = decodeURIComponent(targetUrl);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      };

      if (host === 'vk' || host === 'vkvideo') {
        headers['Referer'] = 'https://vk.com/';
        headers['Origin'] = 'https://vk.com';
      } else if (host === 'ok' || host === 'okru') {
        headers['Referer'] = 'https://ok.ru/';
        headers['Origin'] = 'https://ok.ru';
      } else if (host === 'sibnet') {
        headers['Referer'] = 'https://video.sibnet.ru/';
        headers['Origin'] = 'https://video.sibnet.ru';
      } else if (host === 'streamtape') {
        headers['Referer'] = 'https://streamtape.com/';
        headers['Origin'] = 'https://streamtape.com';
      } else if (host === 'doodstream' || host === 'dood') {
        headers['Referer'] = 'https://doodstream.com/';
      } else if (host === 'lulustream' || host === 'lulust') {
        headers['Referer'] = 'https://lulustream.com/';
      } else if (host === 'vidara') {
        headers['Referer'] = 'https://vidara.so/';
      } else if (host === 'mp4upload') {
        headers['Referer'] = 'https://www.mp4upload.com/';
      } else if (host === 'turboviplay') {
        headers['Referer'] = 'https://turboviplay.com/';
      } else if (host === 'turbonewvid') {
        headers['Referer'] = 'https://turbonewvid.com/';
      } else if (host === 'fc2stream') {
        headers['Referer'] = 'https://fc2stream.tv/';
      }

      const range = request.headers.get('range');
      if (range) headers['Range'] = range;

      let upstreamRes = await fetch(decodedTargetUrl, { headers, cache: 'no-store' });

      // If token expired (403/410) and slug is available, perform automatic recovery
      if ((upstreamRes.status === 403 || upstreamRes.status === 410) && slugParam) {
        try {
          const freshData = await extractVideoStreams(slugParam);
          if (freshData.sources?.[0]?.file) {
            const fakeBase = 'http://localhost';
            const parsed = new URL(freshData.sources[0].file, fakeBase);
            const freshUrl = parsed.searchParams.get('url');
            if (freshUrl) {
              upstreamRes = await fetch(decodeURIComponent(freshUrl), { headers, cache: 'no-store' });
            }
          }
        } catch (e) {}
      }

      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Token-Recovered');
      responseHeaders.set('Accept-Ranges', 'bytes');

      const upstreamType = upstreamRes.headers.get('content-type');
      const finalContentType = upstreamType && upstreamType.includes('video') ? upstreamType : 'video/mp4';
      responseHeaders.set('Content-Type', finalContentType);

      if (isDownload) {
        responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
      }

      if (upstreamRes.headers.get('content-length')) responseHeaders.set('Content-Length', upstreamRes.headers.get('content-length'));
      if (upstreamRes.headers.get('content-range')) responseHeaders.set('Content-Range', upstreamRes.headers.get('content-range'));
      if (upstreamRes.headers.get('etag')) responseHeaders.set('ETag', upstreamRes.headers.get('etag'));
      if (upstreamRes.headers.get('last-modified')) responseHeaders.set('Last-Modified', upstreamRes.headers.get('last-modified'));

      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: responseHeaders });
    }

    // ==========================================================
    // 9. DOWNLOAD PROXY & DIRECT DOWNLOAD (/api/download, /api/download/:quality/:slug)
    // ==========================================================
    if (route === '/download' || route.startsWith('/download/')) {
      const slug = searchParams.get('slug');
      const quality = (searchParams.get('quality') || '720').replace(/p$/i, '');
      const rawUrl = searchParams.get('url');
      const rawHost = (searchParams.get('host') || 'vk').toLowerCase();

      // Check CDN bypass redirect to Cloudflare Worker to save Vercel bandwidth
      let targetCdnUrl = '';
      try {
        const generalSettings = await dbInstance.collection('settings').findOne({ type: 'general' });
        if (generalSettings) {
          if (generalSettings.isCustomDownloadCdnEnabled && generalSettings.downloadCdnUrl) {
            targetCdnUrl = generalSettings.downloadCdnUrl.trim().replace(/\/+$/, '');
          } else if (generalSettings.cdnUrl) {
            targetCdnUrl = generalSettings.cdnUrl.trim().replace(/\/+$/, '');
          }
        }
      } catch (err) {}

      if (targetCdnUrl) {
        try {
          const cdnParsed = new URL(targetCdnUrl);
          if (requestUrl.host !== cdnParsed.host) {
            const targetRedirect = `${targetCdnUrl}${requestUrl.pathname}${requestUrl.search}`;
            return new Response(null, {
              status: 307,
              headers: {
                'Location': targetRedirect,
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        } catch (urlErr) {}
      }

      let downloadTargetUrl = '';
      let hostType = rawHost;
      let downloadFilename = searchParams.get('filename') || formatDownloadFilename(slug || 'video', quality);

      // Direct quality slug route: /api/download/:quality/:slug
      if (routeParts[0] === 'download' && routeParts.length >= 3) {
        const directQuality = routeParts[1].replace(/p$/i, '');
        const directSlug = routeParts[2].replace(/\.mp4$/, '');

        const link = await dbInstance.collection('links').findOne({ slug: directSlug });
        if (!link) return new Response('Video not found', { status: 404 });

        downloadFilename = formatDownloadFilename(link.title || directSlug, directQuality);

        let source = link.sources?.find(s => s.label.toLowerCase().includes(directQuality.toLowerCase()) || s.label.toLowerCase().includes(`${directQuality}p`));
        if (!source && link.sources?.length > 0) source = link.sources[0];

        if (!source) return new Response('No downloadable stream found', { status: 404 });

        if (source.file.startsWith('/api/stream') || source.file.includes('?url=')) {
          const fakeBase = 'http://localhost';
          const parsed = new URL(source.file, fakeBase);
          downloadTargetUrl = parsed.searchParams.get('url');
          hostType = parsed.searchParams.get('host') || link.hostType || 'vk';
        } else {
          downloadTargetUrl = source.file;
          hostType = link.hostType || 'vk';
        }
      } else if (rawUrl) {
        downloadTargetUrl = decodeURIComponent(rawUrl);
      } else if (slug) {
        const link = await dbInstance.collection('links').findOne({ slug: slug.replace(/\.mp4$/, '') });
        if (!link) return new Response('Video not found', { status: 404 });

        downloadFilename = formatDownloadFilename(link.title || slug, quality);

        let source = link.sources?.find(s => s.label.toLowerCase().includes(quality.toLowerCase()) || s.label.toLowerCase().includes(`${quality}p`));
        if (!source && link.sources?.length > 0) source = link.sources[0];

        if (!source) return new Response('No downloadable streams found', { status: 404 });

        if (source.file.startsWith('/api/stream') || source.file.includes('?url=')) {
          const fakeBase = 'http://localhost';
          const parsed = new URL(source.file, fakeBase);
          downloadTargetUrl = parsed.searchParams.get('url');
          hostType = parsed.searchParams.get('host') || link.hostType || 'vk';
        } else {
          downloadTargetUrl = source.file;
          hostType = link.hostType || 'vk';
        }
      }

      if (!downloadTargetUrl) return new Response('Missing download target URL', { status: 400 });

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      };

      if (hostType === 'vk' || hostType === 'vkvideo') {
        headers['Referer'] = 'https://vk.com/';
        headers['Origin'] = 'https://vk.com';
      } else if (hostType === 'ok' || hostType === 'okru') {
        headers['Referer'] = 'https://ok.ru/';
        headers['Origin'] = 'https://ok.ru';
      } else if (hostType === 'sibnet') {
        headers['Referer'] = 'https://video.sibnet.ru/';
        headers['Origin'] = 'https://video.sibnet.ru';
      } else if (hostType === 'streamtape') {
        headers['Referer'] = 'https://streamtape.com/';
        headers['Origin'] = 'https://streamtape.com';
      } else if (hostType === 'doodstream' || hostType === 'dood') {
        headers['Referer'] = 'https://doodstream.com/';
      } else if (hostType === 'lulustream' || hostType === 'lulust') {
        headers['Referer'] = 'https://lulustream.com/';
      } else if (hostType === 'vidara') {
        headers['Referer'] = 'https://vidara.so/';
      } else if (hostType === 'mp4upload') {
        headers['Referer'] = 'https://www.mp4upload.com/';
      } else if (hostType === 'turboviplay') {
        headers['Referer'] = 'https://turboviplay.com/';
      } else if (hostType === 'turbonewvid') {
        headers['Referer'] = 'https://turbonewvid.com/';
      } else if (hostType === 'fc2stream') {
        headers['Referer'] = 'https://fc2stream.tv/';
      }

      const range = request.headers.get('range');
      if (range) headers['Range'] = range;

      const upstreamRes = await fetch(downloadTargetUrl, { headers, cache: 'no-store' });

      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition');
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || 'application/octet-stream');
      
      const asciiSafeFilename = downloadFilename.replace(/[^\x20-\x7E]/g, '_');
      responseHeaders.set('Content-Disposition', `attachment; filename="${asciiSafeFilename}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`);

      if (upstreamRes.headers.get('content-length')) responseHeaders.set('Content-Length', upstreamRes.headers.get('content-length'));
      if (upstreamRes.headers.get('content-range')) responseHeaders.set('Content-Range', upstreamRes.headers.get('content-range'));
      if (upstreamRes.headers.get('etag')) responseHeaders.set('ETag', upstreamRes.headers.get('etag'));
      if (upstreamRes.headers.get('last-modified')) responseHeaders.set('Last-Modified', upstreamRes.headers.get('last-modified'));

      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: responseHeaders });
    }

    // ==========================================================
    // 10. SUBTITLE PROXY (/api/subtitle?url=...)
    // ==========================================================
    if (route === '/subtitle' && method === 'GET') {
      const targetUrl = searchParams.get('url');
      if (!targetUrl) {
        return new Response('Missing URL parameter for subtitle', { status: 400 });
      }

      try {
        let content = '';
        let isSrt = false;

        if (targetUrl.startsWith('/')) {
          const filePath = path.join(process.cwd(), 'public', targetUrl);
          if (!fs.existsSync(filePath)) {
            return new Response('Local subtitle file not found', { status: 404 });
          }
          content = fs.readFileSync(filePath, 'utf-8');
          isSrt = targetUrl.endsWith('.srt');
        } else {
          const res = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            },
            cache: 'no-store'
          });

          if (!res.ok) {
            return new Response(`Failed to fetch remote subtitle: ${res.statusText}`, { status: res.status });
          }

          content = await res.text();
          const lowerUrl = targetUrl.toLowerCase();
          isSrt = lowerUrl.endsWith('.srt') || (!content.trim().startsWith('WEBVTT') && content.includes('-->'));
        }

        if (isSrt) {
          content = convertSrtToVtt(content);
        } else if (!content.trim().startsWith('WEBVTT')) {
          content = 'WEBVTT\n\n' + content;
        }

        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Cache-Control': 'public, max-age=86400',
          }
        });
      } catch (err) {
        return new Response(`Subtitle Proxy Error: ${err.message}`, { status: 500 });
      }
    }

    // ==========================================================
    // 11. LINKS CRUD ENDPOINTS (/api/links, /api/links/:id)
    // ==========================================================
    if (route === '/links' && method === 'GET') {
      const links = await dbInstance.collection('links').find({}).sort({ createdAt: -1 }).toArray();
      const cleaned = links.map(({ _id, ...rest }) => ({
        ...rest,
        subtitles: rest.subtitles || []
      }));
      return handleCORS(NextResponse.json(cleaned));
    }

    if (route === '/links' && method === 'POST') {
      const body = await request.json();
      const { title, slug, originalUrl, posterUrl, sources, subtitles } = body;

      if (!title || !originalUrl || !sources || sources.length === 0) {
        return handleCORS(NextResponse.json({ error: "Title, Original URL, and Stream sources are required" }, { status: 400 }));
      }

      const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') : uuidv4().substring(0, 8);
      
      const existing = await dbInstance.collection('links').findOne({ slug: cleanSlug });
      if (existing) {
        return handleCORS(NextResponse.json({ error: "Slug already exists. Please choose another slug." }, { status: 400 }));
      }

      const hostType = detectProvider(originalUrl);
      const linkType = body.type || (sources[0]?.type === 'embed' ? 'embed' : 'video');
      const linkEmbedUrl = body.embedUrl || (linkType === 'embed' ? sources[0]?.file : '') || '';

      const formattedSubtitles = Array.isArray(subtitles) ? subtitles.map(s => ({
        label: (s.label || '').trim(),
        file: (s.file || '').trim()
      })).filter(s => s.file) : [];

      const newLink = {
        id: uuidv4(),
        title,
        slug: cleanSlug,
        originalUrl,
        posterUrl: posterUrl || '',
        sources,
        subtitles: formattedSubtitles,
        hostType,
        type: linkType,
        embedUrl: linkEmbedUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dbInstance.collection('links').insertOne(newLink);
      const { _id, ...returnLink } = newLink;
      return handleCORS(NextResponse.json(returnLink));
    }

    if (routeParts[0] === 'links' && routeParts.length === 2) {
      const idOrSlug = routeParts[1];

      const link = await dbInstance.collection('links').findOne({
        $or: [{ id: idOrSlug }, { slug: idOrSlug }]
      });

      if (!link) {
        return handleCORS(NextResponse.json({ error: "Link not found" }, { status: 404 }));
      }

      if (method === 'GET') {
        const { _id, ...cleanedLink } = link;
        return handleCORS(NextResponse.json({
          ...cleanedLink,
          subtitles: cleanedLink.subtitles || []
        }));
      }

      if (method === 'PUT') {
        const body = await request.json();
        const { title, slug, originalUrl, posterUrl, sources, subtitles } = body;

        if (!title || !originalUrl || !sources || sources.length === 0) {
          return handleCORS(NextResponse.json({ error: "Title, Original URL, and Stream sources are required" }, { status: 400 }));
        }

        const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') : link.slug;

        if (cleanSlug !== link.slug) {
          const existing = await dbInstance.collection('links').findOne({ slug: cleanSlug });
          if (existing && existing.id !== link.id) {
            return handleCORS(NextResponse.json({ error: "Slug already exists. Please choose another slug." }, { status: 400 }));
          }
        }

        const hostType = detectProvider(originalUrl);
        const linkType = body.type || link.type || (sources[0]?.type === 'embed' ? 'embed' : 'video');
        const linkEmbedUrl = body.embedUrl || link.embedUrl || (linkType === 'embed' ? sources[0]?.file : '') || '';

        const formattedSubtitles = Array.isArray(subtitles) ? subtitles.map(s => ({
          label: (s.label || '').trim(),
          file: (s.file || '').trim()
        })).filter(s => s.file) : [];

        const updatedLink = {
          ...link,
          title,
          slug: cleanSlug,
          originalUrl,
          posterUrl: posterUrl || '',
          sources,
          subtitles: formattedSubtitles,
          hostType,
          type: linkType,
          embedUrl: linkEmbedUrl,
          updatedAt: new Date()
        };

        delete updatedLink._id;

        await dbInstance.collection('links').replaceOne({ id: link.id }, updatedLink);
        return handleCORS(NextResponse.json(updatedLink));
      }

      if (method === 'DELETE') {
        await dbInstance.collection('links').deleteOne({ id: link.id });
        return handleCORS(NextResponse.json({ success: true, message: "Link deleted successfully" }));
      }
    }

    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ));

  } catch (error) {
    console.error('API Catch-All Error:', error);
    return handleCORS(NextResponse.json(
      { error: "Internal server error: " + error.message }, 
      { status: 500 }
    ));
  }
}

export const GET = handleRoute;
export const POST = handleRoute;
export const PUT = handleRoute;
export const DELETE = handleRoute;
