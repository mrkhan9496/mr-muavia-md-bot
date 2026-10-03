/**
 * .save — Kisi bhi status ko save/download karo.
 * Usage: .save (latest status)
 *        .save <number> (us bande ka latest status)
 * Owner only.
 */
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

// In-memory cache of recent statuses (populated by autostatus.js)
const statusCache = [];
const MAX_CACHE = 50;

function cacheStatus(participant, msg, pushName) {
    statusCache.unshift({ participant, msg, pushName, time: Date.now() });
    if (statusCache.length > MAX_CACHE) statusCache.pop();
}

function getLatest(number) {
    if (number) {
        return statusCache.find(s => s.participant.includes(number));
    }
    return statusCache[0];
}

async function saveStatus(sock, chatId, msg, q, ctx) {
    const { isOwner } = ctx;
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Sirf owner use kar sakta hai.' }, { quoted: msg });
        return;
    }

    // PRIORITY 1: quoted message (status par reply karke .save likha ho)
    // Quoted status ka media direct download karo — cache ki zaroorat nahi.
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctxInfo?.quotedMessage;
    if (quoted) {
        const qType = Object.keys(quoted).find(k => k.endsWith('Message'));
        if (qType === 'imageMessage' || qType === 'videoMessage') {
            try {
                const stream = await downloadContentFromMessage(quoted[qType], qType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                const senderJid = ctxInfo.participant || ctxInfo.remoteJid || '';
                const senderNumber = String(senderJid).split('@')[0] || 'Unknown';
                const caption = `📥 *Status Saved*\n📱 ${senderNumber}`;
                if (qType === 'imageMessage') {
                    await sock.sendMessage(chatId, { image: buffer, caption }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { video: buffer, caption }, { quoted: msg });
                }
                return;
            } catch (e) {
                await sock.sendMessage(chatId, { text: '❌ Status download nahi ho saka.' }, { quoted: msg });
                return;
            }
        }
    }

    // PRIORITY 2: cache fallback (purana tareeqa)
    const number = (q || '').replace(/\D/g, '');
    const cached = getLatest(number);

    if (!cached) {
        await sock.sendMessage(chatId, {
            text: number
                ? `❌ ${number} ka koi recent status nahi mila.`
                : '❌ Koi recent status nahi mila. Pehle koi status aane do!'
        }, { quoted: msg });
        return;
    }

    try {
        const messageContent = cached.msg.message?.ephemeralMessage?.message ||
                               cached.msg.message?.viewOnceMessage?.message ||
                               cached.msg.message;
        if (!messageContent) {
            await sock.sendMessage(chatId, { text: '❌ Status media nahi mil saka.' }, { quoted: msg });
            return;
        }

        const type = Object.keys(messageContent).find(k => k.endsWith('Message'));
        if (!type || (type !== 'imageMessage' && type !== 'videoMessage')) {
            await sock.sendMessage(chatId, { text: '❌ Ye status photo/video nahi hai.' }, { quoted: msg });
            return;
        }

        const mContent = messageContent[type];
        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const senderNumber = cached.participant.split('@')[0];
        const caption = `📥 *Status Saved*\n👤 ${cached.pushName || 'Unknown'}\n📱 ${senderNumber}`;

        if (type === 'imageMessage') {
            await sock.sendMessage(chatId, { image: buffer, caption }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { video: buffer, caption }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Status save nahi ho saka.' }, { quoted: msg });
    }
}

module.exports = { saveStatus, cacheStatus };
