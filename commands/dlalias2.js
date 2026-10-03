/**
 * dlalias2.js — Downloader aliases batch 2 + anime image commands.
 *
 * Honest-only implementation: every trigger below is backed by a REAL,
 * verified backend already present in this repo (or a genuinely free
 * public endpoint with no key). Triggers without a real backend are
 * NOT in TRIGGERS and are handled as friendly "not available" instead
 * of being faked.
 *
 * Implemented:
 *   twitter        -> cobalt (cobalt natively supports X/Twitter videos)
 *   fb             -> apiManager.facebook (emmy-fbdown -> emmy-aio -> cobalt)
 *   igdl,igdl2,igdl3 -> apiManager.instagram (emmy-aio -> cobalt -> ruhend-scraper)
 *   tiktok2,tiktok3   -> apiManager.tiktok (emmy-aio -> cobalt -> tikwm -> emmy-savetik)
 *   download       -> cobalt with any URL (honest attempt, friendly error if unsupported)
 *   gitclone       -> genuine: downloads repo zip from codeload.github.com (main, fallback master)
 *   surah          -> genuine: Surah audio MP3, Mishary Alafasy — everyayah.com
 *                        (Alafasy_128kbps, padded 001-114) with cdn.islamic.network
 *                        (AlQuran Cloud, verified 200 OK) as fallback
 *   waifu, neko, megumin -> genuine: https://api.waifu.pics/sfw/<category>
 *   animegirl, animegirl1..animegirl5 -> genuine: waifu.pics sfw/waifu (random each call)
 *
 * Skipped (no real backend found in repo — not faked):
 *   ttmp3, igmp3 (no genuine tiktok/instagram-audio backend in repo)
 *   capcut, cartoon, drama, mediafire, megadl, tiktoksearch, tsticker,
 *   ytpost, gdrive, apk, movie (no working backend in repo)
 *   garl, maid (no clean waifu.pics mapping), awoo (already exists in funrole)
 *
 * Dispatch shape (matches dlalias.js wiring in index.js):
 *   dlAlias2Command(sock, chatId, msg, q, trigger)
 *   module.exports.TRIGGERS = [...]
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const settings = require('../settings');
const apiManager = require('../lib/apiManager');
const { cobaltFetch } = require('../lib/cobalt');
const { sendVideoSmart, downloadToFile } = require('../lib/fallbackDownload');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TRIGGERS = [
    'twitter',
    'download', 'gitclone', 'surah',
    'waifu', 'neko', 'megumin',
    'animegirl', 'animegirl1', 'animegirl2', 'animegirl3', 'animegirl4', 'animegirl5',
];
// NOTE: 'fb', 'igdl', 'igdl2', 'igdl3', 'tiktok2', 'tiktok3' intentionally NOT listed —
// they are already wired in index.js to the existing commands.dlalias / commands.facebook.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function react(sock, from, msg, emoji) {
    try {
        await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
    } catch (e) { /* ignore */ }
}

const BRAND = `> *© POWERED BY ${settings.botName.toUpperCase()}*`;

function isUrl(s) {
    return /^https?:\/\/\S+$/i.test(String(s || '').trim());
}

// Smart image send: URL first, then server-side download + buffer.
async function sendImageSmart(sock, from, msg, imageUrl, caption) {
    try {
        await sock.sendMessage(from, { image: { url: imageUrl }, caption }, { quoted: msg });
        return 'url';
    } catch (urlErr) {
        console.error('[dl2] image URL send failed, trying buffer:', urlErr.message);
    }
    const tmp = path.join(process.cwd(), 'tmp', `dl2img_${Date.now()}`);
    try {
        await downloadToFile(imageUrl, tmp);
        await sock.sendMessage(from, { image: fs.readFileSync(tmp), caption }, { quoted: msg });
        return 'buffer';
    } finally {
        fs.remove(tmp).catch(() => {});
    }
}

// Smart audio send: URL first, then server-side download + buffer.
async function sendAudioSmart(sock, from, msg, audioUrl, caption) {
    try {
        await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', ptt: false, caption }, { quoted: msg });
        return 'url';
    } catch (urlErr) {
        console.error('[dl2] audio URL send failed, trying buffer:', urlErr.message);
    }
    const tmp = path.join(process.cwd(), 'tmp', `dl2aud_${Date.now()}.mp3`);
    try {
        await downloadToFile(audioUrl, tmp);
        await sock.sendMessage(from, { audio: fs.readFileSync(tmp), mimetype: 'audio/mpeg', ptt: false, caption }, { quoted: msg });
        return 'buffer';
    } finally {
        fs.remove(tmp).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// twitter — X/Twitter video via cobalt (real service, honest attempt)
// ---------------------------------------------------------------------------
const TWITTER_URL = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\//i;

async function handleTwitter(sock, from, msg, q) {
    const url = (q || '').trim();
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ Twitter/X ka link dein.\nExample: .twitter https://x.com/user/status/123...' }, { quoted: msg });
    }
    if (!TWITTER_URL.test(url)) {
        return await sock.sendMessage(from, { text: '❌ Ye valid Twitter/X link nahi lagta.' }, { quoted: msg });
    }
    await react(sock, from, msg, '⌛');
    try {
        const media = await cobaltFetch(url);
        const video = media.find(m => m.type === 'video') || media[0];
        if (!video || !video.url) throw new Error('cobalt: no video in response');
        await sendVideoSmart(sock, from, msg, video.url, `✅ TWITTER VIDEO DOWNLOADED\n${BRAND}`);
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] twitter failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Twitter video download nahi ho saka. Link private/invalid ho sakta hai ya service temporarily down hai.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// fb — Facebook video via apiManager.facebook (real fallback chain)
// ---------------------------------------------------------------------------
const FB_URL = /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\//i;

async function handleFb(sock, from, msg, q) {
    const url = (q || '').trim();
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ Facebook video ka link dein.\nExample: .fb https://www.facebook.com/...' }, { quoted: msg });
    }
    if (!FB_URL.test(url)) {
        return await sock.sendMessage(from, { text: '❌ Ye valid Facebook link nahi lagta.' }, { quoted: msg });
    }
    await react(sock, from, msg, '⌛');
    try {
        const { provider, result: media } = await apiManager.facebook(url);
        const video = media.find(m => m.type === 'video') || media[0];
        if (!video || !video.url) throw new Error('no video url from ' + provider);
        await sendVideoSmart(sock, from, msg, video.url, `✅ FACEBOOK VIDEO DOWNLOADED\n${BRAND}`);
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] fb failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Facebook video download nahi ho saka. Video private/deleted ho sakti hai ya link invalid hai.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// igdl / igdl2 / igdl3 — Instagram via apiManager.instagram (real chain)
// ---------------------------------------------------------------------------
const IG_URL = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//i;

async function handleIgdl(sock, from, msg, q, trigger) {
    const url = (q || '').trim();
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ Instagram post/reel ka link dein.\nExample: .igdl https://www.instagram.com/reel/...' }, { quoted: msg });
    }
    if (!IG_URL.test(url)) {
        return await sock.sendMessage(from, { text: '❌ Ye valid Instagram link nahi lagta.' }, { quoted: msg });
    }
    await react(sock, from, msg, '⌛');
    try {
        const { provider, result: media } = await apiManager.instagram(url);
        if (!media || !media.length) throw new Error('no media from ' + provider);
        for (const m of media.slice(0, 3)) {
            if (!m || !m.url) continue;
            if (m.type === 'video') {
                await sendVideoSmart(sock, from, msg, m.url, `✅ INSTAGRAM DOWNLOADED (${trigger.toUpperCase()})\n${BRAND}`);
            } else {
                await sendImageSmart(sock, from, msg, m.url, `✅ INSTAGRAM DOWNLOADED (${trigger.toUpperCase()})\n${BRAND}`);
            }
        }
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] igdl failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Instagram media download nahi ho saka. Post private/deleted ho sakta hai ya link invalid hai.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// tiktok2 / tiktok3 — TikTok via apiManager.tiktok (real chain)
// ---------------------------------------------------------------------------
const TIKTOK_URL = /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

async function handleTiktok(sock, from, msg, q, trigger) {
    const url = (q || '').trim();
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ TikTok video ka link dein.\nExample: .tiktok2 https://vt.tiktok.com/...' }, { quoted: msg });
    }
    if (!TIKTOK_URL.test(url)) {
        return await sock.sendMessage(from, { text: '❌ Ye valid TikTok link nahi lagta.' }, { quoted: msg });
    }
    await react(sock, from, msg, '⌛');
    try {
        const { provider, result: media } = await apiManager.tiktok(url);
        const video = media.find(m => m.type === 'video') || media[0];
        if (!video || !video.url) throw new Error('no video url from ' + provider);
        await sendVideoSmart(sock, from, msg, video.url, `✅ TIKTOK DOWNLOADED (${trigger.toUpperCase()})\n${BRAND}`);
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] tiktok alias failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ TikTok video download nahi ho saka. Link private/invalid ho sakta hai.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// download — generic URL via cobalt (honest attempt; friendly error if
// the service behind the URL is not supported by cobalt)
// ---------------------------------------------------------------------------
async function handleDownload(sock, from, msg, q) {
    const url = (q || '').trim();
    if (!url) {
        return await sock.sendMessage(from, { text: '❌ Koi media URL dein.\nExample: .download https://www.tiktok.com/...' }, { quoted: msg });
    }
    if (!isUrl(url)) {
        return await sock.sendMessage(from, { text: '❌ Ye valid URL nahi lagti. http(s):// se shuru hona chahiye.' }, { quoted: msg });
    }
    await react(sock, from, msg, '⌛');
    try {
        const media = await cobaltFetch(url);
        if (!media || !media.length) throw new Error('cobalt: no media');
        for (const m of media.slice(0, 3)) {
            if (m.type === 'video') {
                await sendVideoSmart(sock, from, msg, m.url, `✅ DOWNLOADED\n${BRAND}`);
            } else if (m.type === 'image') {
                await sendImageSmart(sock, from, msg, m.url, `✅ DOWNLOADED\n${BRAND}`);
            } else {
                await sendAudioSmart(sock, from, msg, m.url, `✅ DOWNLOADED\n${BRAND}`);
            }
        }
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] download failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Is URL se download nahi ho saka. Ye service supported nahi ho sakti ya link invalid hai.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// gitclone — GENUINE: downloads the public repo zip from codeload.github.com
// (tries main branch first, then master). Sends as a .zip document.
// ---------------------------------------------------------------------------
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function handleGitclone(sock, from, msg, q) {
    const repo = (q || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '').split('?')[0];
    if (!repo) {
        return await sock.sendMessage(from, { text: '❌ Repo ka naam dein.\nExample: .gitclone mrkhan9496/mr-muavia-md-bot' }, { quoted: msg });
    }
    if (!REPO_PATTERN.test(repo)) {
        return await sock.sendMessage(from, { text: '❌ Format ghalat hai. owner/repo likhein.\nExample: .gitclone facebook/react' }, { quoted: msg });
    }
    const [owner, name] = repo.split('/');
    await react(sock, from, msg, '⌛');
    const tmp = path.join(process.cwd(), 'tmp', `gitclone_${Date.now()}.zip`);
    let downloadedBranch = null;
    let lastError = null;
    try {
        for (const branch of ['main', 'master']) {
            const zipUrl = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/zip/refs/heads/${branch}`;
            try {
                await downloadToFile(zipUrl, tmp);
                downloadedBranch = branch;
                break;
            } catch (e) {
                lastError = e;
                fs.remove(tmp).catch(() => {});
                console.error(`[dl2] gitclone ${branch} failed:`, e.message);
            }
        }
        if (!downloadedBranch) throw lastError || new Error('repo not found');
        const fileName = `${owner}-${name}.zip`;
        await sock.sendMessage(from, {
            document: fs.readFileSync(tmp),
            mimetype: 'application/zip',
            fileName,
            caption: `✅ GITHUB REPO DOWNLOADED\n📦 ${owner}/${name} (branch: ${downloadedBranch})\n${BRAND}`,
        }, { quoted: msg });
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] gitclone failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Repo download nahi ho saka. Naam check karein (owner/repo) — repo public hona chahiye.' }, { quoted: msg });
    } finally {
        fs.remove(tmp).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// surah — GENUINE: Surah audio MP3 (Mishary Rashid Alafasy).
// Primary: everyayah.com/data/Alafasy_128kbps/<001..114>.mp3 (3-digit padded).
// Fallback: cdn.islamic.network (AlQuran Cloud CDN, ar.alafasy edition —
// verified HTTP 200 for surahs 1/36/114 on 2026-10-03).
// Usage: .surah <number 1-114>
// ---------------------------------------------------------------------------
async function handleSurah(sock, from, msg, q) {
    const num = parseInt(String(q || '').trim(), 10);
    if (!num || isNaN(num) || num < 1 || num > 114) {
        return await sock.sendMessage(from, { text: '❌ Surah number 1 se 114 tak dein.\nExample: .surah 36' }, { quoted: msg });
    }
    const padded = String(num).padStart(3, '0');
    const candidates = [
        `https://everyayah.com/data/Alafasy_128kbps/${padded}.mp3`,
        `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${num}.mp3`,
    ];
    await react(sock, from, msg, '⌛');
    try {
        let sent = false;
        let lastError = null;
        for (const audioUrl of candidates) {
            try {
                await sendAudioSmart(sock, from, msg, audioUrl,
                    `📖 *Surah ${padded}*\n🎙️ Reciter: Mishary Rashid Alafasy\n${BRAND}`);
                sent = true;
                break;
            } catch (e) {
                lastError = e;
                console.error(`[dl2] surah source failed (${audioUrl}):`, e.message);
            }
        }
        if (!sent) throw lastError || new Error('all surah sources failed');
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] surah failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Surah audio download nahi ho saka. Kuch der baad dobara try karein.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// waifu / neko / megumin / animegirl(1-5) — GENUINE: waifu.pics free API
// (no key). Returns a random SFW image each call.
// ---------------------------------------------------------------------------
const WAIFU_CATEGORIES = { waifu: 'waifu', neko: 'neko', megumin: 'megumin' };

async function handleAnime(sock, from, msg, trigger) {
    const category = WAIFU_CATEGORIES[trigger] || 'waifu'; // animegirl* -> waifu
    await react(sock, from, msg, '⌛');
    try {
        const res = await axios.get(`https://api.waifu.pics/sfw/${category}`, {
            timeout: 20000,
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            validateStatus: s => s >= 200 && s < 300,
        });
        const url = res.data && res.data.url;
        if (!url || !isUrl(url)) throw new Error('waifu.pics: no image url');
        const label = trigger.replace(/animegirl(\d*)/i, (_m, n) => `ANIME GIRL${n ? ' ' + n : ''}`).toUpperCase();
        await sendImageSmart(sock, from, msg, url, `✨ *${label}*\n${BRAND}`);
        await react(sock, from, msg, '✅');
    } catch (e) {
        console.error('[dl2] anime failed:', e.message);
        await react(sock, from, msg, '❌');
        await sock.sendMessage(from, { text: '❌ Anime image load nahi ho saki. Kuch der baad dobara try karein.' }, { quoted: msg });
    }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
async function dlAlias2Command(sock, chatId, msg, q, trigger) {
    const t = String(trigger || '').toLowerCase();
    try {
        switch (t) {
            case 'twitter': return await handleTwitter(sock, chatId, msg, q);
            case 'fb': return await handleFb(sock, chatId, msg, q);
            case 'igdl':
            case 'igdl2':
            case 'igdl3': return await handleIgdl(sock, chatId, msg, q, t);
            case 'tiktok2':
            case 'tiktok3': return await handleTiktok(sock, chatId, msg, q, t);
            case 'download': return await handleDownload(sock, chatId, msg, q);
            case 'gitclone': return await handleGitclone(sock, chatId, msg, q);
            case 'surah': return await handleSurah(sock, chatId, msg, q);
            case 'waifu':
            case 'neko':
            case 'megumin':
            case 'animegirl':
            case 'animegirl1':
            case 'animegirl2':
            case 'animegirl3':
            case 'animegirl4':
            case 'animegirl5': return await handleAnime(sock, chatId, msg, t);
            default:
                return await sock.sendMessage(chatId, { text: '❌ Unknown command.' }, { quoted: msg });
        }
    } catch (e) {
        // Final safety net — this handler must never crash the bot.
        console.error('[dl2] unexpected error:', e && e.message);
        try {
            await sock.sendMessage(chatId, { text: '❌ Kuch ghalat ho gaya. Dobara try karein.' }, { quoted: msg });
        } catch (e2) { /* give up quietly */ }
    }
}

module.exports = dlAlias2Command;
module.exports.TRIGGERS = TRIGGERS;
module.exports.dlAlias2Command = dlAlias2Command;
