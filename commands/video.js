const axios = require('axios');
const yts = require('yt-search');
const settings = require('../settings');
const apiManager = require('../lib/apiManager');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// EliteProTech API - REMOVED 2026-10-02: dead (returns 404 HTML page)
async function getEliteProTechVideoByUrl(youtubeUrl) {
    throw new Error('EliteProTech discontinued');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title };
    }
    throw new Error('Yupra failed');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu failed');
}

async function videoCommand(sock, chatId, message) {
    try {
        // Loading reactions
        const loadEmojis = ['📥', '⏳', '🎥'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
        }
        const messageContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessage?.message || message.message?.viewOnceMessageV2?.message || message.message;
        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();
        const query = text.replace(/^\.video\s+/i, '').trim();
        
        if (!query || query.toLowerCase() === '.video') {
            await sock.sendMessage(chatId, { text: 'Usage: .video <name or link>' }, { quoted: message });
            return;
        }

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoUrl = query;
            videoTitle = 'YouTube Video';
        } else {
            const { videos } = await yts(query);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        await sock.sendMessage(chatId, {
            image: { url: videoThumbnail || 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' },
            caption: `🎥 Downloading: *${videoTitle}*`
        }, { quoted: message });

        let videoData;
        let downloadSuccess = false;
        let lastErr = null;
        const apiMethods = [
            // Primary: centralized apiManager (emmy-clipto -> emmy-savetube, health-tracked)
            { name: 'ApiManager', method: async () => {
                const { result: media } = await apiManager.youtube(videoUrl);
                const vid = media.find(m => m.type === 'video') || media[0];
                if (!vid || !vid.url) throw new Error('apiManager: no video');
                return { download: vid.url, title: vid.title || videoTitle };
            }},
            { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) }
        ];
        
        for (const apiMethod of apiMethods) {
            try {
                videoData = await apiMethod.method();
                if (videoData.download) {
                    downloadSuccess = true;
                    break;
                }
            } catch (err) {
                lastErr = err;
                console.log(`${apiMethod.name} failed:`, err.message);
            }
        }
        
        if (!downloadSuccess) throw lastErr || new Error('All download sources failed.');

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title.replace(/[^\w\s-]/g, '')}.mp4`,
            caption: `*${videoData.title}*\n\n> *Downloaded by ${settings.ownerName}*`
        }, { quoted: message });

    } catch (error) {
        console.error('Video error:', error);
        const errMsg = (error.message || 'Unknown error').slice(0, 200);
        await sock.sendMessage(chatId, { text: `❌ Error: ${errMsg}` }, { quoted: message });
    }
}

module.exports = videoCommand;
