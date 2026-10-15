const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

// In-memory store of legitimately-received messages, isolated per WhatsApp session (userId).
// Structure: Map<userId, Map<messageId, storedMessage>>
// Intentionally in-memory only (Heroku's filesystem is ephemeral) - deletes normally arrive
// within seconds/minutes of the original message, so a restart losing very old buffered
// messages is an acceptable tradeoff versus writing raw message content to disk.
const messageStores = new Map();

const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }
        return totalSize / (1024 * 1024);
    } catch (err) {
        return 0;
    }
};

const cleanTempFolderIfLarge = () => {
    try {
        if (getFolderSizeInMB(TEMP_MEDIA_DIR) > 100) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEMP_MEDIA_DIR, file));
            }
        }
    } catch (err) {}
};

setInterval(cleanTempFolderIfLarge, 60 * 1000);

function getStoreForUser(userId) {
    if (!messageStores.has(userId)) messageStores.set(userId, new Map());
    return messageStores.get(userId);
}

// botData.antiDelete[userId] is the persisted ON/OFF flag (survives restarts via bot_data.json).
// This keeps Anti-Delete state isolated per session, same as every other per-user setting
// (antilink, anticall, etc.) elsewhere in the project.
async function handleAntideleteCommand(sock, chatId, message, isAdmin, botData, saveBotData, userId, args) {
    if (!isAdmin) {
        return sock.sendMessage(chatId, { text: '❌ Only owner can use this command.' }, { quoted: message });
    }

    if (!botData.antiDelete) botData.antiDelete = {};
    const match = args[0]?.toLowerCase();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `╭━━━〔 ${toBold("ANTI-DELETE SETUP")} 〕━━━┈⊷\n` +
                   `┃ ⋄ ${toBold("Status:")} ✅ Always ON (locked)\n` +
                   `╰━━━━━━━━━━━━━━━━━━┈⊷`
        }, {quoted: message});
    }

    // ALWAYS ON (2026-10-16): the toggle is kept for compatibility but disabling
    // is not allowed anymore.
    if (match === 'on') {
        botData.antiDelete[userId] = true;
    } else if (match === 'off') {
        return sock.sendMessage(chatId, { text: '*Anti-delete is permanently enabled and cannot be turned off.*' }, {quoted:message});
    } else {
        return sock.sendMessage(chatId, { text: '*Invalid command. Use .antidelete to see usage.*' }, {quoted:message});
    }

    saveBotData();
    return sock.sendMessage(chatId, { text: `*Antidelete enabled ✅*` }, {quoted:message});
}

// Called for every legitimately-received message this session's socket sees. Storage is
// skipped when Anti-Delete is disabled for this user, and is scoped strictly to this userId's
// own store so it can never be read back by, or leak into, another session.
async function storeMessage(message, botData, userId) {
    try {
        // ALWAYS ON (2026-10-16): store every message so deletions can be recovered.
        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        const sender = message.key.participant || message.key.remoteJid;

        const msg = message.message?.ephemeralMessage?.message ||
                    message.message?.viewOnceMessage?.message ||
                    message.message?.viewOnceMessageV2?.message ||
                    message.message;

        if (!msg) return;

        if (msg.conversation) {
            content = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            content = msg.extendedTextMessage.text;
        } else if (msg.imageMessage) {
            mediaType = 'image';
            content = msg.imageMessage.caption || '';
            try {
                const buffer = await downloadContentFromMessage(msg.imageMessage, 'image');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${userId}_${messageId}.jpg`);
                await writeFile(mediaPath, buffer);
            } catch (e) { mediaPath = ''; }
        } else if (msg.stickerMessage) {
            mediaType = 'sticker';
            try {
                const buffer = await downloadContentFromMessage(msg.stickerMessage, 'sticker');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${userId}_${messageId}.webp`);
                await writeFile(mediaPath, buffer);
            } catch (e) { mediaPath = ''; }
        } else if (msg.videoMessage) {
            mediaType = 'video';
            content = msg.videoMessage.caption || '';
            try {
                const buffer = await downloadContentFromMessage(msg.videoMessage, 'video');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${userId}_${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
            } catch (e) { mediaPath = ''; }
        } else if (msg.audioMessage) {
            mediaType = 'audio';
            try {
                const buffer = await downloadContentFromMessage(msg.audioMessage, 'audio');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${userId}_${messageId}.mp3`);
                await writeFile(mediaPath, buffer);
            } catch (e) { mediaPath = ''; }
        } else {
            return; // Unsupported message type for Anti-Delete recovery - nothing to store.
        }

        getStoreForUser(userId).set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });
    } catch (err) {}
}

// Recovers a deleted message and sends the report ONLY to this session's own WhatsApp number
// (the owner's personal chat) - never back into the group/private chat it was deleted from,
// and only ever reads from this same userId's own store.
async function handleMessageRevocation(sock, revocationMessage, botData, userId) {
    try {
        // ALWAYS ON (2026-10-16, user request): anti-delete can no longer be
        // disabled — the per-session toggle is ignored.
        if (!botData) return;

        const messageId = revocationMessage.message?.protocolMessage?.key?.id;
        if (!messageId) return;
        const deletedBy = revocationMessage.participant || revocationMessage.key?.participant || revocationMessage.key?.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (!deletedBy || deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        const store = getStoreForUser(userId);
        const original = store.get(messageId);
        if (!original) return;

        const sender = original.sender;
        const senderName = sender.split('@')[0];

        let report = `╭━━━〔 ${toBold("ANTI-DELETE REPORT")} 〕━━━┈⊷\n` +
                     `┃ 👤 ${toBold("Sender:")} @${senderName}\n` +
                     `┃ 🗑️ ${toBold("Deleted By:")} @${deletedBy.split('@')[0]}\n` +
                     `┃ 🕒 ${toBold("Time:")} ${new Date().toLocaleTimeString()}\n` +
                     `┃ 📂 ${toBold("Type:")} ${original.mediaType || 'Text'}\n` +
                     `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;

        if (original.content) {
            report += `📝 ${toBold("Message Content:")}\n${original.content}`;
        } else if (!original.mediaType) {
            report += `⚠️ No text content was captured for this message.`;
        }

        try {
            await sock.sendMessage(ownerNumber, { text: report, mentions: [deletedBy, sender] });
        } catch (e) {}

        if (original.mediaType) {
            if (original.mediaPath && fs.existsSync(original.mediaPath)) {
                const mediaOptions = { caption: `*Deleted ${original.mediaType}* from @${senderName}`, mentions: [sender] };
                try {
                    if (original.mediaType === 'image') await sock.sendMessage(ownerNumber, { image: { url: original.mediaPath }, ...mediaOptions });
                    else if (original.mediaType === 'sticker') await sock.sendMessage(ownerNumber, { sticker: { url: original.mediaPath }, ...mediaOptions });
                    else if (original.mediaType === 'video') await sock.sendMessage(ownerNumber, { video: { url: original.mediaPath }, ...mediaOptions });
                    else if (original.mediaType === 'audio') await sock.sendMessage(ownerNumber, { audio: { url: original.mediaPath }, mimetype: 'audio/mp4', ...mediaOptions });
                } catch (e) {}

                setTimeout(() => {
                    try { if (fs.existsSync(original.mediaPath)) fs.unlinkSync(original.mediaPath); } catch (err) {}
                }, 5000);
            } else {
                try {
                    await sock.sendMessage(ownerNumber, {
                        text: `⚠️ A deleted ${original.mediaType} from @${senderName} could not be recovered (media unavailable).`,
                        mentions: [sender]
                    });
                } catch (e) {}
            }
        }
        store.delete(messageId);
    } catch (err) {}
}

module.exports = handleAntideleteCommand;
module.exports.storeMessage = storeMessage;
module.exports.handleMessageRevocation = handleMessageRevocation;
