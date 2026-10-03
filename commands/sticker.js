/**
 * Sticker commands: .sticker (image/video -> sticker), .attp (text -> animated sticker).
 * Uses wa-sticker-formatter if available, else Baileys native sticker send.
 */
const axios = require('axios');

async function downloadQuoted(sock, msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    if (!quoted) return null;
    try {
        const dlMsg = { key: { ...msg.key, id: ctx.stanzaId }, message: quoted };
        const buf = await sock.downloadMediaMessage(dlMsg);
        const type = Object.keys(quoted)[0];
        return { buf, type };
    } catch (e) { return null; }
}

async function sticker(sock, chatId, msg, q) {
    try {
        let buf = null;
        const media = await downloadQuoted(sock, msg);
        if (media) buf = media.buf;
        if (!buf) {
            // try direct image in message
            const mtype = Object.keys(msg.message || {})[0];
            if (mtype === 'imageMessage' || mtype === 'videoMessage') {
                buf = await sock.downloadMediaMessage(msg);
            }
        }
        if (!buf) {
            await sock.sendMessage(chatId, { text: '❌ Kisi photo/video par reply kar ke .sticker likho!' }, { quoted: msg });
            return;
        }
        await sock.sendMessage(chatId, { sticker: buf }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Sticker nahi ban saka.' }, { quoted: msg });
    }
}

async function attp(sock, chatId, msg, q) {
    const text = (q || '').trim();
    if (!text) {
        await sock.sendMessage(chatId, { text: '❌ Text likho!\nExample: .attp Hello' }, { quoted: msg });
        return;
    }
    try {
        const url = `https://api.affiliateplus.xyz/api/attp?text=${encodeURIComponent(text)}`;
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        await sock.sendMessage(chatId, { sticker: Buffer.from(r.data) }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ ATTP sticker nahi ban saka.' }, { quoted: msg });
    }
}

module.exports = { sticker, attp };
