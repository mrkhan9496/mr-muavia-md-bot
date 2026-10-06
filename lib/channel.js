/**
 * Resolves the bot's WhatsApp Channels (newsletters) from their public invite
 * URLs using Baileys' own channel/newsletter API. JIDs are NEVER hardcoded or
 * guessed - they are looked up at runtime and cached in memory (per invite
 * code) for the life of the process.
 *
 * If the installed Baileys version doesn't expose the newsletter API, or a
 * lookup fails for any reason (network, invalid link, rate limit, etc.),
 * every function here fails safe: it returns null / an empty list so callers
 * can carry on without the channel badge instead of crashing the bot.
 */
const settings = require('../settings');

const channelCache = new Map(); // inviteCode -> { jid, name } (success only)
const failedAtMap = new Map();  // inviteCode -> timestamp of last failure
const inFlightMap = new Map();  // inviteCode -> promise

const RESOLVE_COOLDOWN_MS = 5 * 60 * 1000; // retry a failed lookup after 5 minutes

function extractInviteCode(url) {
    if (!url) return null;
    const match = String(url).match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/i);
    return match ? match[1] : null;
}

async function resolveChannel(sock, url) {
    const targetUrl = url || settings.channelUrl;
    const inviteCode = extractInviteCode(targetUrl);
    if (!inviteCode) {
        console.warn('[Channel] Not a valid whatsapp.com/channel/... link, skipping: ' + targetUrl);
        return null;
    }
    if (channelCache.has(inviteCode)) return channelCache.get(inviteCode);
    const failedAt = failedAtMap.get(inviteCode) || 0;
    if (failedAt && Date.now() - failedAt < RESOLVE_COOLDOWN_MS) return null;
    if (inFlightMap.has(inviteCode)) return inFlightMap.get(inviteCode);

    const p = (async () => {
        try {
            if (!sock || typeof sock.newsletterMetadata !== 'function') {
                console.warn('[Channel] This Baileys version does not expose newsletterMetadata(); skipping channel badge.');
                failedAtMap.set(inviteCode, Date.now());
                return null;
            }
            const metadata = await sock.newsletterMetadata('invite', inviteCode);
            if (metadata && metadata.id) {
                const ch = { jid: metadata.id, name: metadata.name || settings.botName };
                channelCache.set(inviteCode, ch);
                failedAtMap.delete(inviteCode);
                return ch;
            }
            console.warn('[Channel] Could not resolve channel metadata from invite link.');
            failedAtMap.set(inviteCode, Date.now());
            return null;
        } catch (err) {
            console.error('[Channel] Failed to resolve WhatsApp channel:', err.message || err);
            failedAtMap.set(inviteCode, Date.now());
            return null;
        } finally {
            inFlightMap.delete(inviteCode);
        }
    })();
    inFlightMap.set(inviteCode, p);
    return p;
}

/**
 * Resolve EVERY channel in settings.followChannels (falls back to the single
 * settings.channelUrl when the list is empty). Used by first-pair onboarding
 * to follow all channels exactly once.
 */
async function resolveChannels(sock) {
    const list = Array.isArray(settings.followChannels) && settings.followChannels.length
        ? settings.followChannels
        : (settings.channelUrl ? [settings.channelUrl] : []);
    const out = [];
    for (const url of list) {
        try {
            const ch = await resolveChannel(sock, url);
            if (ch) out.push(ch);
        } catch {}
    }
    return out;
}

/**
 * Returns a ready-to-spread message payload fragment (contextInfo with the
 * "forwarded from channel" badge), or {} if the channel couldn't be resolved.
 * Usage: sock.sendMessage(chatId, { text, ...(await getChannelContextInfo(sock)) })
 */
async function getChannelContextInfo(sock) {
    const channel = await resolveChannel(sock);
    if (!channel) return {};
    return {
        contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channel.jid,
                newsletterName: channel.name,
                serverMessageId: -1
            }
        }
    };
}

module.exports = { getChannelContextInfo, resolveChannel, resolveChannels, extractInviteCode };
