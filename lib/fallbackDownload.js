/**
 * Shared fallback downloader for TikTok / Instagram / Facebook commands.
 *
 * Strategy (owner's request):
 *   1. Try each API source IN ORDER — if one fails, the request automatically
 *      moves to the next one, until one returns a video.
 *   2. Try sending the video by URL first (fast).
 *   3. If that fails, download the file on the server (with browser headers)
 *      and send it as a buffer (reliable — bypasses CDN/Baileys fetch quirks).
 *
 * Only APIs verified alive (2026-10-01 live tests) are in the chains below.
 * Dead ones (Vreden, NexOracle, Siputzx nodes) were removed on purpose — a
 * dead API in the chain only wastes 15-25s per attempt before the working
 * one is reached. To add a new source, append { name, run } to the list.
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { cobaltFetch } = require('./cobalt');

// Remux MP4 with faststart (moov atom at front) so WhatsApp can play it.
// Without this, WhatsApp shows "something is wrong with the video file."
let _ffmpegPath = null;
function getFfmpeg() {
    if (_ffmpegPath) return _ffmpegPath;
    try { _ffmpegPath = require('ffmpeg-static'); } catch { _ffmpegPath = 'ffmpeg'; }
    if (!_ffmpegPath) _ffmpegPath = 'ffmpeg';
    return _ffmpegPath;
}
async function faststartRemux(inputPath) {
    const outPath = inputPath.replace(/(\.[^.]+)$/, '_fs$1');
    try {
        await execFileAsync(getFfmpeg(), ['-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outPath]);
        return outPath;
    } catch {
        return inputPath; // ffmpeg missing/failed: send original
    }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const API_TIMEOUT = 15000;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB safety cap

// ---------------------------------------------------------------------------
// Core: try sources in order, first success wins
// ---------------------------------------------------------------------------
async function trySources(url, sources) {
    let lastError = null;
    for (const s of sources) {
        try {
            const media = await s.run(url);
            if (media && media.length) {
                console.log(`[dl] source "${s.name}" worked`);
                return { name: s.name, media };
            }
            throw new Error('no media returned');
        } catch (err) {
            lastError = err;
            console.error(`[dl] source "${s.name}" failed: ${err.message}`);
        }
    }
    throw lastError || new Error('all download sources failed');
}

// ---------------------------------------------------------------------------
// Download a media URL to a temp file (browser headers, follows redirects)
// ---------------------------------------------------------------------------
function guessReferer(mediaUrl) {
    const u = String(mediaUrl || '');
    if (/fbcdn\.net|instagram\.com|instagr\.am/i.test(u)) return 'https://www.instagram.com/';
    if (/tiktokcdn/i.test(u)) return 'https://www.tiktok.com/';
    if (/facebook\.com|fbcdn/i.test(u)) return 'https://www.facebook.com/';
    return 'https://www.google.com/';
}

async function downloadToFile(mediaUrl, destPath) {
    const res = await axios.get(mediaUrl, {
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 5,
        headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': guessReferer(mediaUrl),
        },
    });
    await fs.ensureDir(path.dirname(destPath));
    const writer = fs.createWriteStream(destPath);
    let bytes = 0;
    await new Promise((resolve, reject) => {
        res.data.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > MAX_FILE_BYTES) {
                writer.destroy();
                reject(new Error('file too large (>100MB)'));
            }
        });
        res.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        res.data.on('error', reject);
    });
    return destPath;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Robust delivery: server-side download (3 attempts) -> buffer send,
// then direct URL send as last resort. Throws with the real reason.
// ---------------------------------------------------------------------------
async function deliverVideoRobust(sock, from, msg, videoUrl, caption) {
    const errors = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
        const tmp = path.join(process.cwd(), 'tmp', `dl_${Date.now()}_${attempt}.mp4`);
        try {
            await downloadToFile(videoUrl, tmp);
            await sock.sendMessage(from, { video: fs.readFileSync(tmp), caption }, { quoted: msg });
            fs.remove(tmp).catch(() => {});
            return 'buffer';
        } catch (e) {
            errors.push(`dl${attempt}: ${e.message || e}`);
            fs.remove(tmp).catch(() => {});
            console.error(`[dl] buffer attempt ${attempt} failed:`, e.message || e);
            if (attempt < 3) await sleep(2000);
        }
    }

    try {
        await sock.sendMessage(from, { video: { url: videoUrl }, caption }, { quoted: msg });
        return 'url';
    } catch (e) {
        errors.push(`url: ${e.message || e}`);
        console.error('[dl] URL send also failed:', e.message || e);
    }

    throw new Error(errors.join(' | ').slice(0, 300));
}

// ---------------------------------------------------------------------------
// Smart send: URL first (fast), then server-side download + buffer (reliable)
// ---------------------------------------------------------------------------
async function sendVideoSmart(sock, from, msg, videoUrl, caption) {
    // Download to server first, remux with faststart, then send.
    // (Direct URL sends often lack faststart -> "something is wrong with the video file")
    const tmp = path.join(process.cwd(), 'tmp', `dl_${Date.now()}.mp4`);
    let fsPath = null;
    try {
        await downloadToFile(videoUrl, tmp);
        fsPath = await faststartRemux(tmp);
        await sock.sendMessage(from, { video: fs.readFileSync(fsPath), caption }, { quoted: msg });
        return 'buffer-faststart';
    } catch (bufErr) {
        console.error('[dl] buffer send failed, trying direct URL:', bufErr.message);
        try {
            await sock.sendMessage(from, { video: { url: videoUrl }, caption }, { quoted: msg });
            return 'url';
        } catch (urlErr) {
            console.error('[dl] URL send also failed:', urlErr.message);
            throw urlErr;
        }
    } finally {
        fs.remove(tmp).catch(() => {});
        if (fsPath && fsPath !== tmp) fs.remove(fsPath).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// Source: Cobalt (community instances) — works for TikTok/IG/FB
// ---------------------------------------------------------------------------
async function fetchCobaltVideo(url) {
    const media = await cobaltFetch(url);
    const v = media.find((m) => m.type === 'video') || media[0];
    if (!v || !v.url) throw new Error('cobalt: no video in response');
    return [{ url: v.url, type: 'video' }];
}

// ---------------------------------------------------------------------------
// Source: tikwm (TikTok) — verified working 2026-10-01
// ---------------------------------------------------------------------------
async function fetchTikwm(url) {
    const res = await axios.get('https://www.tikwm.com/api/', {
        params: { url },
        timeout: API_TIMEOUT,
        headers: { 'User-Agent': UA },
    });
    const play = res && res.data && res.data.data && res.data.data.play;
    if (!res.data || res.data.code !== 0 || !play) {
        throw new Error('tikwm: ' + ((res.data && res.data.msg) || 'no video'));
    }
    return [{ url: play, type: 'video' }];
}

// ---------------------------------------------------------------------------
// Source: ruhend-scraper igdl (Instagram, local dependency, no API key)
// ---------------------------------------------------------------------------
let _igdl = false; // false = not tried yet
function getIgdl() {
    if (_igdl === false) {
        try {
            _igdl = require('ruhend-scraper').igdl || null;
        } catch (e) {
            _igdl = null;
        }
    }
    return _igdl;
}
async function fetchRuhend(url) {
    const igdl = getIgdl();
    if (!igdl) throw new Error('ruhend-scraper unavailable');
    const result = await igdl(url);
    const data = result && result.data;
    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('ruhend-scraper: no media');
    }
    return data.map((m) => ({
        url: m.url,
        type: m.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(m.url || '') ? 'video' : 'image',
    }));
}

// ---------------------------------------------------------------------------
// Per-platform chains (order = priority). Add new {name, run} entries here.
// ---------------------------------------------------------------------------
function tiktokSources() {
    return [
        { name: 'cobalt', run: fetchCobaltVideo },
        { name: 'tikwm', run: fetchTikwm },
    ];
}

function instagramSources() {
    return [
        { name: 'cobalt', run: fetchCobaltVideo },
        { name: 'ruhend-scraper', run: fetchRuhend },
    ];
}

module.exports = {
    trySources,
    downloadToFile,
    sendVideoSmart,
    deliverVideoRobust,
    fetchCobaltVideo,
    fetchTikwm,
    fetchRuhend,
    tiktokSources,
    instagramSources,
    API_TIMEOUT,
};
