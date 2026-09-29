import { getDb } from '@/lib/db';
import ClientPlayer from './ClientPlayer';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const db = await getDb();
    const link = await db.collection('links').findOne({ slug });

    if (link) {
      return {
        title: `${link.title} - Video Player`,
        description: `Putar video ${link.title} secara instan dengan proxy stream bebas CORS.`,
        openGraph: {
          title: link.title,
          images: link.posterUrl ? [{ url: link.posterUrl }] : [],
        },
      };
    }
  } catch (e) {
    console.error('Failed to generate metadata:', e);
  }

  return {
    title: 'Video Player',
  };
}

export default async function PlayerEmbedPage({ params }) {
  const { slug } = await params;

  let linkData = null;
  let defaultPlayerType = 'videojs';
  let autoplay = true;
  let vastEnabled = false;
  let vastTags = [];
  let isAdblockEnabled = false;
  let cdnUrl = '';

  try {
    const db = await getDb();

    // Query data secara paralel untuk mempercepat response dan menghindari jeda re-render
    const [link, playerSettings, generalSettings, siteSettings] = await Promise.all([
      db.collection('links').findOne({ slug }),
      db.collection('settings').findOne({ type: 'player' }),
      db.collection('settings').findOne({ type: 'general' }),
      db.collection('settings').findOne({ id: 'site_settings' })
    ]);

    if (link) {
      const { _id, ...cleaned } = link;
      linkData = {
        ...cleaned,
        subtitles: cleaned.subtitles || []
      };
    }

    if (playerSettings) {
      defaultPlayerType = playerSettings.playerType || 'videojs';
      autoplay = playerSettings.autoplay !== undefined ? playerSettings.autoplay : true;
      vastEnabled = playerSettings.vastEnabled !== undefined ? playerSettings.vastEnabled : false;
      vastTags = playerSettings.vastTags || [];
      isAdblockEnabled = playerSettings.isAdblockEnabled !== undefined ? !!playerSettings.isAdblockEnabled : false;
    }

    // Ambil CDN URL dengan fallback yang aman dari generalSettings atau siteSettings
    const rawCdnUrl = generalSettings?.cdnUrl || siteSettings?.streamCdnUrl || siteSettings?.cdnUrl || '';
    if (rawCdnUrl) {
      cdnUrl = rawCdnUrl.trim().replace(/\/+$/, '');
    }
  } catch (error) {
    console.error('Failed to load link on player page:', error);
  }

  if (!linkData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Video Tidak Ditemukan</h1>
          <p className="text-gray-400 mt-2 text-sm">Link video yang Anda minta tidak terdaftar di database kami.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden w-full h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background-color: #000 !important;
        }
        #__next, [data-reactroot] {
          width: 100% !important;
          height: 100% !important;
        }
      `}} />
      <ClientPlayer 
        key={linkData.slug} // Kunci komponen berdasarkan slug agar Player TIDAK di-re-mount jika ada re-render ringan
        video={linkData} 
        defaultPlayerType={defaultPlayerType} 
        autoplay={autoplay}
        vastEnabled={vastEnabled}
        vastTags={vastTags}
        isAdblockEnabled={isAdblockEnabled}
        cdnUrl={cdnUrl}
      />
    </div>
  );
}
