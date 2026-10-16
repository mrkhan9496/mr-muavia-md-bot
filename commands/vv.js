const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

/**
 * .vv — View-Once bypass (2026-10-16 fixed)
 * Kisi view-once photo/video/audio par reply kar ke .vv likho.
 *
 * IMPORTANT: View-once ko KHOLNE SE PEHLE .vv use karo!
 * Ek dafa khol liya to WhatsApp media delete kar deta hai,
 * phir download nahi ho sakta.
 */
async function vvCommand(sock, from, msg) {
    const loadEmojis = ['⏳', '🔓', '👁️'];
    for (const emoji of loadEmojis) {
        try { await sock.sendMessage(from, { react: { text: emoji, key: msg.key } }); } catch {}
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(from, {
            text: `❌ *View-Once message par reply kar ke .vv likho!*\n\n⚠️ View-once ko kholne SE PEHLE use karo — kholne ke baad media delete ho jata hai!`
        }, { quoted: msg });
    }

    // Saare view-once formats: V1, V2, V2Extension + ephemeral wrapping
    const qInner = quoted.ephemeralMessage?.message || quoted;
    const viewOnce = qInner.viewOnceMessageV2 || qInner.viewOnceMessage || qInner.viewOnceMessageV2Extension;
    const message = viewOnce ? (viewOnce.message || {}) : qInner;
    const mInner = message.ephemeralMessage?.message || message;
    const vType = Object.keys(mInner)[0];

    if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(vType)) {
        return await sock.sendMessage(from, {
            text: `❌ *Ye view-once media nahi lag raha!*\n\nYa to ye view-once nahi hai, ya pehle hi khola ja chuka hai (media delete ho gaya).\n\n💡 Tip: Agli dafa view-once aye to kholne se PEHLE .vv likho — ya bot khud hi tumhare DM mein copy bhej dega!`
        }, { quoted: msg });
    }

    try {
        const stream = await downloadContentFromMessage(mInner[vType], vType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        if (!buffer.length) throw new Error('empty buffer');

        // PRIVACY (2026-10-16): copy SIRF personal DM mein jayegi,
        // us bande ki chat/group mein NAHI — warna sab dekh lenge!
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const dmCaption = `👁️ *View-Once* 👁️\n\n> *© POWERED BY MR MUAVIA MD BOT*`;

        if (vType === 'imageMessage') {
            await sock.sendMessage(ownerJid, { image: buffer, caption: dmCaption });
        } else if (vType === 'videoMessage') {
            await sock.sendMessage(ownerJid, { video: buffer, caption: dmCaption });
        } else if (vType === 'audioMessage') {
            await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mp4' });
        }
        // Confirm sirf command wali chat mein (bina media ke)
        await sock.sendMessage(from, { text: `✅ *View-Once save ho gaya!* 👁️\n\n📩 Apne personal chat (DM) mein dekho!` }, { quoted: msg });
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }); } catch {}
    } catch (e) {
        console.error('vv download failed:', e.message);
        await sock.sendMessage(from, {
            text: `❌ *Download fail ho gaya!*\n\nWajah: Ye view-once pehle hi khola ja chuka hai — WhatsApp ne media delete kar diya.\n\n💡 *Hal:* Agli dafa view-once aye to:\n1. Usay MAT kholo\n2. Foran reply kar ke *.vv* likho\n3. Ya intezar karo — bot khud tumhare DM mein copy bhej dega! 👁️`
        }, { quoted: msg });
    }
}

module.exports = vvCommand;
