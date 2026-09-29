'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldAlert, RefreshCw, X, AlertCircle, CheckCircle2, Tv } from 'lucide-react';
import { parseTimeToSeconds } from '@/app/dashboard/vast-ads/page';

function formatSeconds(sec) {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function ClientPlayer({ 
  video, 
  defaultPlayerType = 'jwplayer', 
  autoplay = true, 
  vastEnabled = false,
  vastTags = [],
  isAdblockEnabled = false,
  cdnUrl = ''
}) {
  const videoRef = useRef(null);
  const jwContainerRef = useRef(null);
  
  const [playerEngine] = useState(defaultPlayerType || 'jwplayer');
  const [scriptsReady, setScriptsReady] = useState(false);
  const [isTvDevice, setIsTvDevice] = useState(false);
  
  // Single Instance Persistent Locks
  const videoPlayerRef = useRef(null);
  const jwPlayerInstanceRef = useRef(null);
  const initializedRef = useRef(false);

  const [videoData, setVideoData] = useState(video);
  const [sources, setSources] = useState(video?.sources || []);
  const [subtitles, setSubtitles] = useState(video?.subtitles || []);
  const [embedMode, setEmbedMode] = useState(false);

  const fallbackToEmbed = useCallback(() => {
    const rawEmbed = videoData?.embedUrl || video?.embedUrl || (sources[0]?.type === 'embed' ? sources[0].file : '') || videoData?.originalUrl || video?.originalUrl || '';
    if (rawEmbed) {
      console.log('[Player Recovery] Switching to protected embed player mode for Error 232403 protection');
      setEmbedMode(true);
      setRecoveryMessage('Memutar via Protected Player Mode');
      setRecoverySuccess(true);
      setTimeout(() => setRecoveryMessage(null), 3500);
    }
  }, [videoData, video, sources]);

  // Detect Smart TV Device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isTv = /SmartTV|Tizen|webOS|AppleTV|GoogleTV|HbbTV|BRAVIA|NetCast|POV_TV|Android TV|MiBOX|AFTT|AFTM/i.test(ua);
      setIsTvDevice(isTv);
    }
  }, []);

  // ============================================================
  // TOKEN RECOVERY & ERROR RECOVERY STATE
  // ============================================================
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const lastPlaybackTimeRef = useRef(0);
  const isRecoveringRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const normalPlayTimerRef = useRef(null);

  // ============================================================
  // FITUR DETEKSI OTOMATIS OPENING & SKIP OPENING
  // ============================================================
  const [showSkipOpening, setShowSkipOpening] = useState(false);
  const [autoSkipOpening, setAutoSkipOpening] = useState(false);
  const [userDismissedSkip, setUserDismissedSkip] = useState(false);
  const dismissedSkipRef = useRef(false);

  useEffect(() => {
    dismissedSkipRef.current = false;
    setUserDismissedSkip(false);
    setShowSkipOpening(false);
  }, [video?.slug]);

  const dismissSkipOpening = useCallback(() => {
    dismissedSkipRef.current = true;
    setUserDismissedSkip(true);
    setShowSkipOpening(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAutoSkip = localStorage.getItem('shindora_auto_skip_opening');
      if (savedAutoSkip === 'true') {
        setAutoSkipOpening(true);
      }
    }
  }, []);

  const getAnimeTitle = useCallback(() => {
    return String(
      videoData?.animeTitle ||
      video?.animeTitle ||
      videoData?.title ||
      video?.title ||
      ''
    )
      .trim()
      .toLowerCase();
  }, [
    videoData?.animeTitle,
    video?.animeTitle,
    videoData?.title,
    video?.title
  ]);

  const getEpisodeValue = useCallback(() => {
    return String(
      videoData?.episode ??
      video?.episode ??
      ''
    )
      .trim()
      .toLowerCase();
  }, [
    videoData?.episode,
    video?.episode
  ]);

  const getMediaTypeValue = useCallback(() => {
    return String(
      videoData?.mediaType ||
      videoData?.type ||
      videoData?.contentType ||
      video?.mediaType ||
      video?.type ||
      video?.contentType ||
      ''
    )
      .trim()
      .toLowerCase();
  }, [
    videoData?.mediaType,
    videoData?.type,
    videoData?.contentType,
    video?.mediaType,
    video?.type,
    video?.contentType
  ]);

  const isSpecialEpisode = useCallback(() => {
    const title = getAnimeTitle();
    const episode = getEpisodeValue();
    const mediaType = getMediaTypeValue();

    const isMovie =
      /\bmovie\b/i.test(title) ||
      /\bfilm\b/i.test(title) ||
      /\bthe movie\b/i.test(title) ||
      /\bmovie version\b/i.test(title) ||
      /\bmovie\b/i.test(mediaType) ||
      /\bfilm\b/i.test(mediaType);

    if (isMovie) return true;

    return (
      /\bspecial\b/i.test(episode) ||
      /\bspecial episode\b/i.test(episode) ||
      /\bspecial\b/i.test(mediaType) ||
      /\bspecial\b/i.test(title) ||
      /\bsp\.?\b/i.test(episode)
    );
  }, [
    getAnimeTitle,
    getEpisodeValue,
    getMediaTypeValue
  ]);

  // Deteksi Otomatis Segmen Opening Anime Berdasarkan Judul & Metadata
  const getOpeningSegment = useCallback(() => {
    const title = getAnimeTitle();

    if (videoData?.openingEnd && Number(videoData.openingEnd) > 0) {
      return {
        start: Number(videoData.openingStart) || 0,
        end: Number(videoData.openingEnd),
        enabled: true,
        label: 'Custom Opening'
      };
    }

    if (!title || isSpecialEpisode()) {
      return { start: 0, end: 0, enabled: false };
    }

    if (
      title.includes('crayon shin-chan') ||
      title.includes('crayon shinchan') ||
      title.includes('crayon shin chan') ||
      title.includes('shin-chan') ||
      title.includes('shinchan')
    ) {
      return { start: 0, end: 60, enabled: true, label: 'Crayon Shin-chan Opening' };
    }

    if (title.includes('doraemon')) {
      return { start: 0, end: 60, enabled: true, label: 'Doraemon Opening' };
    }

    if (
      title.includes('ninja hattori') ||
      title.includes('hattori') ||
      title.includes('chibi maruko') ||
      title.includes('perman') ||
      title.includes('p-man')
    ) {
      return { start: 0, end: 60, enabled: true, label: 'Anime Classic Opening' };
    }

    return { start: 0, end: 85, enabled: true, label: 'Anime Opening' };
  }, [
    getAnimeTitle,
    isSpecialEpisode,
    videoData?.openingEnd,
    videoData?.openingStart
  ]);

  const isSkipOpeningEnabled = getOpeningSegment().enabled;

  const skipOpening = useCallback(() => {
    const seg = getOpeningSegment();
    if (!seg.enabled || seg.end <= 0) return;

    try {
      if (jwPlayerInstanceRef.current) {
        const player = jwPlayerInstanceRef.current;
        const duration = Number(player.getDuration?.()) || 0;

        // Jangan aktifkan skip untuk durasi <= 7 menit (5/6 menit) atau >= 40 menit (movie)
        if (duration <= 7 * 60 || duration >= 40 * 60) {
          setShowSkipOpening(false);
          return;
        }

        if (duration > seg.end) {
          player.seek(Math.min(seg.end, duration - 0.5));
          setShowSkipOpening(false);
        }
        return;
      }

      if (videoPlayerRef.current) {
        const player = videoPlayerRef.current;
        const duration = Number(player.duration?.()) || 0;

        // Jangan aktifkan skip untuk durasi <= 7 menit (5/6 menit) atau >= 40 menit (movie)
        if (duration <= 7 * 60 || duration >= 40 * 60) {
          setShowSkipOpening(false);
          return;
        }

        if (duration > seg.end) {
          player.currentTime(Math.min(seg.end, duration - 0.5));
          setShowSkipOpening(false);
        }
      }
    } catch (error) {
      console.warn('[Skip Opening Error]', error);
    }
  }, [getOpeningSegment]);

  useEffect(() => {
    if (!isSkipOpeningEnabled) {
      setShowSkipOpening(false);
      return;
    }

    const checkSkipOpening = () => {
      const seg = getOpeningSegment();
      if (!seg.enabled || seg.end <= 0) {
        setShowSkipOpening(false);
        return;
      }

      try {
        let position = 0;
        let duration = 0;

        if (jwPlayerInstanceRef.current) {
          position = Number(jwPlayerInstanceRef.current.getPosition?.()) || 0;
          duration = Number(jwPlayerInstanceRef.current.getDuration?.()) || 0;
        } else if (videoPlayerRef.current) {
          position = Number(videoPlayerRef.current.currentTime?.()) || 0;
          duration = Number(videoPlayerRef.current.duration?.()) || 0;
        }

        if (dismissedSkipRef.current) {
          setShowSkipOpening(false);
          return;
        }

        // Jangan tampilkan skip opening jika durasi <= 7 menit (misal 5 atau 6 menit) atau >= 40 menit (film/movie)
        if (duration <= 7 * 60 || duration >= 40 * 60) {
          setShowSkipOpening(false);
          return;
        }

        const isWithin = duration > seg.end && position >= seg.start && position < seg.end;
        setShowSkipOpening(isWithin);

        if (autoSkipOpening && isWithin && position < (seg.start + 2)) {
          skipOpening();
        }
      } catch {
        setShowSkipOpening(false);
      }
    };

    checkSkipOpening();
    const interval = window.setInterval(checkSkipOpening, 500);
    return () => window.clearInterval(interval);
  }, [
    isSkipOpeningEnabled,
    getOpeningSegment,
    autoSkipOpening,
    skipOpening
  ]);

  // ============================================================
  // 24 JAM AUTO REFRESH BACKGROUND INTERVAL
  // ============================================================
  useEffect(() => {
    if (!video?.slug) return;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 24 Jam

    const dailyRefreshInterval = setInterval(async () => {
      try {
        console.log(`[AutoRefresh-24Hour] 24 jam berlalu, menyegarkan token latar belakang untuk slug=${video.slug}...`);
        const res = await fetch(`/api/parse-stream?slug=${video.slug}&force=1&t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const freshData = await res.json();
          if (freshData.sources && freshData.sources.length > 0) {
            setVideoData(prev => ({ ...prev, ...freshData }));
            setSources(freshData.sources);
            if (freshData.subtitles?.length > 0) {
              setSubtitles(freshData.subtitles);
            }
          }
        }
      } catch (err) {
        console.warn('[AutoRefresh-24Hour Warning]:', err.message);
      }
    }, TWENTY_FOUR_HOURS_MS);

    return () => clearInterval(dailyRefreshInterval);
  }, [video?.slug]);

  // ============================================================
  // SMART TV & REMOTE CONTROL D-PAD NAVIGATION SUPPORT
  // ============================================================
  useEffect(() => {
    const handleTvRemoteKeyDown = (e) => {
      const code = e.keyCode || e.which;
      const key = e.key;

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
        return;
      }

      // 1. Play / Pause Toggle
      if (key === ' ' || key === 'k' || key === 'K' || key === 'MediaPlayPause' || code === 32 || code === 179 || code === 19) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            const state = jwPlayerInstanceRef.current.getState?.();
            if (state === 'playing') {
              jwPlayerInstanceRef.current.pause?.();
            } else {
              jwPlayerInstanceRef.current.play?.();
            }
          } else if (videoPlayerRef.current) {
            if (videoPlayerRef.current.paused?.()) {
              videoPlayerRef.current.play?.();
            } else {
              videoPlayerRef.current.pause?.();
            }
          }
        } catch (err) {}
        return;
      }

      // 2. Seek Backward 10s
      if (key === 'ArrowLeft' || key === 'MediaTrackPrevious' || key === 'MediaRewind' || code === 37 || code === 227) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            const cur = Number(jwPlayerInstanceRef.current.getPosition?.()) || 0;
            jwPlayerInstanceRef.current.seek?.(Math.max(0, cur - 10));
          } else if (videoPlayerRef.current) {
            const cur = Number(videoPlayerRef.current.currentTime?.()) || 0;
            videoPlayerRef.current.currentTime?.(Math.max(0, cur - 10));
          }
        } catch (err) {}
        return;
      }

      // 3. Seek Forward 10s
      if (key === 'ArrowRight' || key === 'MediaTrackNext' || key === 'MediaFastForward' || code === 39 || code === 228) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            const cur = Number(jwPlayerInstanceRef.current.getPosition?.()) || 0;
            const dur = Number(jwPlayerInstanceRef.current.getDuration?.()) || 0;
            jwPlayerInstanceRef.current.seek?.(Math.min(dur, cur + 10));
          } else if (videoPlayerRef.current) {
            const cur = Number(videoPlayerRef.current.currentTime?.()) || 0;
            const dur = Number(videoPlayerRef.current.duration?.()) || 0;
            videoPlayerRef.current.currentTime?.(Math.min(dur, cur + 10));
          }
        } catch (err) {}
        return;
      }

      // 4. Volume Up
      if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            const vol = Number(jwPlayerInstanceRef.current.getVolume?.()) || 100;
            jwPlayerInstanceRef.current.setVolume?.(Math.min(100, vol + 10));
            jwPlayerInstanceRef.current.setMute?.(false);
          } else if (videoPlayerRef.current) {
            const vol = Number(videoPlayerRef.current.volume?.()) || 1;
            videoPlayerRef.current.volume?.(Math.min(1, vol + 0.1));
            videoPlayerRef.current.muted?.(false);
          }
        } catch (err) {}
        return;
      }

      // 5. Volume Down
      if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            const vol = Number(jwPlayerInstanceRef.current.getVolume?.()) || 100;
            jwPlayerInstanceRef.current.setVolume?.(Math.max(0, vol - 10));
          } else if (videoPlayerRef.current) {
            const vol = Number(videoPlayerRef.current.volume?.()) || 1;
            videoPlayerRef.current.volume?.(Math.max(0, vol - 0.1));
          }
        } catch (err) {}
        return;
      }

      // 6. Mute Toggle
      if (key === 'm' || key === 'M' || code === 77) {
        e.preventDefault();
        try {
          if (jwPlayerInstanceRef.current) {
            jwPlayerInstanceRef.current.setMute?.(!jwPlayerInstanceRef.current.getMute?.());
          } else if (videoPlayerRef.current) {
            videoPlayerRef.current.muted?.(!videoPlayerRef.current.muted?.());
          }
        } catch (err) {}
        return;
      }

      // 7. Skip Opening via Remote
      if ((key === 's' || key === 'S' || code === 83) && showSkipOpening && !userDismissedSkip) {
        e.preventDefault();
        skipOpening();
        return;
      }

      // 8. Dismiss Skip Opening
      if ((key === 'Escape' || code === 27 || code === 10009 || code === 461) && showSkipOpening) {
        e.preventDefault();
        dismissSkipOpening();
        return;
      }
    };

    window.addEventListener('keydown', handleTvRemoteKeyDown);
    return () => window.removeEventListener('keydown', handleTvRemoteKeyDown);
  }, [showSkipOpening, userDismissedSkip, skipOpening, dismissSkipOpening]);

  // AdBlock State
  const [adBlockDetected, setAdBlockDetected] = useState(false);
  const [checkingAdBlock, setCheckingAdBlock] = useState(false);
  
  // Overlay Banners State
  const [activeOverlays, setActiveOverlays] = useState([]);
  const closedOverlayIdsRef = useRef(new Set());
  const triggeredPopupsRef = useRef(new Set());

  // Dynamic prop references
  const vastTagsRef = useRef(vastTags);
  vastTagsRef.current = vastTags;
  const vastEnabledRef = useRef(vastEnabled);
  vastEnabledRef.current = vastEnabled;
  const cdnUrlRef = useRef(cdnUrl);
  cdnUrlRef.current = cdnUrl;

  const getCdnStreamUrl = useCallback((sourceFile) => {
    if (!sourceFile) return '';
    if (sourceFile.startsWith('http://') || sourceFile.startsWith('https://')) {
      return sourceFile;
    }
    const cleanCdn = (cdnUrlRef.current || '').trim().replace(/\/+$/, '');
    if (cleanCdn) {
      return `${cleanCdn}${sourceFile.startsWith('/') ? '' : '/'}${sourceFile}`;
    }
    return sourceFile;
  }, []);

  const formatSubtitleUrl = useCallback((fileUrl) => {
    if (!fileUrl) return '';
    const cleanCdn = (cdnUrlRef.current || '').trim().replace(/\/+$/, '');
    if (fileUrl.startsWith('/api/')) {
      return cleanCdn ? `${cleanCdn}${fileUrl}` : fileUrl;
    }
    const subPath = `/api/subtitle?url=${encodeURIComponent(fileUrl)}`;
    return cleanCdn ? `${cleanCdn}${subPath}` : subPath;
  }, []);

  const sendShinDoraEndedSignal = useCallback(() => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ event: 'SHINDORA_VIDEO_ENDED' }, '*');
    }
  }, []);

  // =========================================================================
  // DETEKSI & AUTO-RESUME ADBLOCK
  // =========================================================================
  const runAdBlockCheck = useCallback(async () => {
    if (!isAdblockEnabled) {
      setAdBlockDetected(false);
      return;
    }

    setCheckingAdBlock(true);
    let detected = false;

    try {
      const bait = document.createElement('div');
      bait.className = 'adsbox ad-placement pub_300x250 text-ad banner-ad ad-zone sponsor-post';
      bait.style.cssText = 'position: absolute !important; left: -9999px !important; top: -9999px !important; width: 1px !important; height: 1px !important; pointer-events: none !important;';
      document.body.appendChild(bait);

      await new Promise(resolve => setTimeout(resolve, 60));
      const isHidden = !bait.offsetParent || bait.offsetHeight === 0 || bait.clientHeight === 0 || window.getComputedStyle(bait).display === 'none' || window.getComputedStyle(bait).visibility === 'hidden';
      document.body.removeChild(bait);

      if (isHidden) detected = true;
    } catch (e) {}

    if (!detected) {
      try {
        const testAdUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=' + Date.now();
        await fetch(new Request(testAdUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }));
      } catch (err) {
        detected = true;
      }
    }

    setAdBlockDetected(detected);
    setCheckingAdBlock(false);

    if (detected) {
      try { videoPlayerRef.current?.pause(); } catch (e) {}
      try { jwPlayerInstanceRef.current?.pause(); } catch (e) {}
    } else {
      try {
        if (jwPlayerInstanceRef.current) {
          const jwState = jwPlayerInstanceRef.current.getState?.();
          if (jwState === 'paused' || jwState === 'idle') {
            jwPlayerInstanceRef.current.play?.();
          }
        }
        if (videoPlayerRef.current) {
          if (videoPlayerRef.current.paused?.()) {
            videoPlayerRef.current.play?.();
          }
        }
      } catch (e) {}
    }
  }, [isAdblockEnabled]);

  useEffect(() => {
    if (isAdblockEnabled) {
      runAdBlockCheck();
      const checkIntervalMs = adBlockDetected ? 2000 : 10000;
      const interval = setInterval(runAdBlockCheck, checkIntervalMs);
      return () => clearInterval(interval);
    } else {
      setAdBlockDetected(false);
    }
  }, [isAdblockEnabled, adBlockDetected, runAdBlockCheck]);

  // Injeksi tombol kustom di dalam controlbar bawaan JW Player
  const attachJwSeekButtons = useCallback((player) => {
    const rewindSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="jw-svg-icon"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>`;
    const forwardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="jw-svg-icon"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>`;

    try {
      player.addButton(
        rewindSvg,
        'Mundur 10 Detik (-10s)',
        () => {
          const current = player.getPosition();
          player.seek(Math.max(0, current - 10));
        },
        'jw-btn-rewind-10'
      );

      player.addButton(
        forwardSvg,
        'Maju 10 Detik (+10s)',
        () => {
          const current = player.getPosition();
          const duration = player.getDuration();
          player.seek(Math.min(duration, current + 10));
        },
        'jw-btn-forward-10'
      );
    } catch (e) {}
  }, []);

  // =========================================================================
  // OTOMATIS TOKEN EXPIRED RECOVERY (VK, OK.RU, SIBNET)
  // Dipicu HANYA jika terjadi error fatal / video tidak bisa diputar (Bukan karena loading lambat)
  // =========================================================================
  const recoverExpiredToken = useCallback(async (triggerReason = 'error') => {
    if (isRecoveringRef.current) {
      console.log('[AutoRecovery] Recovery already in progress, skipping duplicate call.');
      return;
    }

    if (recoveryAttemptsRef.current >= 4) {
      console.warn('[AutoRecovery] Exceeded max auto recovery attempts.');
      setRecoveryMessage('Gagal memperbarui token video secara otomatis.');
      setRecoverySuccess(false);
      return;
    }

    isRecoveringRef.current = true;
    setIsRecovering(true);
    setRecoverySuccess(false);
    recoveryAttemptsRef.current += 1;

    // 1. Simpan timestamp pemutaran saat ini secara akurat
    let currentPos = 0;
    try {
      if (jwPlayerInstanceRef.current) {
        currentPos = Number(jwPlayerInstanceRef.current.getPosition?.()) || 0;
      } else if (videoPlayerRef.current) {
        currentPos = Number(videoPlayerRef.current.currentTime?.()) || 0;
      }
    } catch (e) {}

    if (currentPos <= 0 && lastPlaybackTimeRef.current > 0) {
      currentPos = lastPlaybackTimeRef.current;
    }
    lastPlaybackTimeRef.current = currentPos;

    const hostLabel = (videoData?.hostType || video?.hostType || 'video').toUpperCase();
    setRecoveryMessage(`Mendeteksi token ${hostLabel} expired. Memperbarui stream otomatis...`);
    console.log(`[AutoRecovery] Triggered by [${triggerReason}]. Saved position: ${currentPos}s. Fetching fresh source...`);

    try {
      const res = await fetch(`/api/parse-stream?slug=${video.slug}&force=1&t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`Parse stream status ${res.status}`);
      }

      const freshData = await res.json();
      if (!freshData.sources || freshData.sources.length === 0) {
        throw new Error('Tidak ada stream baru yang ditemukan dari host.');
      }

      console.log('[AutoRecovery] Fresh sources retrieved:', freshData.sources);
      setVideoData(prev => ({ ...prev, ...freshData }));
      setSources(freshData.sources);
      if (freshData.subtitles?.length > 0) {
        setSubtitles(freshData.subtitles);
      }

      const freshJwSources = freshData.sources.map(s => ({
        file: getCdnStreamUrl(s.file),
        label: s.label,
        type: s.type || 'video/mp4'
      }));

      // 2. RE-INITIALIZE JW PLAYER UNTUK MEMBERSIHKAN ERROR 224003 SECARA TOTAL
      if (playerEngine === 'jwplayer' && window.jwplayer && jwContainerRef.current) {
        try {
          if (jwPlayerInstanceRef.current) {
            try { jwPlayerInstanceRef.current.remove(); } catch (e) {}
            jwPlayerInstanceRef.current = null;
          }

          const player = window.jwplayer(jwContainerRef.current).setup({
            playlist: [{
              title: freshData.title || videoData?.title,
              image: freshData.posterUrl || videoData?.posterUrl,
              sources: freshJwSources,
              tracks: (freshData.subtitles || subtitles || []).map((sub, idx) => ({
                file: formatSubtitleUrl(sub.file),
                label: sub.label || `Subtitle ${idx + 1}`,
                kind: 'captions',
                default: idx === 0
              }))
            }],
            autostart: true,
            mute: false,
            volume: 100,
            width: '100%',
            height: '100%',
            controls: true,
            displaytitle: true,
            displaydescription: false,
            stretching: 'uniform',
            preload: 'auto',
            playbackRateControls: true
          });

          jwPlayerInstanceRef.current = player;
          attachJwSeekButtons(player);

          player.on('ready', () => {
            if (currentPos > 0) {
              console.log(`[AutoRecovery] Seeking JWPlayer back to: ${currentPos}s`);
              try { player.seek(currentPos); } catch (e) {}
            }
            player.play();
          });

          player.on('error', (err) => {
            console.warn('[JW Player Re-error]:', err);
            recoverExpiredToken('jwplayer_error_event');
          });
          player.on('setupError', (err) => {
            console.warn('[JW Player SetupError]:', err);
            recoverExpiredToken('jwplayer_setup_error');
          });
          player.on('mediaError', (err) => {
            console.warn('[JW Player MediaError]:', err);
            recoverExpiredToken('jwplayer_media_error');
          });
          player.on('complete', () => {
            sendShinDoraEndedSignal();
          });
          player.on('time', (e) => {
            const currentSec = Math.floor(e.position);
            lastPlaybackTimeRef.current = currentSec;
          });

        } catch (jwErr) {
          console.error('[AutoRecovery JW Setup Exception]:', jwErr);
        }

      } else if (videoPlayerRef.current) {
        const player = videoPlayerRef.current;
        const primarySource = freshJwSources[0];

        try {
          player.reset();
          player.src({
            src: primarySource.file,
            type: primarySource.type || 'video/mp4'
          });
          player.load();
          player.ready(() => {
            if (currentPos > 0) {
              console.log(`[AutoRecovery] Seeking Video.js back to: ${currentPos}s`);
              try { player.currentTime(currentPos); } catch (e) {}
            }
            player.play().catch(() => {
              player.muted(true);
              player.play();
            });
          });
        } catch (vjsErr) {
          console.error('[AutoRecovery Video.js Exception]:', vjsErr);
        }
      }

      setRecoverySuccess(true);
      setRecoveryMessage(`Token ${hostLabel} berhasil diperbarui! Melanjutkan pemutaran...`);

      setTimeout(() => {
        setIsRecovering(false);
        setRecoveryMessage(null);
        isRecoveringRef.current = false;
      }, 2500);

    } catch (err) {
      console.error('[AutoRecovery Error]:', err);
      setRecoverySuccess(false);
      setRecoveryMessage(`Gagal memperbarui token otomatis: ${err.message}`);
      setTimeout(() => {
        setIsRecovering(false);
        isRecoveringRef.current = false;
      }, 3500);
    }
  }, [video?.slug, videoData?.title, videoData?.posterUrl, videoData?.hostType, video?.hostType, playerEngine, getCdnStreamUrl, formatSubtitleUrl, subtitles, attachJwSeekButtons, sendShinDoraEndedSignal]);

  // Load Video.js & JWPlayer Scripts
  useEffect(() => {
    if (!document.getElementById('videojs-css')) {
      const link = document.createElement('link');
      link.id = 'videojs-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css';
      document.head.appendChild(link);
    }

    const loadVideoJs = new Promise((resolve) => {
      if (window.videojs) return resolve(true);
      const script = document.createElement('script');
      script.id = 'videojs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

    const loadJwPlayer = new Promise((resolve) => {
      if (window.jwplayer) return resolve(true);
      const script = document.createElement('script');
      script.id = 'jwplayer-script';
      script.src = 'https://content.jwplatform.com/libraries/IDzF9Zmk.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

    Promise.allSettled([loadVideoJs, loadJwPlayer]).then(() => {
      setScriptsReady(true);
    });
  }, []);

  const activeSourceFile = sources?.[0]?.file ? getCdnStreamUrl(sources[0].file) : '';

  // Trigger Popup Ads & Unmute
  const triggerPopupAd = useCallback((ad) => {
    if (!ad || !ad.popupUrl || triggeredPopupsRef.current.has(ad.id)) return;
    const storageKey = `shindora_popup_${ad.id}`;
    if (ad.frequencyLimit === 'once_24h') {
      const lastShown = localStorage.getItem(storageKey);
      if (lastShown && (Date.now() - parseInt(lastShown, 10) < 86400000)) return;
    }
    triggeredPopupsRef.current.add(ad.id);
    try {
      localStorage.setItem(storageKey, Date.now().toString());
      window.open(ad.popupUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {}
  }, []);

  const handlePlayerContainerClick = () => {
    if (jwPlayerInstanceRef.current && jwPlayerInstanceRef.current.getMute()) {
      jwPlayerInstanceRef.current.setMute(false);
    }
    if (videoPlayerRef.current && videoPlayerRef.current.muted()) {
      videoPlayerRef.current.muted(false);
    }

    const currentTags = vastTagsRef.current || [];
    if (vastEnabledRef.current && currentTags.length > 0) {
      currentTags.forEach(ad => {
        if (ad.enabled && ad.adType === 'popup' && ad.popupUrl) {
          triggerPopupAd(ad);
        }
      });
    }
  };

  // =========================================================================
  // INISIALISASI PEMUTAR VIDEO (JW PLAYER & VIDEO.JS DENGAN SMART TV SUPPORT)
  // =========================================================================
  useEffect(() => {
    if (initializedRef.current || !scriptsReady || !activeSourceFile) return;

    // A. JW PLAYER SETUP
    if (playerEngine === 'jwplayer' && window.jwplayer && jwContainerRef.current) {
      try {
        const jwSources = sources.map(s => {
          const streamUrl = getCdnStreamUrl(s.file);
          const isHls = streamUrl.includes('.m3u8') || s.type?.includes('mpegURL') || s.type?.includes('hls');
          return {
            file: streamUrl,
            label: s.label,
            type: isHls ? 'hls' : 'mp4'
          };
        });

        const player = window.jwplayer(jwContainerRef.current).setup({
          playlist: [{
            title: videoData?.title,
            image: videoData?.posterUrl,
            sources: jwSources.length > 0 ? jwSources : [{ file: activeSourceFile, type: 'mp4' }],
            tracks: subtitles.map((sub, idx) => ({
              file: formatSubtitleUrl(sub.file),
              label: sub.label || `Subtitle ${idx + 1}`,
              kind: 'captions',
              default: idx === 0
            }))
          }],
          autostart: autoplay ? 'viewable' : false,
          mute: false,
          volume: 100,
          width: '100%',
          height: '100%',
          controls: true,
          displaytitle: true,
          displaydescription: false,
          stretching: 'uniform',
          preload: 'auto',
          playbackRateControls: true
        });

        jwPlayerInstanceRef.current = player;
        initializedRef.current = true;

        player.on('ready', () => {
          attachJwSeekButtons(player);

          if (autoplay) {
            const playPromise = player.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                player.setMute(true);
                player.play();
              });
            }
          }
        });

        // -------------------------------------------------------------
        // AUTO TOKEN EXPIRED & ERROR 232403 PROTECTED CONTENT RECOVERY
        // -------------------------------------------------------------
        player.on('error', (err) => {
          console.warn('[JW Player Error Event]:', err);
          const errStr = JSON.stringify(err || {}).toLowerCase();
          if (errStr.includes('232403') || errStr.includes('224003') || errStr.includes('protected') || err?.code === 232403 || err?.code === 224003) {
            fallbackToEmbed();
          } else {
            recoverExpiredToken('jwplayer_error_event');
          }
        });

        player.on('setupError', (err) => {
          console.warn('[JW Player SetupError Event]:', err);
          const errStr = JSON.stringify(err || {}).toLowerCase();
          if (errStr.includes('232403') || errStr.includes('224003') || errStr.includes('protected') || err?.code === 232403 || err?.code === 224003) {
            fallbackToEmbed();
          } else {
            recoverExpiredToken('jwplayer_setup_error');
          }
        });

        player.on('mediaError', (err) => {
          console.warn('[JW Player MediaError Event]:', err);
          const errStr = JSON.stringify(err || {}).toLowerCase();
          if (errStr.includes('232403') || errStr.includes('224003') || errStr.includes('protected') || err?.code === 232403 || err?.code === 224003) {
            fallbackToEmbed();
          } else {
            recoverExpiredToken('jwplayer_media_error');
          }
        });

        // Sinyal Selesai & Tracking Posisi
        player.on('complete', function() {
          sendShinDoraEndedSignal();
        });

        player.on('time', (e) => {
          const currentSec = Math.floor(e.position);
          lastPlaybackTimeRef.current = currentSec;

          if (!normalPlayTimerRef.current) {
            normalPlayTimerRef.current = setTimeout(() => {
              recoveryAttemptsRef.current = 0;
            }, 5000);
          }

          const currentTags = vastTagsRef.current || [];
          if (vastEnabledRef.current && currentTags.length > 0) {
            const overlayAds = currentTags.filter(t => t.enabled && t.adType === 'overlay' && t.bannerImageUrl);
            const visible = overlayAds.filter(banner => {
              const showAt = banner.overlayShowSeconds ?? parseTimeToSeconds(banner.overlayShowTime || '10');
              const duration = banner.overlayDuration ?? 15;
              return currentSec >= showAt && (duration === 0 || currentSec <= showAt + duration) && !closedOverlayIdsRef.current.has(banner.id);
            });
            setActiveOverlays(visible);
          }
        });

        return;
      } catch (jwErr) {
        console.warn('JW Player setup error:', jwErr);
      }
    }

    // B. VIDEO.JS SETUP
    if (videoRef.current && window.videojs) {
      try {
        const vjsSources = sources.map(s => {
          const streamUrl = getCdnStreamUrl(s.file);
          const isHls = streamUrl.includes('.m3u8') || s.type?.includes('mpegURL') || s.type?.includes('hls');
          return {
            src: streamUrl,
            type: isHls ? 'application/x-mpegURL' : 'video/mp4',
            label: s.label
          };
        });

        const player = window.videojs(videoRef.current, {
          autoplay: autoplay ? true : false,
          muted: false,
          controls: true,
          responsive: true,
          fluid: false,
          preload: 'auto',
          playsinline: true,
          userActions: {
            hotkeys: true
          },
          poster: videoData?.posterUrl || '',
          sources: vjsSources.length > 0 ? vjsSources : [{ type: 'video/mp4', src: activeSourceFile }]
        });

        videoPlayerRef.current = player;
        initializedRef.current = true;

        if (autoplay) {
          player.ready(() => {
            player.volume(1.0);
            const promise = player.play();
            if (promise !== undefined) {
              promise.catch(() => {
                player.muted(true);
                player.play();
              });
            }
          });
        }

        // -------------------------------------------------------------
        // AUTO TOKEN EXPIRED & ERROR 232403 PROTECTED CONTENT RECOVERY
        // -------------------------------------------------------------
        player.on('error', () => {
          const vjsErr = player.error();
          console.warn('[Video.js Error Event]:', vjsErr);
          if (vjsErr?.code === 4 || vjsErr?.code === 2) {
            fallbackToEmbed();
          } else {
            recoverExpiredToken('videojs_error_event');
          }
        });

        const mediaEl = player.el()?.querySelector('video');
        if (mediaEl) {
          mediaEl.addEventListener('error', (e) => {
            console.warn('[HTML5 Video Native Error]:', e);
            fallbackToEmbed();
          });
        }

        player.on('ended', function() {
          sendShinDoraEndedSignal();
        });

        player.on('timeupdate', () => {
          const currentSec = Math.floor(player.currentTime());
          lastPlaybackTimeRef.current = currentSec;

          if (!normalPlayTimerRef.current) {
            normalPlayTimerRef.current = setTimeout(() => {
              recoveryAttemptsRef.current = 0;
            }, 5000);
          }

          const currentTags = vastTagsRef.current || [];
          if (vastEnabledRef.current && currentTags.length > 0) {
            const overlayAds = currentTags.filter(t => t.enabled && t.adType === 'overlay' && t.bannerImageUrl);
            const visible = overlayAds.filter(banner => {
              const showAt = banner.overlayShowSeconds ?? parseTimeToSeconds(banner.overlayShowTime || '10');
              const duration = banner.overlayDuration ?? 15;
              return currentSec >= showAt && (duration === 0 || currentSec <= showAt + duration) && !closedOverlayIdsRef.current.has(banner.id);
            });
            setActiveOverlays(visible);
          }
        });

      } catch (vjsErr) {
        console.warn('Video.js setup error:', vjsErr);
      }
    }
  }, [scriptsReady, activeSourceFile, playerEngine, sendShinDoraEndedSignal, autoplay, recoverExpiredToken, attachJwSeekButtons]);

  const openingSeg = getOpeningSegment();

  return (
    <div 
      className="w-screen h-screen relative bg-black overflow-hidden m-0 p-0 flex items-center justify-center select-none"
      onClick={handlePlayerContainerClick}
      tabIndex={0}
    >
      <style dangerouslySetInnerHTML={{__html: `
        #jwplayer-container, .video-js, .video-js video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: contain !important;
          position: absolute !important;
          inset: 0 !important;
        }

        /* SMART TV REMOTE FOCUS & D-PAD ACCESSIBILITY */
        :focus-visible {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.6) !important;
        }

        /* SMART TV & LARGE SCREEN SUBTITLE SCALING */
        .jw-text-track-cue, 
        .video-js .vjs-text-track-cue {
          font-size: clamp(18px, 2.4vw, 36px) !important;
          line-height: 1.4 !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95) !important;
          font-weight: 700 !important;
        }

        /* FORMATING TOMBOL SEEK JW PLAYER DI DALAM CONTROLBAR */
        .jw-btn-rewind-10, 
        .jw-btn-forward-10 {
          width: 32px !important;
          height: 32px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.2) !important;
          margin: 0 3px !important;
          padding: 5px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
        }

        .jw-btn-rewind-10:hover, 
        .jw-btn-forward-10:hover,
        .jw-btn-rewind-10:focus, 
        .jw-btn-forward-10:focus {
          background: rgba(255, 255, 255, 0.5) !important;
          transform: scale(1.1) !important;
        }

        .jw-btn-rewind-10 svg,
        .jw-btn-forward-10 svg {
          width: 18px !important;
          height: 18px !important;
          stroke: #ffffff !important;
        }

        .jw-controlbar .jw-group.jw-controlbar-left {
          display: flex !important;
          align-items: center !important;
        }
      `}} />

      <div className="w-full h-full relative">
        {embedMode ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <iframe
              src={videoData?.embedUrl || video?.embedUrl || (sources[0]?.type === 'embed' ? sources[0].file : '') || videoData?.originalUrl || video?.originalUrl || ''}
              className="w-full h-full border-0 absolute inset-0"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              title={videoData?.title || 'Video Player'}
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
            />
          </div>
        ) : playerEngine !== 'jwplayer' ? (
          <div data-vjs-player className="w-full h-full">
            <video
              ref={videoRef}
              className="video-js vjs-big-play-centered w-full h-full"
              crossOrigin="anonymous"
              playsInline
              controls
              poster={videoData?.posterUrl || ''}
            >
              {subtitles.map((sub, idx) => (
                <track
                  key={idx}
                  kind="captions"
                  src={formatSubtitleUrl(sub.file)}
                  label={sub.label || `Subtitle ${idx + 1}`}
                  default={idx === 0}
                />
              ))}
            </video>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div ref={jwContainerRef} id="jwplayer-container" className="w-full h-full" />
          </div>
        )}

        {/* ======================================================
            AUTO TOKEN RECOVERY FLOATING BADGE / NOTIFICATION
            ====================================================== */}
        {recoveryMessage && (
          <div 
            data-testid="token-recovery-badge"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] transition-all animate-in fade-in duration-300"
          >
            <div className={`px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs sm:text-sm font-semibold border ${
              recoverySuccess 
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
                : isRecovering
                  ? 'bg-zinc-900/95 text-amber-300 border-amber-500/50'
                  : 'bg-zinc-900/95 text-zinc-200 border-zinc-700/60'
            }`}>
              {isRecovering ? (
                <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
              ) : recoverySuccess ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              )}
              <span>{recoveryMessage}</span>
            </div>
          </div>
        )}

        {/* ======================================================
            FITUR DETEKSI OTOMATIS OPENING (TOMBOL SKIP & TIDAK SKIP)
            ====================================================== */}
        {isSkipOpeningEnabled && showSkipOpening && !userDismissedSkip && (
          <div className="absolute right-4 sm:right-6 bottom-16 sm:bottom-20 z-[60] flex items-center gap-2 p-1.5 sm:p-2 bg-black/85 backdrop-blur-md border border-white/30 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Tombol Skip Opening */}
            <button
              type="button"
              data-testid="skip-opening-btn"
              tabIndex={0}
              autoFocus
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                skipOpening();
              }}
              className="
                flex
                items-center
                gap-2
                rounded-xl
                bg-white
                hover:bg-zinc-100
                focus:bg-zinc-100
                text-black
                px-4
                py-2.5
                text-xs
                sm:text-sm
                font-extrabold
                shadow-md
                transition-all
                active:scale-95
                cursor-pointer
              "
            >
              <span className="text-sm sm:text-base">⏭</span>
              <span>Skip Opening ({formatSeconds(openingSeg.end)})</span>
            </button>

            {/* Tombol Tidak Skip Opening (Hilang seketika saat ditekan) */}
            <button
              type="button"
              data-testid="no-skip-opening-btn"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismissSkipOpening();
              }}
              className="
                flex
                items-center
                gap-1.5
                rounded-xl
                bg-white/15
                hover:bg-white/25
                focus:bg-white/25
                text-white
                px-3.5
                py-2.5
                text-xs
                sm:text-sm
                font-semibold
                transition-all
                active:scale-95
                cursor-pointer
              "
              title="Tonton Opening (Jangan Lewati)"
            >
              <X className="h-4 w-4 text-white/80" />
              <span>Tidak Skip</span>
            </button>
          </div>
        )}

        {/* Overlay Banners Layer */}
        {activeOverlays.map((banner) => (
          <div
            key={banner.id}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 border border-white/20 bg-black/80 rounded p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                closedOverlayIdsRef.current.add(banner.id);
                setActiveOverlays(prev => prev.filter(o => o.id !== banner.id));
              }}
              className="bg-black text-white text-xs px-2 py-0.5 rounded float-right mb-1 cursor-pointer flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Tutup
            </button>
            <a href={banner.bannerTargetUrl || '#'} target="_blank" rel="noopener noreferrer">
              <img src={banner.bannerImageUrl} alt="Ad" className="max-h-24 w-auto object-contain" />
            </a>
          </div>
        ))}

        {/* AdBlock Overlay */}
        {isAdblockEnabled && adBlockDetected && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="max-w-md bg-zinc-900 border border-red-500/30 rounded-2xl p-6 space-y-4">
              <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
              <h2 className="text-xl font-bold">AdBlock Terdeteksi</h2>
              <p className="text-sm text-zinc-300">Harap matikan pemblokir iklan (AdBlock) Anda untuk melanjutkan pemutaran video.</p>
              <button
                type="button"
                onClick={() => runAdBlockCheck()}
                disabled={checkingAdBlock}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                {checkingAdBlock ? 'Memeriksa...' : 'Saya Sudah Mematikan AdBlock'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
