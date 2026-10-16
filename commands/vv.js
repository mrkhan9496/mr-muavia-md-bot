const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const viewOnceStore = require('../lib/viewOnceStore');

/**
 * .vv — View-Once bypass (2026-10-16)
 *
 * Dusre bots ki tarah: view-once KHOLNE KE BAAD bhi kaam karta hai!
 * Raaz: bot view-once atay hi download karke STORE kar leta hai.
 *
 * .vv (reply) — us view-once ki copy
 * .vv (bina reply) — is chat ka sab se recent view-once
 *
 * Copy SIRF owner ke personal DM mein jati hai.
 * Command par ✅ reaction — koi text message nahi!
 */
async function vvCommand(sock, from, msg) {
    const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const dmCaption = `👁️ *View-Once* 👁️\n\n> *© POWERED BY MR MUAVIA MD BOT*`;

    async function sendToDM(buffer, vType) {
        if (vType === 'imageMessage') {
            await sock.sendMessage(ownerJid, { image: buffer, caption: dmCaption });
        } else if (vType === 'videoMessage') {
            await sock.sendMessage(ownerJid, { video: buffer, caption: dmCaption });
        } else if (vType === 'audioMessage') {
            await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mp4' });
        }
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }); } catch {}
    }

    // --- Pehle: kya store mein hai? (kholne ke baad bhi kaam karega!) ---
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let quotedMsgId = null;
    if (quoted) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        quotedMsgId = ctx?.stanzaId || null;
    }

    // Agar reply hai to pehle direct download try karo
    if (quoted) {
        try {
            const qInner = quoted.ephemeralMessage?.message || quoted;
            const viewOnce = qInner.viewOnceMessageV2 || qInner.viewOnceMessage || qInner.viewOnceMessageV2Extension;
            const message = viewOnce ? (viewOnce.message || {}) : qInner;
            const mInner = message.ephemeralMessage?.message || message;
            const vType = Object.keys(mInner)[0];

            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(vType)) {
                const stream = await downloadContentFromMessage(mInner[vType], vType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                if (buffer.length) {
                    await sendToDM(buffer, vType);
                    return;
                }
            }
        } catch (e) {
            console.error('vv direct download failed, trying store:', e.message);
        }

        // Direct fail → store mein dhoondo (is message ID ka ya recent)
        const stored = (quotedMsgId && viewOnceStore.getByMsgId(from, quotedMsgId)) || viewOnceStore.getRecent(from);
        if (stored && stored.buffer && stored.buffer.length) {
            await sendToDM(stored.buffer, stored.type);
            return;
        }
    } else {
        // Bina reply: is chat ka sab se recent view-once
        const stored = viewOnceStore.getRecent(from);
        if (stored && stored.buffer && stored.buffer.length) {
            await sendToDM(stored.buffer, stored.type);
            return;
        }
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
        return;
    }

    // Kuch nahi mila
    try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
}

module.exports = vvCommand;
