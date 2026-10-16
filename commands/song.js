const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs').promises;
const path = require('path');
const { toAudio } = require('../lib/converter');
const apiManager = require('../lib/apiManager');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    throw new Error('EliteProTech discontinued');
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

// Direct Emmy savetube MP3 (2026-10-16, tested working) — bypasses apiManager
// health tracking in case the service was temporarily marked down.
async function getEmmySavetubeMp3Direct(youtubeUrl) {
    const EMMY = process.env.EMMY_API_BASE || 'https://apis.emmyhenztech.xyz';
    const res = await tryRequest(() => axios.get(`${EMMY}/api/savetube`, {
        params: { url: youtubeUrl, format: 'mp3' },
        ...AXIOS_DEFAULTS,
    }));
    const r = res?.data?.result;
    if (res?.data?.status && r?.download_url) {
        return { download: r.download_url, title: r.title };
    }
    throw new Error('Emmy direct MP3 failed');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu returned no download');
}

async function songCommand(sock, chatId, message) {
    try {
        // Loading reactions
        const loadEmojis = ['📥', '⏳', '🎵'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
        }

        const messageContent = message.message?.ephemeralMessage?.message || message.message?.viewOnceMessage?.message || message.message?.viewOnceMessageV2?.message || message.message;
        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();
        const query = text.replace(/^\.song\s+/i, '').trim();

        if (!query || query.toLowerCase() === '.song') {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            video = { url: query, title: 'YouTube Audio', thumbnail: 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' };
        } else {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        // Inform user
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp || 'N/A'}`
        }, { quoted: message });

        // Try multiple APIs with fallback chain
        let audioBuffer;
        let downloadSuccess = false;
        let finalTitle = video.title;
        
        const apiMethods = [
            // Primary: centralized apiManager (emmy-savetube -> emmy-clipto, health-tracked)
            { name: 'ApiManager', method: async () => {
                const { result: media } = await apiManager.youtubeAudio(video.url);
                const audio = media.find(m => m.type === 'audio') || media[0];
                if (!audio || !audio.url) throw new Error('apiManager: no audio');
                return { download: audio.url, title: audio.title || video.title };
            }},
            { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) },
            { name: 'EmmyDirect', method: () => getEmmySavetubeMp3Direct(video.url) },
        ];
        
        for (const apiMethod of apiMethods) {
            try {
                const audioData = await apiMethod.method();
                const audioUrl = audioData.download;
                finalTitle = audioData.title || video.title;
                
                if (!audioUrl) continue;
                
                const audioResponse = await axios.get(audioUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Accept': '*/*'
                    }
                });
                audioBuffer = Buffer.from(audioResponse.data);
                
                if (audioBuffer && audioBuffer.length > 0) {
                    downloadSuccess = true;
                    break;
                }
            } catch (err) {
                console.log(`${apiMethod.name} failed:`, err.message);
            }
        }
        
        if (!downloadSuccess) {
            throw new Error('All download sources failed.');
        }

        // Detect format and convert if needed
        const firstBytes = audioBuffer.slice(0, 4).toString('hex');
        let fileExtension = 'mp3';
        if (firstBytes.startsWith('000000') || audioBuffer.slice(4, 8).toString('ascii') === 'ftyp') fileExtension = 'm4a';
        else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') fileExtension = 'ogg';
        else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') fileExtension = 'wav';

        let finalBuffer = audioBuffer;
        if (fileExtension !== 'mp3') {
            finalBuffer = await toAudio(audioBuffer, fileExtension);
        }

        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false
        }, { quoted: message });

    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, { text: "❌ Couldn't download that song right now. Please try again in a moment." }, { quoted: message });
    }
}

module.exports = songCommand;
