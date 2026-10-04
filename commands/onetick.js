/**
 * MR Muavia MD BOT - Ghost Mode (1-Tick) Command
 * .onetick on/off — when ON, the bot reads messages but the sender only
 * ever sees 1 grey tick (sent). No delivery receipts, no blue ticks —
 * to the sender it looks like the bot is offline.
 * Setting is per-session via botData.statusSettings[userId].ghostMode.
 */

const { getChannelInfo } = require('../lib/messageConfig');

function isGhostEnabled(botData, userId) {
    return !!(botData?.statusSettings?.[userId]?.ghostMode);
}

// Apply ghost mode to a live socket: swallow all outgoing receipts
// (delivery + read) and stay invisible. Call on socket setup and on toggle.
function applyGhostMode(sock, enabled) {
    if (!sock) return;
    try {
        if (enabled) {
            if (!sock._origSendReceipt) sock._origSendReceipt = sock.sendReceipt.bind(sock);
            if (!sock._origReadMessages) sock._origReadMessages = sock.readMessages.bind(sock);
            // Block ALL receipts -> sender stuck at 1 grey tick
            sock.sendReceipt = async () => {};
            sock.readMessages = async () => {};
            // Appear offline
            try { sock.sendPresenceUpdate('unavailable'); } catch {}
        } else {
            if (sock._origSendReceipt) sock.sendReceipt = sock._origSendReceipt;
            if (sock._origReadMessages) sock.readMessages = sock._origReadMessages;
            try { sock.sendPresenceUpdate('available'); } catch {}
        }
    } catch {}
}

async function onetickCommand(sock, chatId, message, isOwner, botData, saveBotData, userId, args) {
    try {
        const channelInfo = await getChannelInfo(sock);

        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Ye command sirf owner ke liye hai!',
                ...channelInfo
            });
            return;
        }

        if (!botData.statusSettings) botData.statusSettings = {};
        if (!botData.statusSettings[userId]) botData.statusSettings[userId] = {};

        let enabled = isGhostEnabled(botData, userId);

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                enabled = true;
            } else if (action === 'off' || action === 'disable') {
                enabled = false;
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Ghalat option! Use: .onetick on/off',
                    ...channelInfo
                });
                return;
            }
        } else {
            enabled = !enabled;
        }

        botData.statusSettings[userId].ghostMode = enabled;
        saveBotData();

        // Apply immediately to the live socket
        applyGhostMode(sock, enabled);

        await sock.sendMessage(chatId, {
            text: enabled
                ? '👻 *Ghost Mode ON!*\n\nAb jo bhi message karega usko sirf *1 tick* nazar aayega.\nTum message parh bhi lo ge to usko pata nahi chale ga — usko lage ga tum offline ho.'
                : '👻 *Ghost Mode OFF!*\n\nAb normal ticks kaam karenge (delivered + read).',
            ...channelInfo
        });

    } catch (error) {
        console.error('Error in onetick command:', error);
        try {
            await sock.sendMessage(chatId, { text: '❌ Error processing command!' });
        } catch {}
    }
}

module.exports = {
    onetickCommand,
    isGhostEnabled,
    applyGhostMode
};
