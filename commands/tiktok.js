const settings = require('../settings');
const apiManager = require('../lib/apiManager');
const { sendVideoSmart } = require('../lib/fallbackDownload');

const TIKTOK_URL_PATTERN = /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

async function tiktokCommand(sock, from, msg, q) {
    const query = (q || '').trim();

    if (!query) {
        return await sock.sendMessage(from, { text: '❌ Please provide a TikTok URL.\nExample: .tt https://vt.tiktok.com/...' }, { quoted: msg });
    }
    if (!TIKTOK_URL_PATTERN.test(query)) {
        return await sock.sendMessage(from, { text: "❌ That doesn't look like a valid TikTok link." }, { quoted: msg });
    }

    try {
        const loadEmojis = ['📥', '⏳', '📱'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        }

        // Centralized fallback: emmy-aio -> cobalt -> tikwm -> emmy-savetik
        // (health-tracked with circuit breaker, first working provider wins)
        const { provider, result: media } = await apiManager.tiktok(query);
        const video = media.find(m => m.type === 'video') || media[0];
        if (!video || !video.url) throw new Error('no video url from ' + provider);

        // Smart send: direct URL first, server-side download as fallback
        await sendVideoSmart(
            sock, from, msg, video.url,
            `✅ TIKTOK DOWNLOADED BY ${settings.botName.toUpperCase()}`
        );
    } catch (e) {
        console.error('TikTok command error:', e.message);
        await sock.sendMessage(from, { text: '❌ Could not download that TikTok video. It may be private, region-locked, or the link is invalid.' }, { quoted: msg });
    }
}

module.exports = tiktokCommand;
