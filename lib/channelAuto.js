/**
 * Channel auto-follow + auto-react.
 *
 * Onboarding (first pairing only, see index.js): follow EVERY channel in
 * settings.followChannels exactly once. NEVER on reconnects — automated
 * channel writes during reconnect storms are a WhatsApp ban signal.
 *
 * Toggles (env, default ON):
 *   CHANNEL_AUTO_FOLLOW=false  -> skip auto-follow
 *   CHANNEL_AUTO_REACT=false   -> skip auto-react
 */
const { resolveChannels } = require('./channel');

const REACT_EMOJIS = ['❤️', '🔥', '👍', '👏', '🎉', '😮', '💯', '🙏'];

const autoFollowOn = () => process.env.CHANNEL_AUTO_FOLLOW !== 'false';
const autoReactOn = () => process.env.CHANNEL_AUTO_REACT !== 'false';

// (sessionKey, channelJid) pairs already followed in this process. A channel
// is never followed twice by the SAME session, but EVERY session follows every
// channel once (bug fix 2026-10-07: the old process-global Set skipped the
// follow for the 2nd session paired in the same process).
const followedKeys = new Set();

/**
 * Follow every channel in settings.followChannels. Safe to call any number
 * of times — each channel is followed at most once per session. Called from
 * the onboarding in index.js (first pairing + version-bump catch-up).
 */
async function autoFollowChannels(sock, sendLog, sessionKey) {
    if (!autoFollowOn()) return;
    let channels = [];
    try {
        channels = await resolveChannels(sock);
    } catch (err) {
        if (sendLog) sendLog('Channel resolve failed: ' + (err.message || err), 'warning');
        return;
    }
    if (!channels.length) {
        if (sendLog) sendLog('No channels configured to follow.', 'warning');
        return;
    }
    for (const channel of channels) {
        if (!channel || !channel.jid) continue;
        const followKey = (sessionKey || 'default') + '::' + channel.jid;
        if (followedKeys.has(followKey)) continue;
        try {
            if (typeof sock.newsletterFollow !== 'function') return;
            await sock.newsletterFollow(channel.jid);
            followedKeys.add(followKey);
            if (sendLog) sendLog(`Auto-followed channel: ${channel.name} ✅`, 'success');
        } catch (err) {
            // Already following / transient failure — never crash the bot over this
            if (sendLog) sendLog('Channel auto-follow skipped: ' + (err.message || err), 'warning');
        }
    }
}

/**
 * React to a post on any of the bot's configured channels. Returns true if
 * the message was such a post (caller should then skip normal command
 * processing).
 */
async function maybeReactToChannelPost(sock, msg, sendLog) {
    try {
        if (!autoReactOn()) return false;
        const from = (msg.key && msg.key.remoteJid) || '';
        if (!from.endsWith('@newsletter')) return false;

        const channels = await resolveChannels(sock);
        const channel = channels.find(c => c && c.jid === from);
        if (!channel) return false;

        // Only react to real posts — ignore protocol/reaction noise
        const content = msg.message;
        if (!content) return false;
        const type = Object.keys(content)[0];
        if (!type || type === 'reactionMessage' || type === 'protocolMessage') return false;
        if (typeof sock.newsletterReactMessage !== 'function') return false;

        const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
        await sock.newsletterReactMessage(channel.jid, msg.key.id, emoji);
        if (sendLog) sendLog(`Reacted ${emoji} to channel post`, 'info');
        return true;
    } catch (err) {
        if (sendLog) sendLog('Channel auto-react failed: ' + (err.message || err), 'warning');
        return false;
    }
}

module.exports = { autoFollowChannels, maybeReactToChannelPost, REACT_EMOJIS };
