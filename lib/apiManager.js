/**
 * Centralized API Manager with health tracking + circuit breaker.
 *
 * Every external service (tiktok/instagram/facebook/youtube/ai) gets an
 * ordered provider list. Providers are tried in order; the first success
 * wins. A provider that fails repeatedly is put on cooldown (circuit
 * breaker) so we don't waste time on dead APIs.
 *
 * Provider contract:
 *   downloaders: run(url) -> [{ url, type: 'video'|'image'|'audio' }]
 *   ai:          run(prompt) -> { text }
 *
 * Only providers verified live are in the chains. See Phase 2 test results.
 */
const axios = require('axios');
const {
    fetchCobaltVideo,
    fetchTikwm,
    fetchRuhend,
} = require('./fallbackDownload');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PROVIDER_TIMEOUT = 25000;
const EMMY_BASE = process.env.EMMY_API_BASE || 'https://apis.emmyhenztech.xyz';

// ---------------------------------------------------------------------------
// Health tracking + circuit breaker
// ---------------------------------------------------------------------------
const MAX_FAILS = 3;               // consecutive failures before cooldown
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown
const health = {}; // name -> { fails, cooldownUntil, okCount }

function isHealthy(name) {
    const h = health[name];
    if (!h || !h.cooldownUntil) return true;
    if (Date.now() >= h.cooldownUntil) {
        h.fails = 0; h.cooldownUntil = 0; // cooldown expired, give it another chance
        return true;
    }
    return false;
}

function recordSuccess(name) {
    const h = health[name] || { fails: 0, cooldownUntil: 0, okCount: 0 };
    h.fails = 0; h.cooldownUntil = 0; h.okCount++;
    health[name] = h;
}

function recordFailure(name, err) {
    const h = health[name] || { fails: 0, cooldownUntil: 0, okCount: 0 };
    h.fails++;
    if (h.fails >= MAX_FAILS) {
        h.cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`[apiManager] "${name}" on cooldown for 5 min (${h.fails} fails): ${err.message}`);
    }
    health[name] = h;
}

function getHealth() {
    const out = {};
    for (const [name, h] of Object.entries(health)) {
        out[name] = {
            okCount: h.okCount,
            fails: h.fails,
            inCooldown: !!(h.cooldownUntil && Date.now() < h.cooldownUntil),
        };
    }
    return out;
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
    ]);
}

// ---------------------------------------------------------------------------
// Core: run providers in order, first success wins
// ---------------------------------------------------------------------------
async function runService(service, providers, input) {
    let lastError = null;
    let tried = 0;
    for (const p of providers) {
        if (!isHealthy(p.name)) {
            console.log(`[apiManager] skipping "${p.name}" (cooldown)`);
            continue;
        }
        tried++;
        try {
            const result = await withTimeout(p.run(input), PROVIDER_TIMEOUT);
            recordSuccess(p.name);
            console.log(`[apiManager] ${service}: "${p.name}" worked`);
            return { provider: p.name, result };
        } catch (err) {
            recordFailure(p.name, err);
            lastError = err;
            console.error(`[apiManager] ${service}: "${p.name}" failed: ${err.message}`);
        }
    }
    if (tried === 0) throw new Error(`${service}: all providers in cooldown, try again later`);
    throw lastError || new Error(`${service}: all providers failed`);
}

// ---------------------------------------------------------------------------
// Emmy API helpers (verified live 2026-10-02, no key required)
// Response envelope: { status: true, result: {...} }
// ---------------------------------------------------------------------------
async function emmyGet(endpoint, params) {
    const res = await axios.get(`${EMMY_BASE}/api/${endpoint}`, {
        params, timeout: PROVIDER_TIMEOUT, headers: { 'User-Agent': UA },
    });
    const data = res.data;
    if (!data || data.status === false) {
        throw new Error(`emmy/${endpoint}: ${(data && data.error) || 'bad response'}`);
    }
    return data.result;
}

function pickVideo(links, preferHd = true) {
    if (!Array.isArray(links) || !links.length) throw new Error('no media links');
    const videos = links.filter((l) => l.url && (l.type === 'mp4' || /video/i.test(l.type || '')));
    const pool = videos.length ? videos : links.filter((l) => l.url);
    if (!pool.length) throw new Error('no playable media');
    if (preferHd) {
        const hd = pool.find((l) => /hd|1080|720/i.test(`${l.quality} ${l.label}`));
        if (hd) return hd;
    }
    return pool[0];
}

// --- Emmy: aio (all-in-one: TikTok/Instagram/Facebook) — VERIFIED 2026-10-02
async function fetchEmmyAio(url) {
    const result = await emmyGet('aio', { url });
    const best = pickVideo(result.links);
    return [{ url: best.url, type: 'video', title: result.title, thumbnail: result.thumbnail }];
}

// --- Emmy: fbdown (Facebook) — endpoint live, needs real FB URL
async function fetchEmmyFbdown(url) {
    const result = await emmyGet('fbdown', { url });
    const videoUrl = result.downloadUrl || result.sd;
    if (!videoUrl) throw new Error('emmy/fbdown: no video URL (private/deleted?)');
    return [{ url: videoUrl, type: 'video', title: result.title }];
}

// --- Emmy: savetik (TikTok) — endpoint live
async function fetchEmmySavetik(url) {
    const result = await emmyGet('savetik', { url });
    if (!result.video) throw new Error('emmy/savetik: no video');
    return [{ url: result.video, type: 'video', title: result.author, thumbnail: result.thumbnail }];
}

// --- Emmy: YouTube downloaders
async function fetchEmmyClipto(url) {
    const result = await emmyGet('clipto', { url });
    const medias = result.medias || [];
    const mp4 = medias.find((m) => m.ext === 'mp4' || m.type === 'video') || medias[0];
    if (!mp4 || !mp4.url) throw new Error('emmy/clipto: no media');
    return [{ url: mp4.url, type: 'video', title: result.title, thumbnail: result.thumbnail }];
}

async function fetchEmmySavetube(url, format = '720') {
    const result = await emmyGet('savetube', { url, format });
    if (!result.download_url) throw new Error('emmy/savetube: no download URL');
    return [{ url: result.download_url, type: result.type === 'audio' ? 'audio' : 'video', title: result.title }];
}

// ---------------------------------------------------------------------------
// AI providers (verified live 2026-10-02)
// ---------------------------------------------------------------------------

// Human-like reply sanitizer: some providers echo the conversation labels
// ("Bot:", "Assistant:") at the start of the answer. Strip them so replies
// read like a real human, never like a labeled bot.
function cleanAiText(text) {
    let t = String(text || '').trim();
    // Remove leading "Bot:" / "Assistant:" / "AI:" labels (possibly repeated)
    for (let i = 0; i < 3; i++) {
        const next = t.replace(/^(bot|assistant|ai|chatbot)\s*[:：-]\s*/i, '').trim();
        if (next === t) break;
        t = next;
    }
    // Remove stray quotes wrapping the whole reply
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        t = t.slice(1, -1).trim();
    }
    return t;
}

async function fetchEmmyChat(prompt) {
    const result = await emmyGet('ch-at', { question: prompt });
    const text = result.answer || result.reply || result.text;
    if (!text) throw new Error('emmy/ch-at: empty answer');
    return { text: cleanAiText(text) };
}

async function fetchPollinations(prompt) {
    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
        timeout: PROVIDER_TIMEOUT,
        headers: { 'User-Agent': UA },
        params: { model: 'openai' },
    });
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (!text || !text.trim()) throw new Error('pollinations: empty answer');
    return { text: cleanAiText(text) };
}

async function fetchOpenAI(prompt, session) {
    if (!process.env.OPENAI_API_KEY) throw new Error('openai: no API key configured');
    const response = await session.getAIResponse('api-manager', prompt);
    if (!response) throw new Error('openai: empty answer');
    return { text: cleanAiText(response) };
}

// --- Google Gemini (primary when GEMINI_API_KEY is set) ---
// Multi-model fallback chain: if one model is busy/404, the next is tried.
const GEMINI_CHAT_MODELS = [
    process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
].filter((v, i, a) => v && a.indexOf(v) === i);

const GEMINI_SYSTEM = 'You are chatting as a friendly human on WhatsApp. Reply naturally and concisely in the same language as the user (Roman Urdu if they use it). Never start your reply with "Bot:", "Assistant:" or any label — just reply directly like a real person.';

async function fetchGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('gemini: GEMINI_API_KEY is not set');
    const errors = [];
    for (const model of GEMINI_CHAT_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await axios.post(url, {
                systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
            }, {
                headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
                timeout: PROVIDER_TIMEOUT,
            });
            const t = res.data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
            if (!t) throw new Error('gemini/' + model + ': empty reply');
            return { text: cleanAiText(t) };
        } catch (e) {
            errors.push(model + ': ' + (e.response?.status || e.message));
        }
    }
    throw new Error('gemini: all models failed (' + errors.join(' | ') + ')');
}

// ---------------------------------------------------------------------------
// Public service API
// ---------------------------------------------------------------------------
const apiManager = {
    // --- Downloaders ---
    tiktok: (url) => runService('tiktok', [
        { name: 'emmy-aio', run: fetchEmmyAio },
        { name: 'cobalt', run: fetchCobaltVideo },
        { name: 'tikwm', run: fetchTikwm },
        { name: 'emmy-savetik', run: fetchEmmySavetik },
    ], url),

    instagram: (url) => runService('instagram', [
        { name: 'emmy-aio', run: fetchEmmyAio },
        { name: 'cobalt', run: fetchCobaltVideo },
        { name: 'ruhend-scraper', run: fetchRuhend },
    ], url),

    facebook: (url) => runService('facebook', [
        { name: 'emmy-fbdown', run: fetchEmmyFbdown },
        { name: 'emmy-aio', run: fetchEmmyAio },
        { name: 'cobalt', run: fetchCobaltVideo },
    ], url),

    youtube: (url) => runService('youtube', [
        { name: 'emmy-clipto', run: fetchEmmyClipto },
        { name: 'emmy-savetube', run: (u) => fetchEmmySavetube(u, '720') },
    ], url),

    youtubeAudio: (url) => runService('youtube-audio', [
        { name: 'emmy-savetube', run: (u) => fetchEmmySavetube(u, 'mp3') },
        { name: 'emmy-clipto', run: fetchEmmyClipto },
    ], url),

    // --- AI (session passed for optional OpenAI fallback) ---
    // Order: Gemini first (best quality, when key is set), then free fallbacks.
    ai: (prompt, session = null) => runService('ai', [
        { name: 'gemini', run: fetchGemini },
        { name: 'emmy-chat', run: fetchEmmyChat },
        { name: 'pollinations', run: fetchPollinations },
        ...(session ? [{ name: 'openai', run: (p) => fetchOpenAI(p, session) }] : []),
    ], prompt),

    // --- Health / diagnostics ---
    getHealth,
    isHealthy,
};

module.exports = apiManager;
